import http from 'http'
import { app } from './app.js'
import { config } from './config/env.js'
import { initSocketServer } from './websocket/socketServer.js'

const server = http.createServer(app)

// Initialize Socket.IO
initSocketServer(server)

server.listen(config.port, () => {
  console.log(`🛡️  PRAMAAN Integrity Backend listening on http://localhost:${config.port}`)
  console.log(`📡 Socket.IO realtime server running`)
  console.log(`🔒 Privacy Invariant: Raw media transmission permanently disabled`)
})
