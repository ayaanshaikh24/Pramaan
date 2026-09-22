import { useCallback, useRef, useState } from 'react'
import {
  SessionState,
  IntegrityStatus,
  ChallengeStatus,
  TimelineEvent,
  SignalScores,
  Scenario,
  FacePresenceState,
  LiveFaceState,
} from '@/types/pramaan'

export interface SessionContract {
  sessionId: string
  mode: 'LIVE' | 'DEMO'
  demoScenario?: Scenario
  state: SessionState
  cameraStatus: 'NOT_STARTED' | 'ACTIVE' | 'STOPPED' | 'PERMISSION_DENIED'
  microphoneStatus: 'NOT_STARTED' | 'ACTIVE' | 'UNAVAILABLE'
  faceStatus: LiveFaceState
  challengeStatus: ChallengeStatus
  challengeResult: ChallengeStatus | null
  riskScore: number | null
  riskStatus: IntegrityStatus
  confidence: 'High' | 'Medium' | 'Low' | 'Not available' | null
  evidenceQuality: 'Good' | 'Poor' | 'Degraded' | 'Not available'
  signalSource: 'Browser sensor' | 'Demo scenario'
  scores: SignalScores
  visualEvidenceAvailable: boolean
  audioEvidenceAvailable: boolean
  explanation: string
  timeline: TimelineEvent[]
  faceState: FacePresenceState
  challengePrompt: string
  countdownSeconds: number
}

type Listener = (session: SessionContract) => void

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
    mode: 'LIVE',
    state: 'PRECHECK',
    cameraStatus: 'NOT_STARTED',
    microphoneStatus: 'NOT_STARTED',
    faceStatus: 'WAITING_FOR_CAMERA',
    challengeStatus: 'pending',
    challengeResult: null,
    riskScore: null,
    riskStatus: 'Not evaluated',
    confidence: null,
    evidenceQuality: 'Not available',
    signalSource: 'Browser sensor',
    scores: { ...EMPTY_SCORES },
    visualEvidenceAvailable: false,
    audioEvidenceAvailable: false,
    explanation: 'Waiting for browser camera and microphone sensor signals to begin biometric integrity evaluation.',
    timeline: [
      { time: '00:00', title: 'Candidate joined', description: 'Session initialized. Device verification and consent pending.', type: 'info' },
      { time: '00:00', title: 'Consent pending', description: 'Waiting for candidate biometric consent.', type: 'info' },
    ],
    faceState: { ...INITIAL_FACE_STATE },
    challengePrompt: 'Turn your head slightly to the right and say BLUE 47.',
    countdownSeconds: 20,
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

export function useSessionState(sessionId: string) {
  const [contract, setContract] = useState<SessionContract>(() => createInitialContract(sessionId))
  const listenersRef = useRef<Set<Listener>>(new Set())
  const contractRef = useRef(contract)
  contractRef.current = contract

  const notify = useCallback(() => {
    const c = contractRef.current
    listenersRef.current.forEach((fn) => fn(c))
  }, [])

  const update = useCallback((partial: Partial<SessionContract>) => {
    setContract((prev) => {
      const next = { ...prev, ...partial }
      contractRef.current = next
      return next
    })
    notify()
  }, [notify])

  const recentEventTitlesRef = useRef<Map<string, number>>(new Map())

  const addTimelineEvent = useCallback((event: Omit<TimelineEvent, 'id'>) => {
    const now = Date.now()
    const lastSeen = recentEventTitlesRef.current.get(event.title) ?? 0
    if (now - lastSeen < 5000) return
    recentEventTitlesRef.current.set(event.title, now)

    setContract((prev) => {
      const next: SessionContract = {
        ...prev,
        timeline: [
          { ...event, time: event.time || formatTime(new Date()) },
          ...prev.timeline,
        ],
      }
      contractRef.current = next
      return next
    })
    notify()
  }, [notify])

  const setChallengeStatus = useCallback((status: ChallengeStatus, result?: ChallengeStatus | null) => {
    setContract((prev) => {
      const next: SessionContract = {
        ...prev,
        challengeStatus: status,
        challengeResult: result ?? (status === 'pending' ? null : status),
      }
      contractRef.current = next
      return next
    })
    notify()
  }, [])

  const setFaceState = useCallback((faceStateOrFn: FacePresenceState | ((prev: FacePresenceState) => FacePresenceState)) => {
    setContract((prev) => {
      const next = typeof faceStateOrFn === 'function' ? faceStateOrFn(prev.faceState) : faceStateOrFn
      const updated: SessionContract = { ...prev, faceState: next, faceStatus: next.liveState }
      contractRef.current = updated
      return updated
    })
    notify()
  }, [])

  const setScores = useCallback((scores: SignalScores) => {
    setContract((prev) => {
      const next: SessionContract = { ...prev, scores }
      contractRef.current = next
      return next
    })
    notify()
  }, [])

  const setRisk = useCallback((
    riskScore: number | null,
    riskStatus: IntegrityStatus,
    confidence: 'High' | 'Medium' | 'Low' | 'Not available' | null,
    explanation: string
  ) => {
    setContract((prev) => {
      const evidenceQuality =
        riskScore === null ? 'Not available'
        : riskScore >= 60 ? 'Good'
        : riskScore >= 30 ? 'Degraded'
        : 'Poor'
      const next: SessionContract = {
        ...prev,
        riskScore,
        riskStatus,
        confidence,
        evidenceQuality,
        explanation: explanation || prev.explanation,
      }
      contractRef.current = next
      return next
    })
    notify()
  }, [])

  const setMode = useCallback((mode: 'LIVE' | 'DEMO', scenario?: Scenario) => {
    setContract((prev) => {
      const next: SessionContract = {
        ...prev,
        mode,
        demoScenario: mode === 'DEMO' ? scenario : undefined,
        signalSource: mode === 'DEMO' ? 'Demo scenario' : 'Browser sensor',
      }
      contractRef.current = next
      return next
    })
    notify()
  }, [])

  const subscribe = useCallback((fn: Listener) => {
    listenersRef.current.add(fn)
    fn(contractRef.current)
    return () => { listenersRef.current.delete(fn) }
  }, [])

  return {
    contract,
    update,
    addTimelineEvent,
    setChallengeStatus,
    setFaceState,
    setScores,
    setRisk,
    setMode,
    subscribe,
  }
}
