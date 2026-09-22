import { prisma } from '../config/prisma.js'
import { getSession } from './sessionService.js'

export async function generateSessionReport(sessionIdOrPublicId: string, generatedBy: string = 'RECRUITER') {
  const session = await prisma.interviewSession.findFirst({
    where: { OR: [{ id: sessionIdOrPublicId }, { publicId: sessionIdOrPublicId }] },
    include: {
      consent: true,
      signals: { orderBy: { createdAt: 'desc' }, take: 1 },
      challenges: { orderBy: { createdAt: 'desc' } },
      events: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!session) throw new Error('Session not found')

  const reportPayload = {
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
      startedAt: session.startedAt,
      endedAt: session.endedAt || new Date(),
    },
    consentState: session.consent,
    integrityAudit: {
      finalRiskScore: session.riskScore,
      finalRiskStatus: session.riskStatus,
      confidence: session.confidence,
      latestSignalSnapshot: session.signals[0] || null,
      challengeResults: session.challenges,
    },
    evidenceTimeline: session.events,
    privacyMetadata: {
      browserSideProcessing: true,
      rawVideoStored: false,
      humanReviewMandatory: true,
      localSessionSignalsOnly: true,
    },
    disclaimer: 'PRAMAAN provides decision-support signals and does not make automatic hiring decisions.',
  }

  const report = await prisma.report.create({
    data: {
      sessionId: session.id,
      generatedBy,
      reportData: JSON.stringify(reportPayload),
    },
  })

  return {
    id: report.id,
    sessionId: report.sessionId,
    generatedAt: report.generatedAt,
    reportData: reportPayload,
  }
}

export async function getReportById(reportId: string) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { session: true },
  })

  if (!report) throw new Error('Report not found')

  return {
    id: report.id,
    sessionId: report.sessionId,
    generatedBy: report.generatedBy,
    generatedAt: report.generatedAt,
    reportData: JSON.parse(report.reportData),
  }
}
