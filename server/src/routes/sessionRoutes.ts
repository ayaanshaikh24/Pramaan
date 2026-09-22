import { Router } from 'express'
import {
  handleCreateSession,
  handleGetSessions,
  handleGetSession,
  handleUpdateStatus,
  handleStartSession,
  handleEndSession,
  handleRecordConsent,
  handleApplyScenario,
} from '../controllers/sessionController.js'
import { handleIngestSignals } from '../controllers/signalController.js'
import { handleIssueChallenge } from '../controllers/challengeController.js'
import {
  handleGetEvents,
  handleCreateEvent,
  handleExportEvents,
} from '../controllers/eventController.js'
import { handleGenerateReport } from '../controllers/reportController.js'
import { requireRecruiter, requireSessionAccess } from '../middleware/authMiddleware.js'

const router = Router()

// Recruiter session management
router.post('/', requireRecruiter, handleCreateSession)
router.get('/', requireRecruiter, handleGetSessions)

// Session-specific actions (Recruiter or Candidate)
router.get('/:sessionId', requireSessionAccess, handleGetSession)
router.patch('/:sessionId/status', requireSessionAccess, handleUpdateStatus)
router.post('/:sessionId/start', requireSessionAccess, handleStartSession)
router.post('/:sessionId/end', requireSessionAccess, handleEndSession)
router.post('/:sessionId/consent', requireSessionAccess, handleRecordConsent)
router.post('/:sessionId/scenario', requireSessionAccess, handleApplyScenario)
router.post('/:sessionId/signals', requireSessionAccess, handleIngestSignals)
router.post('/:sessionId/challenges', requireSessionAccess, handleIssueChallenge)
router.get('/:sessionId/events', requireSessionAccess, handleGetEvents)
router.post('/:sessionId/events', requireSessionAccess, handleCreateEvent)
router.get('/:sessionId/events/export', requireSessionAccess, handleExportEvents)
router.post('/:sessionId/report', requireSessionAccess, handleGenerateReport)

export default router
