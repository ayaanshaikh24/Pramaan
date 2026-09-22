import { prisma } from '../config/prisma.js'
import { broadcastSessionEvent } from '../websocket/socketServer.js'
import { calculateRiskScore } from '../scoring/riskScorer.js'
import { SignalSnapshotInput } from '../validators/signalValidator.js'
import { getSession } from './sessionService.js'

export async function ingestSignal(sessionIdOrPublicId: string, input: SignalSnapshotInput) {
  const session = await getSession(sessionIdOrPublicId)
  if (!session) throw new Error('Session not found')

  // Run server-side risk scoring
  const scoring = calculateRiskScore({
    faceMotionScore: input.faceMotionScore,
    lipSyncScore: input.lipSyncScore,
    challengeScore: input.challengeScore,
    streamQualityScore: input.streamQualityScore,
    visualEvidenceAvailable: input.visualEvidenceAvailable,
    audioEvidenceAvailable: input.audioEvidenceAvailable,
  })

  // Save snapshot to database
  const snapshot = await prisma.signalSnapshot.create({
    data: {
      sessionId: session.id,
      faceMotionScore: input.faceMotionScore !== undefined ? input.faceMotionScore : null,
      lipSyncScore: input.lipSyncScore !== undefined ? input.lipSyncScore : null,
      challengeScore: input.challengeScore !== undefined ? input.challengeScore : null,
      streamQualityScore: input.streamQualityScore !== undefined ? input.streamQualityScore : null,
      visualEvidenceAvailable: input.visualEvidenceAvailable !== false,
      audioEvidenceAvailable: input.audioEvidenceAvailable !== false,
      confidence: scoring.confidence,
    },
  })

  // Check if riskStatus changed to create an event
  const previousStatus = session.riskStatus
  if (previousStatus !== scoring.riskStatus) {
    await prisma.integrityEvent.create({
      data: {
        sessionId: session.id,
        timestampSeconds: Math.floor((Date.now() - (session.startedAt?.getTime() || Date.now())) / 1000),
        type: scoring.riskStatus === 'LOW_RISK' ? 'VERIFIED' : scoring.riskStatus === 'REVIEW_RECOMMENDED' ? 'WARNING' : 'SYSTEM',
        title: `Integrity status changed: ${scoring.riskStatus}`,
        description: scoring.explanation,
        severity: scoring.riskStatus === 'LOW_RISK' ? 'normal' : scoring.riskStatus === 'REVIEW_RECOMMENDED' ? 'critical' : 'warning',
      },
    })
  }

  // Update session
  const updatedSession = await prisma.interviewSession.update({
    where: { id: session.id },
    data: {
      riskScore: scoring.riskScore,
      riskStatus: scoring.riskStatus,
      confidence: scoring.confidence,
    },
  })

  const payload = {
    signals: snapshot,
    riskScore: scoring.riskScore,
    riskStatus: scoring.riskStatus,
    confidence: scoring.confidence,
    explanation: scoring.explanation,
  }

  broadcastSessionEvent(session.id, 'signal:update', payload)
  broadcastSessionEvent(session.publicId, 'signal:update', payload)
  broadcastSessionEvent(session.id, 'risk:update', payload)
  broadcastSessionEvent(session.publicId, 'risk:update', payload)

  return payload
}
