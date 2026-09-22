import { prisma } from '../config/prisma.js'
import { broadcastSessionEvent } from '../websocket/socketServer.js'
import { getSession } from './sessionService.js'

export async function getEvents(sessionIdOrPublicId: string, filter?: string) {
  const session = await getSession(sessionIdOrPublicId)
  if (!session) throw new Error('Session not found')

  const whereClause: any = { sessionId: session.id }

  if (filter && filter !== 'all') {
    const upper = filter.toUpperCase()
    if (upper === 'WARNING') {
      whereClause.type = { in: ['WARNING', 'REVIEW'] }
    } else if (upper === 'VERIFIED') {
      whereClause.type = 'VERIFIED'
    } else if (upper === 'SYSTEM') {
      whereClause.type = 'SYSTEM'
    }
  }

  return prisma.integrityEvent.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
  })
}

export async function createEvent(
  sessionIdOrPublicId: string,
  input: {
    type: string
    title: string
    description: string
    severity?: string
    metadata?: any
  }
) {
  const session = await getSession(sessionIdOrPublicId)
  if (!session) throw new Error('Session not found')

  const seconds = Math.floor((Date.now() - (session.startedAt?.getTime() || Date.now())) / 1000)

  const event = await prisma.integrityEvent.create({
    data: {
      sessionId: session.id,
      timestampSeconds: seconds,
      type: input.type,
      title: input.title,
      description: input.description,
      severity: input.severity || 'info',
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  })

  broadcastSessionEvent(session.id, 'integrity:event', event)
  broadcastSessionEvent(session.publicId, 'integrity:event', event)

  return event
}

export async function exportEvents(sessionIdOrPublicId: string) {
  const session = await prisma.interviewSession.findFirst({
    where: { OR: [{ id: sessionIdOrPublicId }, { publicId: sessionIdOrPublicId }] },
    include: {
      consent: true,
      signals: { orderBy: { createdAt: 'desc' }, take: 10 },
      challenges: { orderBy: { createdAt: 'desc' } },
      events: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!session) throw new Error('Session not found')

  return {
    product: 'PRAMAAN Interview Integrity Layer',
    version: '1.0.0-hackathon',
    generatedAt: new Date().toISOString(),
    session: {
      id: session.id,
      publicId: session.publicId,
      candidate: {
        name: session.candidateName,
        email: session.candidateEmail,
        role: session.candidateRole,
        stage: session.interviewStage,
      },
      status: session.status,
      scenario: session.scenario,
      durationSeconds: session.endedAt && session.startedAt
        ? Math.floor((session.endedAt.getTime() - session.startedAt.getTime()) / 1000)
        : 300,
    },
    consentRecord: session.consent,
    integrityAudit: {
      riskScore: session.riskScore,
      riskStatus: session.riskStatus,
      confidence: session.confidence,
      latestSignals: session.signals[0] || null,
      challengeSummary: session.challenges,
    },
    privacyGuarantees: {
      browserSideProcessing: true,
      rawVideoStored: false,
      humanReviewMandatory: true,
      disclaimer: 'PRAMAAN provides decision-support signals and does not make automatic hiring decisions.',
    },
    timeline: session.events,
  }
}
