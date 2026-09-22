import { Request, Response, NextFunction } from 'express'
import { demoLoginSchema } from '../validators/authValidator.js'
import * as authService from '../services/authService.js'
import { AuthenticatedRequest } from '../middleware/authMiddleware.js'

export async function handleDemoLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = demoLoginSchema.parse(req.body)
    const result = await authService.demoLogin(validated)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export async function handleLogout(req: Request, res: Response) {
  res.json({ success: true, message: 'Logged out successfully' })
}

export async function handleGetMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const user = await authService.getMe(req.user.id)
    res.json({ user })
  } catch (err) {
    next(err)
  }
}
