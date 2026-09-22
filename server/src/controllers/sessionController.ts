import { Response, NextFunction } from 'express'
import {
  createSessionSchema,
  updateStatusSchema,
  recordConsentSchema,
  scenarioSchema,
} from '../validators/sessionValidator.js'
import * as sessionService from '../services/sessionService.js'
import { AuthenticatedRequest } from '../middleware/authMiddleware.js'

export async function handleCreateSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const validated = createSessionSchema.parse(req.body)
    const recruiterId = req.user?.id || 'demo-recruiter'
    const result = await sessionService.createSession(recruiterId, validated)
    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
}

export async function handleGetSessions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const recruiterId = req.user?.id
    if (!recruiterId) return res.status(401).json({ error: 'Recruiter authentication required' })
    const sessions = await sessionService.getRecruiterSessions(recruiterId)
    res.json({ sessions })
  } catch (err) {
    next(err)
  }
}

export async function handleGetSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { sessionId } = req.params
    const session = await sessionService.getSession(sessionId)
    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }
    res.json({ session })
  } catch (err) {
    next(err)
  }
}

export async function handleUpdateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { sessionId } = req.params
    const validated = updateStatusSchema.parse(req.body)
    const updated = await sessionService.updateSessionStatus(sessionId, validated.status)
    res.json({ session: updated })
  } catch (err) {
    next(err)
  }
}

export async function handleStartSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { sessionId } = req.params
    const started = await sessionService.startSession(sessionId)
    res.json({ session: started })
  } catch (err) {
    next(err)
  }
}

export async function handleEndSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { sessionId } = req.params
    const result = await sessionService.endSession(sessionId)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export async function handleRecordConsent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { sessionId } = req.params
    const validated = recordConsentSchema.parse(req.body)
    const consent = await sessionService.recordConsent(sessionId, validated)
    res.status(201).json({ consent })
  } catch (err) {
    next(err)
  }
}

export async function handleApplyScenario(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { sessionId } = req.params
    const validated = scenarioSchema.parse(req.body)
    const result = await sessionService.applyScenario(sessionId, validated.scenario)
    res.json(result)
  } catch (err) {
    next(err)
  }
}
