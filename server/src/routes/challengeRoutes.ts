import { Router } from 'express'
import { handleSubmitResult } from '../controllers/challengeController.js'

const router = Router()

router.post('/:challengeId/result', handleSubmitResult)

export default router
