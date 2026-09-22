import { Router } from 'express'
import { handleDemoLogin, handleLogout, handleGetMe } from '../controllers/authController.js'
import { requireRecruiter } from '../middleware/authMiddleware.js'
import { authLimiter } from '../middleware/rateLimiter.js'

const router = Router()

router.post('/demo-login', authLimiter, handleDemoLogin)
router.post('/logout', handleLogout)
router.get('/me', requireRecruiter, handleGetMe)

export default router
