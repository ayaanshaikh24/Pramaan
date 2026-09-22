import { Router } from 'express'
import { handleGetReport } from '../controllers/reportController.js'
import { requireRecruiter } from '../middleware/authMiddleware.js'

const router = Router()

router.get('/:reportId', requireRecruiter, handleGetReport)

export default router
