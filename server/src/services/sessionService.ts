import crypto from 'crypto'
import { prisma } from '../config/prisma.js'
import { config } from '../config/env.js'
import { broadcastSessionEvent } from '../websocket/socketServer.js'
import { calculateRiskScore } from '../scoring/riskScorer.js'
import { generateCandidateToken } from '../middleware/authMiddleware.js'
import { ScenarioType, SessionStatus } from '../types/index.js'

export async function createSession(
  recruiterId: string,
  input: {
    candidateName: string
    candidateEmail: string
    candidateRole: string
    interviewStage: string
  }
) {
  // Generate friendly public ID
  const randomSuffix = Math.floor(1000 + Math.random() * 9000)
  const publicId = `PRM-CX${randomSuffix}`

  const session = await prisma.interviewSession.create({
    data: {
      publicId,
      candidateName: input.candidateName,
      candidateEmail: input.candidateEmail,
      candidateRole: input.candidateRole,
      interviewStage: input.interviewStage,
      status: 'CREATED',
      scenario: 'NORMAL',
      riskScore: 12,
      riskStatus: 'LOW_RISK',
      confidence: 'HIGH',
      recruiterId,
    },
  })

  // Create candidate access token
  const rawToken = crypto.randomBytes(24).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

  await prisma.candidateAccess.create({
    data: {
      sessionId: session.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
    },
  })

  const candidateJwt = generateCandidateToken({
    sessionId: session.id,
    candidateName: session.candidateName,
    role: 'CANDIDATE',
  })

  const candidateInviteUrl = `${config.frontendUrl}/?view=candidate&sessionId=${session.publicId}&token=${candidateJwt}`
  const recruiterSessionUrl = `${config.frontendUrl}/?view=live&sessionId=${session.publicId}`

  // Log audit
  await prisma.auditLog.create({
    data: {
      sessionId: session.id,
      actorType: 'RECRUITER',
      action: 'SESSION_CREATED',
      metadata: JSON.stringify({ publicId: session.publicId, candidateName: session.candidateName }),
    },
  })

  return {
    id: session.id,
    publicId: session.publicId,
    candidateName: session.candidateName,
    candidateRole: session.candidateRole,
    candidateInviteUrl,
    recruiterSessionUrl,
    token: candidateJwt,
  }
}

