import { Response, NextFunction } from 'express'
import * as eventService from '../services/eventService.js'
import { AuthenticatedRequest } from '../middleware/authMiddleware.js'

export async function handleGetEvents(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { sessionId } = req.params
    const filter = req.query.filter as string | undefined
    const events = await eventService.getEvents(sessionId, filter)
    res.json({ events })
  } catch (err) {
    next(err)
  }
}

export async function handleCreateEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { sessionId } = req.params
    const event = await eventService.createEvent(sessionId, req.body)
    res.status(201).json({ event })
  } catch (err) {
    next(err)
  }
}

export async function handleExportEvents(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { sessionId } = req.params
    const data = await eventService.exportEvents(sessionId)

    res.setHeader('Content-Type', 'application/json')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="pramaan-audit-${sessionId}-${Date.now()}.json"`
    )
    res.send(JSON.stringify(data, null, 2))
  } catch (err) {
    next(err)
  }
}
