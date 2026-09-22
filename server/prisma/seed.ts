import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding PRAMAAN database...')

  // 1. Create or update Demo Recruiter
  const recruiter = await prisma.user.upsert({
    where: { email: 'recruiter@pramaan.demo' },
    update: {},
    create: {
      email: 'recruiter@pramaan.demo',
      name: 'Demo Recruiter',
      role: 'RECRUITER',
    },
  })

  console.log(`👤 Recruiter ready: ${recruiter.email} (${recruiter.id})`)

  // 2. Clear existing demo session if present for clean idempotent seeding
  const existingSession = await prisma.interviewSession.findUnique({
    where: { publicId: 'PRM-CX0104' },
  })

  if (existingSession) {
    await prisma.interviewSession.delete({
      where: { id: existingSession.id },
    })
  }

  // 3. Create Demo Session
  const session = await prisma.interviewSession.create({
    data: {
      publicId: 'PRM-CX0104',
      candidateName: 'Candidate #CX0104',
      candidateEmail: 'candidate@example.com',
      candidateRole: 'Junior Frontend Engineer',
      interviewStage: 'Technical Round 1',
      status: 'ACTIVE',
      scenario: 'NORMAL',
      riskScore: 12,
      riskStatus: 'LOW_RISK',
      confidence: 'HIGH',
      startedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      recruiterId: recruiter.id,
    },
  })

  console.log(`📋 Session created: ${session.publicId} (${session.id})`)

  // 4. Create Candidate Access Token
  const rawToken = 'demo-candidate-token-cx0104'
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  await prisma.candidateAccess.create({
    data: {
      sessionId: session.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  })

  // 5. Create Consent Record
  await prisma.consentRecord.create({
    data: {
      sessionId: session.id,
      candidateName: session.candidateName,
      cameraConsent: true,
      microphoneConsent: true,
      signalProcessingConsent: true,
      consentVersion: 'v1',
      consentedAt: new Date(Date.now() - 5 * 60 * 1000),
    },
  })

  // 6. Create Initial Signal Snapshot
  await prisma.signalSnapshot.create({
    data: {
      sessionId: session.id,
      faceMotionScore: 94,
      lipSyncScore: 96,
      challengeScore: 100,
      streamQualityScore: 92,
      visualEvidenceAvailable: true,
      audioEvidenceAvailable: true,
      confidence: 'HIGH',
    },
  })

  // 7. Create Demo Challenge
  await prisma.challenge.create({
    data: {
      sessionId: session.id,
      prompt: 'Turn your head slightly to the right and say: BLUE 47',
      status: 'PASSED',
      issuedAt: new Date(Date.now() - 25 * 1000),
      completedAt: new Date(Date.now() - 19 * 1000),
      responseMetadata: JSON.stringify({
        responseDurationMs: 4200,
        result: 'PASSED',
      }),
    },
  })

  // 8. Create Initial Integrity Events
  const demoEvents = [
    {
      timestampSeconds: 0,
      type: 'SYSTEM',
      title: 'Candidate joined',
      description: 'Session initialized. Device verification and consent recorded.',
      severity: 'info',
    },
    {
      timestampSeconds: 10,
      type: 'VERIFIED',
      title: 'Baseline created',
      description: 'Local session signals initialized in browser memory.',
      severity: 'normal',
    },
    {
      timestampSeconds: 135,
      type: 'VERIFIED',
      title: 'Natural interaction detected',
      description: 'Natural facial motion and speech timing aligned.',
      severity: 'normal',
    },
    {
      timestampSeconds: 275,
      type: 'SYSTEM',
      title: 'Random challenge issued',
      description: 'Random live presence challenge dispatched to candidate.',
      severity: 'info',
    },
    {
      timestampSeconds: 281,
      type: 'VERIFIED',
      title: 'Challenge passed',
      description: 'Response recorded with verified live interaction.',
      severity: 'normal',
    },
    {
      timestampSeconds: 300,
      type: 'VERIFIED',
      title: 'Integrity status updated',
      description: 'All 4 signal vectors consistent and within normal parameters.',
      severity: 'normal',
    },
  ]

  for (const ev of demoEvents) {
    await prisma.integrityEvent.create({
      data: {
        sessionId: session.id,
        ...ev,
      },
    })
  }

  // 9. Initial Audit Log
  await prisma.auditLog.create({
    data: {
      sessionId: session.id,
      actorType: 'SYSTEM',
      action: 'SESSION_INITIALIZED',
      metadata: JSON.stringify({ publicId: session.publicId, recruiter: recruiter.email }),
    },
  })

  console.log('✅ Seeding completed successfully.')
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
