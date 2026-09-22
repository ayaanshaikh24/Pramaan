import { io, Socket } from 'socket.io-client'

const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5001'

let socket: Socket | null = null

export function getSocket(sessionId?: string, role: string = 'RECRUITER'): Socket {
  if (!socket) {
    socket = io(SOCKET_SERVER_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      query: {
        sessionId: sessionId || 'PRM-CX0104',
        role,
      },
    })

    socket.on('connect', () => {
      console.log('🔌 Connected to PRAMAAN realtime WebSocket:', socket?.id)
      if (sessionId) {
        socket?.emit('join:session', { sessionId, role })
      }
    })

    socket.on('connect_error', (err) => {
      console.warn('⚠️ Realtime WebSocket connect error (fallback active):', err.message)
    })
  }

  return socket
}

export function subscribeToSession(
  sessionId: string,
  callbacks: {
    onStatusChange?: (data: { status: string }) => void
    onSignalUpdate?: (data: any) => void
    onRiskUpdate?: (data: any) => void
    onChallengeIssued?: (data: any) => void
    onChallengeResult?: (data: any) => void
    onScenarioChanged?: (data: any) => void
    onIntegrityEvent?: (data: any) => void
    onConsentRecorded?: (data: any) => void
    onSessionEnded?: (data: any) => void
  }
) {
  const s = getSocket(sessionId)

  if (callbacks.onStatusChange) s.on('session:status', callbacks.onStatusChange)
  if (callbacks.onSignalUpdate) s.on('signal:update', callbacks.onSignalUpdate)
  if (callbacks.onRiskUpdate) s.on('risk:update', callbacks.onRiskUpdate)
  if (callbacks.onChallengeIssued) s.on('challenge:issued', callbacks.onChallengeIssued)
  if (callbacks.onChallengeResult) s.on('challenge:result', callbacks.onChallengeResult)
  if (callbacks.onScenarioChanged) s.on('scenario:changed', callbacks.onScenarioChanged)
  if (callbacks.onIntegrityEvent) s.on('integrity:event', callbacks.onIntegrityEvent)
  if (callbacks.onConsentRecorded) s.on('consent:recorded', callbacks.onConsentRecorded)
  if (callbacks.onSessionEnded) s.on('session:ended', callbacks.onSessionEnded)

  return () => {
    if (callbacks.onStatusChange) s.off('session:status', callbacks.onStatusChange)
    if (callbacks.onSignalUpdate) s.off('signal:update', callbacks.onSignalUpdate)
    if (callbacks.onRiskUpdate) s.off('risk:update', callbacks.onRiskUpdate)
    if (callbacks.onChallengeIssued) s.off('challenge:issued', callbacks.onChallengeIssued)
    if (callbacks.onChallengeResult) s.off('challenge:result', callbacks.onChallengeResult)
    if (callbacks.onScenarioChanged) s.off('scenario:changed', callbacks.onScenarioChanged)
    if (callbacks.onIntegrityEvent) s.off('integrity:event', callbacks.onIntegrityEvent)
    if (callbacks.onConsentRecorded) s.off('consent:recorded', callbacks.onConsentRecorded)
    if (callbacks.onSessionEnded) s.off('session:ended', callbacks.onSessionEnded)
  }
}
