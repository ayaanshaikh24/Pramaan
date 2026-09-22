import { useCallback, useRef, useState } from 'react'
import {
  IntegrityStatus,
  ChallengeStatus,
  TimelineEvent,
  SignalScores,
  FacePresenceState,
} from '@/types/pramaan'

export interface SessionContract {
  sessionId: string
  cameraStatus: 'NOT_STARTED' | 'ACTIVE' | 'STOPPED' | 'PERMISSION_DENIED'
  challengeStatus: ChallengeStatus
  riskScore: number | null
  riskStatus: IntegrityStatus
  confidence: 'High' | 'Medium' | 'Low' | 'Not available' | null
  scores: SignalScores
  explanation: string
  timeline: TimelineEvent[]
  faceState: FacePresenceState
  challengePrompt: string
}

const EMPTY_SCORES: SignalScores = { face: null, voice: null, challenge: null, stream: null }

const INITIAL_FACE_STATE: FacePresenceState = {
  liveState: 'WAITING_FOR_CAMERA',
  isLiveActive: false,
  faceVisible: false,
  confidence: 0,
  motionScore: null,
  isCovered: false,
  isOutsideFrame: false,
  missingDurationMs: 0,
  detectorStatus: 'loading',
  detectorType: 'none',
}

function createInitialContract(sessionId: string): SessionContract {
  return {
    sessionId,
    cameraStatus: 'NOT_STARTED',
    challengeStatus: 'pending',
    riskScore: null,
    riskStatus: 'Not evaluated',
    confidence: null,
    scores: { ...EMPTY_SCORES },
    explanation: 'Waiting for camera and microphone signals to begin biometric integrity evaluation.',
    timeline: [
      { time: '00:00', title: 'Candidate joined', description: 'Session initialized. Device verification and consent pending.', type: 'info' },
      { time: '00:00', title: 'Consent pending', description: 'Waiting for candidate biometric consent.', type: 'info' },
    ],
    faceState: { ...INITIAL_FACE_STATE },
    challengePrompt: 'Turn your head slightly to the right and say BLUE 47.',
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

export function useSessionState(sessionId: string) {
  const [contract, setContract] = useState<SessionContract>(() => createInitialContract(sessionId))
  const contractRef = useRef(contract)
  contractRef.current = contract

  const update = useCallback((partial: Partial<SessionContract>) => {
    setContract((prev) => ({ ...prev, ...partial }))
  }, [])

  const recentEventTitlesRef = useRef<Map<string, number>>(new Map())

  const addTimelineEvent = useCallback((event: Omit<TimelineEvent, 'id'>) => {
    const now = Date.now()
    const lastSeen = recentEventTitlesRef.current.get(event.title) ?? 0
    if (now - lastSeen < 5000) return
    recentEventTitlesRef.current.set(event.title, now)

    setContract((prev) => ({
      ...prev,
      timeline: [{ ...event, time: event.time || formatTime(new Date()) }, ...prev.timeline],
    }))
  }, [])

  const setChallengeStatus = useCallback((status: ChallengeStatus) => {
    setContract((prev) => ({ ...prev, challengeStatus: status }))
  }, [])

  const setFaceState = useCallback((faceStateOrFn: FacePresenceState | ((prev: FacePresenceState) => FacePresenceState)) => {
    setContract((prev) => {
      const next = typeof faceStateOrFn === 'function' ? faceStateOrFn(prev.faceState) : faceStateOrFn
      return { ...prev, faceState: next }
    })
  }, [])

  const setScores = useCallback((scores: SignalScores) => {
    setContract((prev) => ({ ...prev, scores }))
  }, [])

  return {
    contract,
    update,
    addTimelineEvent,
    setChallengeStatus,
    setFaceState,
    setScores,
  }
}
