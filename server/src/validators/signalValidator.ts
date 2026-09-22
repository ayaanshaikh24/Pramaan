import { z } from 'zod'

const forbiddenMediaFields = new Set([
  'video',
  'audio',
  'frame',
  'frames',
  'image',
  'images',
  'recording',
  'recordings',
  'blob',
  'base64',
  'rawvideo',
  'rawaudio',
  'raw_video',
  'raw_audio',
  'mediastream',
  'media_stream',
  'camerastream',
  'micstream',
])

const allowedMetadataFields = new Set([
  'facemotionscore',
  'lipsyncscore',
  'challengescore',
  'streamqualityscore',
  'visualevidenceavailable',
  'audioevidenceavailable',
  'clienttimestamp',
])

export const signalSnapshotSchema = z
  .object({
    faceMotionScore: z.number().min(0).max(100).nullable().optional(),
    lipSyncScore: z.number().min(0).max(100).nullable().optional(),
    challengeScore: z.number().min(0).max(100).nullable().optional(),
    streamQualityScore: z.number().min(0).max(100).nullable().optional(),
    visualEvidenceAvailable: z.boolean().default(true).optional(),
    audioEvidenceAvailable: z.boolean().default(true).optional(),
    clientTimestamp: z.string().optional(),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    // Strictly verify no raw media fields exist in the payload
    const keys = Object.keys(data)
    for (const key of keys) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9_]/g, '')
      if (allowedMetadataFields.has(normalizedKey)) {
        continue
      }
      if (
        forbiddenMediaFields.has(normalizedKey) ||
        normalizedKey.startsWith('raw') ||
        normalizedKey.includes('base64') ||
        normalizedKey.includes('recording') ||
        normalizedKey.includes('stream_data')
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Privacy policy violation: Raw media field '${key}' is prohibited. PRAMAAN only processes derived numeric signal telemetry.`,
          path: [key],
        })
      }
    }
  })

export type SignalSnapshotInput = z.infer<typeof signalSnapshotSchema>
