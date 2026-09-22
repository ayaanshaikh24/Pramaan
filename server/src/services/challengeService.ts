import { prisma } from '../config/prisma.js'
import { broadcastSessionEvent } from '../websocket/socketServer.js'
import { calculateRiskScore } from '../scoring/riskScorer.js'
import { ChallengeResultInput } from '../validators/challengeValidator.js'
import { getSession } from './sessionService.js'

const DEMO_PROMPTS = [
  'Turn your head slightly to the right and say BLUE 47',
  'Look straight at the camera and say GREEN 82',
  'Raise your eyebrows and say ORANGE 19',
  'Turn slightly left and say PURPLE 63',
]

export async function issueChallenge(sessionIdOrPublicId: string) {
  const session = await getSession(sessionIdOrPublicId)
  if (!session) throw new Error('Session not found')

  const prompt = DEMO_PROMPTS[Math.floor(Math.random() * DEMO_PROMPTS.length)]
  const issuedAt = new Date()
  const expiresAt = new Date(issuedAt.getTime() + 25 * 1000) // 25s limit

  const challenge = await prisma.challenge.create({
    data: {
      sessionId: session.id,
      prompt,
      status: 'ISSUED',
      issuedAt,
    },
  })

  // Create event
  await prisma.integrityEvent.create({
    data: {
      sessionId: session.id,
      timestampSeconds: Math.floor((issuedAt.getTime() - (session.startedAt?.getTime() || issuedAt.getTime())) / 1000),
      type: 'SYSTEM',
      title: 'Random challenge issued',
      description: `Live presence prompt dispatched: "${prompt}"`,
      severity: 'info',
    },
  })

  const payload = {
    id: challenge.id,
    prompt: challenge.prompt,
    issuedAt: challenge.issuedAt,
    expiresAt,
    durationSeconds: 20,
  }

  broadcastSessionEvent(session.id, 'challenge:issued', payload)
  broadcastSessionEvent(session.publicId, 'challenge:issued', payload)

  return payload
}

export async function submitChallengeResult(challengeId: string, input: ChallengeResultInput) {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    include: { session: true },
  })

  if (!challenge) throw new Error('Challenge not found')

  const completedAt = new Date()
  const updatedChallenge = await prisma.challenge.update({
    where: { id: challengeId },
    data: {
      status: input.result,
      completedAt,
      responseMetadata: JSON.stringify({
        responseDurationMs: input.responseDurationMs,
        clientTimestamp: input.clientTimestamp,
      }),
    },
  })

  // Create event based on result
  const eventTitle =
    input.result === 'PASSED'
      ? 'Challenge passed'
      : input.result === 'PARTIAL'
      ? 'Challenge only partially completed'
      : 'Challenge response failed'

  const eventSeverity = input.result === 'PASSED' ? 'normal' : input.result === 'PARTIAL' ? 'warning' : 'critical'

  await prisma.integrityEvent.create({
    data: {
      sessionId: challenge.sessionId,
      timestampSeconds: Math.floor((completedAt.getTime() - (challenge.session.startedAt?.getTime() || completedAt.getTime())) / 1000),
      type: input.result === 'PASSED' ? 'VERIFIED' : 'WARNING',
      title: eventTitle,
      description: `Challenge prompt "${challenge.prompt}" evaluated with result: ${input.result}.`,
      severity: eventSeverity,
    },
  })

  // Update latest signal snapshot challenge score
  const latestSignal = await prisma.signalSnapshot.findFirst({
    where: { sessionId: challenge.sessionId },
    orderBy: { createdAt: 'desc' },
  })

  const newChallengeScore = input.result === 'PASSED' ? 100 : input.result === 'PARTIAL' ? 50 : 0

  const scoring = calculateRiskScore({
    faceMotionScore: latestSignal?.faceMotionScore ?? 90,
    lipSyncScore: latestSignal?.lipSyncScore ?? 90,
    challengeScore: newChallengeScore,
    streamQualityScore: latestSignal?.streamQualityScore ?? 90,
  })

  await prisma.interviewSession.update({
    where: { id: challenge.sessionId },
    data: {
      riskScore: scoring.riskScore,
      riskStatus: scoring.riskStatus,
      confidence: scoring.confidence,
    },
  })

  const payload = {
    challenge: updatedChallenge,
    challengeScore: newChallengeScore,
    riskScore: scoring.riskScore,
    riskStatus: scoring.riskStatus,
    confidence: scoring.confidence,
  }

  broadcastSessionEvent(challenge.sessionId, 'challenge:result', payload)
  broadcastSessionEvent(challenge.session.publicId, 'challenge:result', payload)
  broadcastSessionEvent(challenge.sessionId, 'risk:update', payload)
  broadcastSessionEvent(challenge.session.publicId, 'risk:update', payload)

  return payload
}
