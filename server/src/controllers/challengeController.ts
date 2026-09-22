import { Response, NextFunction } from 'express'
import { challengeResultSchema } from '../validators/challengeValidator.js'
import * as challengeService from '../services/challengeService.js'
import { AuthenticatedRequest } from '../middleware/authMiddleware.js'

export async function handleIssueChallenge(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { sessionId } = req.params
    const challenge = await challengeService.issueChallenge(sessionId)
    res.status(201).json({ challenge })
  } catch (err) {
    next(err)
  }
}

export async function handleSubmitResult(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { challengeId } = req.params
    const validated = challengeResultSchema.parse(req.body)
    const result = await challengeService.submitChallengeResult(challengeId, validated)
    res.json(result)
  } catch (err) {
    next(err)
  }
}
