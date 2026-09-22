/**
 * PRAMAAN API Client
 * Connects the browser integrity client to the Node.js/Express backend.
 * Provides resilient fallbacks when backend is unreachable.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function fetchJson<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  // Attach stored recruiter token if present
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('pramaan_token')
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`
    }
  }

  try {
    const res = await fetch(url, { ...options, headers })
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ error: res.statusText }))
      throw new ApiError(res.status, errBody.error || `HTTP error ${res.status}`)
    }
    return (await res.json()) as T
  } catch (err: any) {
    if (err instanceof ApiError) throw err
    throw new ApiError(0, err.message || 'Network error connecting to PRAMAAN backend')
  }
}

export const api = {
  // Auth API
  auth: {
    async demoLogin(email = 'recruiter@pramaan.demo', name = 'Demo Recruiter') {
      const data = await fetchJson<{ user: any; token: string }>('/auth/demo-login', {
        method: 'POST',
        body: JSON.stringify({ email, name }),
      })
      if (typeof window !== 'undefined' && data.token) {
        localStorage.setItem('pramaan_token', data.token)
      }
      return data
    },
    async getMe() {
      return fetchJson<{ user: any }>('/auth/me')
    },
  },

  // Sessions API
  sessions: {
    async get(sessionId: string) {
      return fetchJson<{ session: any }>(`/sessions/${sessionId}`)
    },
    async start(sessionId: string) {
      return fetchJson<{ session: any }>(`/sessions/${sessionId}/start`, { method: 'POST' })
    },
    async end(sessionId: string) {
      return fetchJson<{ session: any; reportId: string }>(`/sessions/${sessionId}/end`, { method: 'POST' })
    },
    async updateStatus(sessionId: string, status: 'ACTIVE' | 'PAUSED' | 'ENDED') {
      return fetchJson<{ session: any }>(`/sessions/${sessionId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
    },
    async recordConsent(sessionId: string, consent: {
      cameraConsent: boolean
      microphoneConsent: boolean
      signalProcessingConsent: boolean
      consentVersion?: string
    }) {
      return fetchJson<{ consent: any }>(`/sessions/${sessionId}/consent`, {
        method: 'POST',
        body: JSON.stringify(consent),
      })
    },
    async applyScenario(sessionId: string, scenario: 'NORMAL' | 'PROXY' | 'LOW_BANDWIDTH') {
      return fetchJson<{
        scenario: string
        riskScore: number
        riskStatus: string
        confidence: string
        explanation: string
        signals: any
        event: any
      }>(`/sessions/${sessionId}/scenario`, {
        method: 'POST',
        body: JSON.stringify({ scenario }),
      })
    },
    async sendSignals(sessionId: string, signals: {
      faceMotionScore?: number | null
      lipSyncScore?: number | null
      challengeScore?: number | null
      streamQualityScore?: number | null
      visualEvidenceAvailable?: boolean
      audioEvidenceAvailable?: boolean
    }) {
      return fetchJson<{
        signals: any
        riskScore: number
        riskStatus: string
        confidence: string
        explanation: string
      }>(`/sessions/${sessionId}/signals`, {
        method: 'POST',
        body: JSON.stringify(signals),
      })
    },
    async getEvents(sessionId: string, filter?: string) {
      const q = filter ? `?filter=${filter}` : ''
      return fetchJson<{ events: any[] }>(`/sessions/${sessionId}/events${q}`)
    },
    async createEvent(sessionId: string, event: {
      type: string
      title: string
      description: string
      severity?: string
    }) {
      return fetchJson<{ event: any }>(`/sessions/${sessionId}/events`, {
        method: 'POST',
        body: JSON.stringify(event),
      })
    },
    async exportEventsUrl(sessionId: string) {
      return `${API_BASE}/sessions/${sessionId}/events/export`
    },
    async generateReport(sessionId: string) {
      return fetchJson<{ report: any }>(`/sessions/${sessionId}/report`, { method: 'POST' })
    },
  },

  // Challenges API
  challenges: {
    async issue(sessionId: string) {
      return fetchJson<{ challenge: any }>(`/sessions/${sessionId}/challenges`, { method: 'POST' })
    },
    async submitResult(challengeId: string, result: 'PASSED' | 'PARTIAL' | 'FAILED', responseDurationMs?: number) {
      return fetchJson<{
        challenge: any
        challengeScore: number
        riskScore: number
        riskStatus: string
        confidence: string
      }>(`/challenges/${challengeId}/result`, {
        method: 'POST',
        body: JSON.stringify({
          result,
          responseDurationMs: responseDurationMs || 4000,
          clientTimestamp: new Date().toISOString(),
        }),
      })
    },
  },

  // Reports API
  reports: {
    async get(reportId: string) {
      return fetchJson<{ report: any }>(`/reports/${reportId}`)
    },
  },

  // Health
  async checkHealth() {
    return fetchJson<{ status: string }>('/health')
  },
}
