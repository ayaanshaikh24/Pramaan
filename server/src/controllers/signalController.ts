import { Response, NextFunction } from 'express'
import { signalSnapshotSchema } from '../validators/signalValidator.js'
import * as signalService from '../services/signalService.js'
import { AuthenticatedRequest } from '../middleware/authMiddleware.js'

export async function handleIngestSignals(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { sessionId } = req.params
    const validated = signalSnapshotSchema.parse(req.body)
    const result = await signalService.ingestSignal(sessionId, validated)
    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
}
