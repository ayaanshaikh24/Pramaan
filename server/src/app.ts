import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { config } from './config/env.js'
import { apiLimiter } from './middleware/rateLimiter.js'
import { errorHandler } from './middleware/errorMiddleware.js'

import authRoutes from './routes/authRoutes.js'
import sessionRoutes from './routes/sessionRoutes.js'
import challengeRoutes from './routes/challengeRoutes.js'
import reportRoutes from './routes/reportRoutes.js'

export const app = express()

// Security Headers
app.use(
  helmet({
    contentSecurityPolicy: false, // allow local dev framing / websocket
  })
)

// CORS Configuration
app.use(
  cors({
    origin: [config.corsOrigin, config.frontendUrl, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

// Body parser with 1MB maximum size
app.use(express.json({ limit: '1mb' }))

// Rate limiting
app.use('/api', apiLimiter)

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    product: 'PRAMAAN Integrity Backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    product: 'PRAMAAN Integrity Backend',
    timestamp: new Date().toISOString(),
  })
})

// Mount API Routes
app.use('/api/auth', authRoutes)
app.use('/api/sessions', sessionRoutes)
app.use('/api/challenges', challengeRoutes)
app.use('/api/reports', reportRoutes)

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` })
})

// Centralized Error Handler
app.use(errorHandler)
