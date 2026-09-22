import { prisma } from '../config/prisma.js'
import { generateRecruiterToken } from '../middleware/authMiddleware.js'
import { DemoLoginInput } from '../validators/authValidator.js'
import { AuthUser } from '../types/index.js'

export async function demoLogin(input: DemoLoginInput) {
  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: { name: input.name },
    create: {
      email: input.email,
      name: input.name,
      role: 'RECRUITER',
    },
  })

  const authUser: AuthUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as any,
  }

  const token = generateRecruiterToken(authUser)

  await prisma.auditLog.create({
    data: {
      actorType: 'RECRUITER',
      action: 'DEMO_LOGIN',
      metadata: JSON.stringify({ userId: user.id, email: user.email }),
    },
  })

  return {
    user: authUser,
    token,
  }
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  })
  return user
}
