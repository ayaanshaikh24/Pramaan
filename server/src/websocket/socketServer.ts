import { Server as HttpServer } from 'http'
import { Server as SocketIOServer, Socket } from 'socket.io'
import { config } from '../config/env.js'

let io: SocketIOServer | null = null

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: [config.corsOrigin, config.frontendUrl, 'http://localhost:3000'],
      methods: ['GET', 'POST', 'PATCH'],
      credentials: true,
    },
  })

  io.on('connection', (socket: Socket) => {
    const sessionId = socket.handshake.query.sessionId as string
    const role = socket.handshake.query.role as string || 'VIEWER'

    if (sessionId) {
      socket.join(`session:${sessionId}`)
      console.log(`🔌 Socket ${socket.id} joined room session:${sessionId} as ${role}`)

      // Notify room
      socket.to(`session:${sessionId}`).emit('session:joined', {
        socketId: socket.id,
        role,
        timestamp: new Date().toISOString(),
      })
    }

    socket.on('join:session', (data: { sessionId: string; role?: string }) => {
      if (data?.sessionId) {
        socket.join(`session:${data.sessionId}`)
        console.log(`🔌 Socket ${socket.id} explicitly joined session:${data.sessionId}`)
      }
    })

    socket.on('disconnect', () => {
      // Clean disconnect
    })
  })

  return io
}

export function getIO(): SocketIOServer | null {
  return io
}

/**
 * Broadcast an event to all clients in a session room
 */
export function broadcastSessionEvent(sessionId: string, event: string, payload: any) {
  if (!io) return
  // Broadcast to both internal UUID and publicId room if any
  io.to(`session:${sessionId}`).emit(event, payload)
}
