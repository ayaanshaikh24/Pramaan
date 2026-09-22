import { z } from 'zod'

export const demoLoginSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
})

export type DemoLoginInput = z.infer<typeof demoLoginSchema>
