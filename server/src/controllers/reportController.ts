import { Response, NextFunction } from 'express'
import * as reportService from '../services/reportService.js'
import { AuthenticatedRequest } from '../middleware/authMiddleware.js'

export async function handleGenerateReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (req.candidate) {
      return res.status(403).json({ error: 'Candidate cannot generate or access recruiter reports' })
    }
    const { sessionId } = req.params
    const generatedBy = req.user?.email || 'RECRUITER'
    const report = await reportService.generateSessionReport(sessionId, generatedBy)
    res.status(201).json({ report })
  } catch (err) {
    next(err)
  }
}

export async function handleGetReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { reportId } = req.params
    const report = await reportService.getReportById(reportId)
    res.json({ report })
  } catch (err) {
    next(err)
  }
}
