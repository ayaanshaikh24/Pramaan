import { z } from 'zod'

export const challengeResultSchema = z.object({
  result: z.enum(['PASSED', 'PARTIAL', 'FAILED']),
  responseDurationMs: z.number().nonnegative().optional(),
  clientTimestamp: z.string().optional(),
})

export type ChallengeResultInput = z.infer<typeof challengeResultSchema>
