export type Scenario = 'normal' | 'proxy' | 'low-bandwidth'

export type IntegrityStatus =
  | 'Not evaluated'
  | 'Low Risk'
  | 'Review Recommended'
  | 'Insufficient Evidence'
  | 'High Concern'

export type ChallengeStatus = 'pending' | 'waiting_for_response' | 'passed' | 'partial' | 'failed'

export type EventType = 'normal' | 'warning' | 'critical' | 'info'

export interface TimelineEvent {
  id?: string
  time: string
  title: string
  description: string
  type: EventType
}

export interface SignalScores {
  face: number | null // null denotes "Low confidence" or "Waiting for camera"
  voice: number | null
  challenge: number | null
  stream: number | null
}

export interface ScenarioData {
  name: string
  risk: number | null // null represents "Not evaluated"
  status: IntegrityStatus
  confidence: 'High' | 'Medium' | 'Low' | 'Not available'
  scores: SignalScores
  quality: 'Good' | 'Poor' | 'Degraded' | 'Not available'
  challenge: ChallengeStatus
  explanation: string
  events: TimelineEvent[]
}

export interface CandidateInfo {
  id: string
  name: string
  role: string
  stage: string
  duration: string
}

export type LiveFaceState =
  | 'WAITING_FOR_CAMERA'
  | 'FACE_VISIBLE'
  | 'FACE_NOT_VISIBLE'
  | 'CAMERA_PERMISSION_DENIED'
  | 'DETECTOR_LOADING'
  | 'DETECTOR_UNAVAILABLE'

export interface FacePresenceState {
  liveState: LiveFaceState
  isLiveActive: boolean
  faceVisible: boolean
  confidence: number
  motionScore: number | null
  isCovered: boolean
  isOutsideFrame: boolean
  missingDurationMs: number
  detectorStatus: 'loading' | 'ready' | 'unavailable'
  detectorType: 'mediapipe' | 'native' | 'none'
  box?: { x: number; y: number; width: number; height: number }
  landmarks?: Array<{ x: number; y: number; z: number }>
  wasRestored?: boolean
}