export async function getRecruiterSessions(recruiterId: string) {
  return prisma.interviewSession.findMany({
    where: { recruiterId },
    orderBy: { createdAt: 'desc' },
    include: {
      consent: true,
      signals: {
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
    },
  })
}

export async function getSession(sessionIdOrPublicId: string) {
  const session = await prisma.interviewSession.findFirst({
    where: {
      OR: [{ id: sessionIdOrPublicId }, { publicId: sessionIdOrPublicId }],
    },
    include: {
      consent: true,
      signals: {
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
      challenges: {
        take: 5,
        orderBy: { createdAt: 'desc' },
      },
      events: {
        take: 20,
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  return session
}

export async function updateSessionStatus(sessionIdOrPublicId: string, status: SessionStatus) {
  const session = await getSession(sessionIdOrPublicId)
  if (!session) throw new Error('Session not found')

  const updated = await prisma.interviewSession.update({
    where: { id: session.id },
    data: { status },
  })

  broadcastSessionEvent(session.id, 'session:status', { status })
  broadcastSessionEvent(session.publicId, 'session:status', { status })

  return updated
}

export async function startSession(sessionIdOrPublicId: string) {
  const session = await getSession(sessionIdOrPublicId)
  if (!session) throw new Error('Session not found')

  const updated = await prisma.interviewSession.update({
    where: { id: session.id },
    data: {
      status: 'ACTIVE',
      startedAt: session.startedAt || new Date(),
    },
  })

  // Create initial events if not already present
  const existingEvents = await prisma.integrityEvent.count({ where: { sessionId: session.id } })
  if (existingEvents === 0) {
    await prisma.integrityEvent.createMany({
      data: [
        {
          sessionId: session.id,
          timestampSeconds: 0,
          type: 'SYSTEM',
          title: 'Candidate joined',
          description: 'Session initialized. Device verification and consent pending.',
          severity: 'info',
        },
        {
          sessionId: session.id,
          timestampSeconds: 5,
          type: 'SYSTEM',
          title: 'Session started',
          description: 'Live monitoring channel established with local client extraction.',
          severity: 'info',
        },
      ],
    })
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      sessionId: session.id,
      actorType: 'SYSTEM',
      action: 'SESSION_STARTED',
      metadata: JSON.stringify({ publicId: session.publicId }),
    },
  })

  broadcastSessionEvent(session.id, 'session:status', { status: 'ACTIVE', startedAt: updated.startedAt })
  broadcastSessionEvent(session.publicId, 'session:status', { status: 'ACTIVE', startedAt: updated.startedAt })

  return updated
}

export async function endSession(sessionIdOrPublicId: string) {
  const session = await getSession(sessionIdOrPublicId)
  if (!session) throw new Error('Session not found')

  const updated = await prisma.interviewSession.update({
    where: { id: session.id },
    data: {
      status: 'ENDED',
      endedAt: new Date(),
    },
  })

  // Record end event
  await prisma.integrityEvent.create({
    data: {
      sessionId: session.id,
      timestampSeconds: 300,
      type: 'SYSTEM',
      title: 'Session concluded',
      description: 'Interview session ended by operator. Final decision-support report generated.',
      severity: 'info',
    },
  })

  // Auto-generate final report
  const latestSignal = await prisma.signalSnapshot.findFirst({
    where: { sessionId: session.id },
    orderBy: { createdAt: 'desc' },
  })

  const allEvents = await prisma.integrityEvent.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: 'asc' },
  })

  const reportPayload = {
    product: 'PRAMAAN Interview Integrity Layer',
    version: '1.0.0-hackathon',
    generatedAt: new Date().toISOString(),
    session: {
      id: session.id,
      publicId: session.publicId,
      candidateName: session.candidateName,
      candidateRole: session.candidateRole,
      stage: session.interviewStage,
      status: 'ENDED',
      startedAt: session.startedAt,
      endedAt: updated.endedAt,
    },
    integrityAudit: {
      riskScore: session.riskScore,
      riskStatus: session.riskStatus,
      confidence: session.confidence,
      latestSignals: latestSignal,
    },
    privacyMetadata: {
      browserSideProcessing: true,
      rawVideoStored: false,
      humanReviewMandatory: true,
    },
    timeline: allEvents,
    disclaimer: 'PRAMAAN provides decision-support signals and does not make automatic hiring decisions.',
  }

  const report = await prisma.report.create({
    data: {
      sessionId: session.id,
      generatedBy: 'SYSTEM',
      reportData: JSON.stringify(reportPayload),
    },
  })

  broadcastSessionEvent(session.id, 'session:ended', { reportId: report.id })
  broadcastSessionEvent(session.publicId, 'session:ended', { reportId: report.id })

  return { session: updated, reportId: report.id }
}

export async function recordConsent(
  sessionIdOrPublicId: string,
  input: {
    cameraConsent: boolean
    microphoneConsent: boolean
    signalProcessingConsent: boolean
    consentVersion?: string
  }
) {
  const session = await getSession(sessionIdOrPublicId)
  if (!session) throw new Error('Session not found')

  const consent = await prisma.consentRecord.upsert({
    where: { sessionId: session.id },
    update: {
      cameraConsent: input.cameraConsent,
      microphoneConsent: input.microphoneConsent,
      signalProcessingConsent: input.signalProcessingConsent,
      consentVersion: input.consentVersion || 'v1',
      consentedAt: new Date(),
    },
    create: {
      sessionId: session.id,
      candidateName: session.candidateName,
      cameraConsent: input.cameraConsent,
      microphoneConsent: input.microphoneConsent,
      signalProcessingConsent: input.signalProcessingConsent,
      consentVersion: input.consentVersion || 'v1',
    },
  })

  await prisma.integrityEvent.create({
    data: {
      sessionId: session.id,
      timestampSeconds: 10,
      type: 'VERIFIED',
      title: 'Biometric consent recorded',
      description: 'Candidate granted permissions for client-side signal processing.',
      severity: 'normal',
    },
  })

  await prisma.auditLog.create({
    data: {
      sessionId: session.id,
      actorType: 'CANDIDATE',
      action: 'CONSENT_RECORDED',
      metadata: JSON.stringify(input),
    },
  })

  broadcastSessionEvent(session.id, 'consent:recorded', consent)
  broadcastSessionEvent(session.publicId, 'consent:recorded', consent)

  return consent
}

export async function applyScenario(
  sessionIdOrPublicId: string,
  scenario: ScenarioType
) {
  const session = await getSession(sessionIdOrPublicId)
  if (!session) throw new Error('Session not found')

  let snapshotData = {
    faceMotionScore: 94 as number | null,
    lipSyncScore: 96 as number | null,
    challengeScore: 100 as number | null,
    streamQualityScore: 92 as number | null,
    visualEvidenceAvailable: true,
    audioEvidenceAvailable: true,
  }

  let eventData = {
    type: 'VERIFIED',
    title: 'Integrity status updated',
    description: 'All 4 signal vectors consistent and within normal parameters.',
    severity: 'normal',
  }

  if (scenario === 'PROXY') {
    snapshotData = {
      faceMotionScore: 54,
      lipSyncScore: 38,
      challengeScore: 50,
      streamQualityScore: 84,
      visualEvidenceAvailable: true,
      audioEvidenceAvailable: true,
    }

    eventData = {
      type: 'WARNING',
      title: 'Lip-sync anomaly & reduced motion',
      description: 'Speech timing divergence and live challenge only partially completed.',
      severity: 'critical',
    }
  } else if (scenario === 'LOW_BANDWIDTH') {
    snapshotData = {
      faceMotionScore: null,
      lipSyncScore: 86,
      challengeScore: 100,
      streamQualityScore: 24,
      visualEvidenceAvailable: false,
      audioEvidenceAvailable: true,
    }

    eventData = {
      type: 'SYSTEM',
      title: 'Stream quality degraded',
      description: 'Visual evidence confidence reduced. Fairness safeguard applied.',
      severity: 'warning',
    }
  }

  // Calculate new risk score
  const scoring = calculateRiskScore(snapshotData)

  // Save new signal snapshot
  const snapshot = await prisma.signalSnapshot.create({
    data: {
      sessionId: session.id,
      ...snapshotData,
      confidence: scoring.confidence,
    },
  })

  // Update session
  const updatedSession = await prisma.interviewSession.update({
    where: { id: session.id },
    data: {
      scenario,
      riskScore: scoring.riskScore,
      riskStatus: scoring.riskStatus,
      confidence: scoring.confidence,
    },
  })

  // Add event
  const newEvent = await prisma.integrityEvent.create({
    data: {
      sessionId: session.id,
      timestampSeconds: 300,
      type: eventData.type,
      title: eventData.title,
      description: eventData.description,
      severity: eventData.severity,
    },
  })

  const payload = {
    scenario,
    riskScore: scoring.riskScore,
    riskStatus: scoring.riskStatus,
    confidence: scoring.confidence,
    explanation: scoring.explanation,
    signals: snapshot,
    event: newEvent,
  }

  broadcastSessionEvent(session.id, 'scenario:changed', payload)
  broadcastSessionEvent(session.publicId, 'scenario:changed', payload)
  broadcastSessionEvent(session.id, 'risk:update', payload)
  broadcastSessionEvent(session.publicId, 'risk:update', payload)

  return payload
}
