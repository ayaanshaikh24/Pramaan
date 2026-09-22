import { z } from 'zod'

export const createSessionSchema = z.object({
  candidateName: z.string().min(2).max(100),
  candidateEmail: z.string().email(),
  candidateRole: z.string().min(2).max(100),
  interviewStage: z.string().min(2).max(100),
})

export const updateStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'ENDED']),
})

export const recordConsentSchema = z.object({
  cameraConsent: z.boolean(),
  microphoneConsent: z.boolean(),
  signalProcessingConsent: z.boolean(),
  consentVersion: z.string().default('v1'),
})

export const scenarioSchema = z.object({
  scenario: z.enum(['NORMAL', 'PROXY', 'LOW_BANDWIDTH']),
})
