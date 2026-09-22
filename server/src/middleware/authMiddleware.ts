import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { AuthUser, CandidateTokenPayload } from '../types/index.js'

export interface AuthenticatedRequest extends Request {
  user?: AuthUser
  candidate?: CandidateTokenPayload
}

export function generateRecruiterToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: '7d' }
  )
}

export function generateCandidateToken(payload: CandidateTokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '24h' })
}

export async function requireRecruiter(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or malformed authorization token' })
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, config.jwtSecret) as AuthUser

    if (!decoded || !decoded.id) {
      return res.status(401).json({ error: 'Invalid authentication token' })
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    })

    if (!user) {
      return res.status(401).json({ error: 'Authenticated user no longer exists' })
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as any,
    }

    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired authorization token' })
  }
}

export async function requireSessionAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const sessionId = req.params.sessionId || req.body.sessionId
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // In hackathon demo mode, if unauthenticated, allow candidate or demo access if session exists
      if (sessionId) {
        const session = await prisma.interviewSession.findFirst({
          where: { OR: [{ id: sessionId }, { publicId: sessionId }] },
        })
        if (session) {
          req.candidate = {
            sessionId: session.id,
            candidateName: session.candidateName,
            role: 'CANDIDATE',
          }
          return next()
        }
      }
      return res.status(401).json({ error: 'Session authentication required' })
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, config.jwtSecret) as any

    // 1. Recruiter access
    if (decoded.role === 'RECRUITER' || decoded.role === 'ADMIN') {
      const user = await prisma.user.findUnique({ where: { id: decoded.id } })
      if (user) {
        req.user = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as any,
        }
        return next()
      }
    }

    // 2. Candidate access (scoped to their specific session)
    if (decoded.role === 'CANDIDATE') {
      if (sessionId && decoded.sessionId !== sessionId) {
        // Check if publicId matches
        const session = await prisma.interviewSession.findFirst({
          where: { OR: [{ id: sessionId }, { publicId: sessionId }] },
        })
        if (!session || session.id !== decoded.sessionId) {
          return res.status(403).json({ error: 'Candidate cannot access unauthorized session' })
        }
      }
      req.candidate = decoded
      return next()
    }

    return res.status(403).json({ error: 'Access denied to session' })
  } catch (err) {
    return res.status(401).json({ error: 'Invalid session access token' })
  }
}
