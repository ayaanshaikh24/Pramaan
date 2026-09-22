export type UserRole = 'RECRUITER' | 'ADMIN'
export type SessionStatus = 'CREATED' | 'ACTIVE' | 'PAUSED' | 'ENDED'
export type ScenarioType = 'NORMAL' | 'PROXY' | 'LOW_BANDWIDTH'
export type RiskStatus = 'LOW_RISK' | 'REVIEW_RECOMMENDED' | 'INSUFFICIENT_EVIDENCE' | 'HIGH_CONCERN'
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW'
export type ChallengeStatus = 'ISSUED' | 'PASSED' | 'PARTIAL' | 'FAILED' | 'EXPIRED'
export type EventType = 'SYSTEM' | 'VERIFIED' | 'WARNING' | 'REVIEW'

export interface SignalInputs {
  faceMotionScore?: number | null
  lipSyncScore?: number | null
  challengeScore?: number | null
  streamQualityScore?: number | null
  visualEvidenceAvailable?: boolean
  audioEvidenceAvailable?: boolean
}

export interface ScoringResult {
  riskScore: number
  riskStatus: RiskStatus
  confidence: ConfidenceLevel
  explanation: string
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
}

export interface CandidateTokenPayload {
  sessionId: string
  candidateName: string
  role: 'CANDIDATE'
}
