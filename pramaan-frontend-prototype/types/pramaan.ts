export type Scenario = 'normal' | 'proxy' | 'low-bandwidth'

export type IntegrityStatus =
  | 'Not evaluated'
  | 'Low Risk'
  | 'Review Recommended'
  | 'Insufficient Evidence'
  | 'High Concern'

export type ChallengeStatus = 'pending' | 'waiting_for_response' | 'passed' | 'partial' | 'failed' | 'expired'

export type EventType = 'normal' | 'warning' | 'critical' | 'info'

export interface TimelineEvent {
  time: string
  title: string
  description: string
  type: EventType
}

export interface SignalScores {
  face: number | null
  voice: number | null
  challenge: number | null
  stream: number | null
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
}
