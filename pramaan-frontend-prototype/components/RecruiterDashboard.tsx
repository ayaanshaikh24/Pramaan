'use client'

import React, { useState } from 'react'
import {
  Video,
  AudioLines,
  Zap,
  Wifi,
  Download,
  Pause,
  Play,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Shield,
  Clock,
  User,
  Activity,
  Layers,
  FileCheck,
  LockKeyhole,
} from 'lucide-react'
import { RiskGauge } from './RiskGauge'
import { CameraPreview } from './CameraPreview'
import { DemoScenarioController } from './DemoScenarioController'
import { Scenario, ScenarioData, TimelineEvent } from '@/types/pramaan'
import { CANDIDATE_DETAILS } from '@/lib/scenarios'

interface RecruiterDashboardProps {
  data: ScenarioData
  currentScenario: Scenario
  events: TimelineEvent[]
  stream: MediaStream | null
  onSelectScenario: (scenario: Scenario) => void
  onRequestVerification: () => void
  onExportReport: () => void
}

export function RecruiterDashboard({
  data,
  currentScenario,
  events,
  stream,
  onSelectScenario,
  onRequestVerification,
  onExportReport,
}: RecruiterDashboardProps) {
  const [isPaused, setIsPaused] = useState(false)

  // Status color helpers
  const getStatusBeaconColor = () => {
    if (data.status === 'Low Risk') return 'status-beacon-green'
    if (data.status === 'Review Recommended') return 'status-beacon-pink'
    if (data.status === 'Insufficient Evidence') return 'status-beacon-orange'
    return 'status-beacon-pink'
  }

  return (
    <div className="recruiter-dashboard">
      {/* Dashboard Top Header */}
      <div className="recruiter-header">
        <div className="recruiter-meta-block">
          <div className="eyebrow flex items-center gap-2">
            <span>RECRUITER AUDIT CONSOLE</span>
            <span className="dot-sep">•</span>
            <span className="text-[#25E0FF]">SESSION #PRM-CX0104</span>
          </div>

          <h1 className="dashboard-title">Interview Integrity Dashboard</h1>

          <div className="dashboard-submeta">
            <span className="meta-tag">
              <User size={12} className="text-[#25E0FF]" />
              <strong>{CANDIDATE_DETAILS.name}</strong>
            </span>
            <span className="meta-sep">•</span>
            <span className="meta-tag">{CANDIDATE_DETAILS.role}</span>
            <span className="meta-sep">•</span>
            <span className="meta-tag">{CANDIDATE_DETAILS.stage}</span>
            <span className="meta-sep">•</span>
            <span className="meta-tag flex items-center gap-1 text-white font-mono">
              <Clock size={12} className="text-[#FFD45E]" />
              <span>Duration: {CANDIDATE_DETAILS.duration}</span>
            </span>
            <span className="meta-sep">•</span>
            <span className="meta-tag text-[#56E39F] flex items-center gap-1">
              <span className="live-dot" />
              <span>{isPaused ? 'Monitoring Paused' : 'Continuous Live Audit'}</span>
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="dashboard-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={onRequestVerification}
            title="Request candidate to perform immediate presence challenge"
          >
            <Zap size={14} className="text-[#25E0FF]" />
            <span>Request Challenge</span>
          </button>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={onExportReport}
            title="Download JSON cryptographic evidence log"
          >
            <Download size={14} />
            <span>Export Report</span>
          </button>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setIsPaused(!isPaused)}
            title={isPaused ? 'Resume monitoring' : 'Pause monitoring'}
          >
            {isPaused ? <Play size={14} className="text-[#56E39F]" /> : <Pause size={14} />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>
        </div>
      </div>

      {isPaused && (
        <div className="pause-notice-banner">
          <Pause size={16} />
          <span>
            Auditing paused by recruiter. Signal timeline and risk indicators are frozen; no new inference frames are being calculated.
          </span>
        </div>
      )}

      {/* Primary KPI Row: Integrity Status + Why this status? + Privacy Panel */}
      <div className="kpi-three-grid">
        {/* Card 1: Risk Assessment & Gauge */}
        <div className="panel kpi-gauge-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">DECISION SUPPORT</span>
              <h2 className="panel-title">Risk Assessment</h2>
            </div>
            <span className="pill pill-cyan text-[10px]">Multimodal</span>
          </div>

          <RiskGauge
            risk={data.risk}
            status={data.status}
            confidence={data.confidence}
          />

          <div className="ethical-disclaimer-box">
            <Shield size={14} className="text-[#FFD45E] flex-shrink-0" />
            <span className="text-[11px] leading-tight text-[#e5e1ff]">
              Risk score is a probabilistic decision-support signal for human recruiters. PRAMAAN never makes automatic hiring or rejection decisions.
            </span>
          </div>
        </div>

        {/* Card 2: "Why this status?" Explanation Section */}
        <div className="panel why-status-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">SYSTEM RATIONALE</span>
              <h2 className="panel-title">“Why this status?”</h2>
            </div>
            <span className={`status-beacon-pill ${getStatusBeaconColor()}`}>
              {data.status}
            </span>
          </div>

          <div className="explanation-quote-box">
            <div className="explanation-label">CURRENT STATUS EXPLANATION</div>
            <p className="explanation-text" id="why-status-text">
              “{data.explanation}”
            </p>
          </div>

          <div className="explanation-breakdown">
            <div className="text-[11px] font-semibold text-white mb-2 flex items-center gap-1.5">
              <Layers size={13} className="text-[#25E0FF]" />
              <span>Multimodal Signal Synthesis</span>
            </div>

            <ul className="synthesis-list">
              <li>
                <span className="bullet-title">Face Consistency:</span>
                <span>
                  {data.scores.face === null
                    ? 'Confidence degraded by camera stream'
                    : data.scores.face > 75
                    ? '3D face geometry matches reference baseline'
                    : 'Discrepancies in natural facial micro-expressions'}
                </span>
              </li>
              <li>
                <span className="bullet-title">Voice & Lip Sync:</span>
                <span>
                  {(data.scores.voice ?? 0) > 75
                    ? 'Phoneme audio synchronized with mouth landmark motion'
                    : 'Audio-visual temporal offset exceeds 150ms'}
                </span>
              </li>
              <li>
                <span className="bullet-title">Live Challenge:</span>
                <span>
                  {data.challenge === 'passed'
                    ? 'Zero-shot prompt completed and verified'
                    : data.challenge === 'partial'
                    ? 'Delayed or incomplete challenge movement recorded'
                    : 'Challenge failed or awaiting prompt'}
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Card 3: Privacy & Verification Standards */}
        <div className="panel privacy-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">COMPLIANCE & ETHICS</span>
              <h2 className="panel-title">Privacy Panel</h2>
            </div>
            <span className="pill pill-green text-[10px]">GDPR Compliant</span>
          </div>

          <div className="privacy-items-list">
            <div className="privacy-item">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-[#56E39F]" />
                <span className="text-xs text-white font-medium">Browser-Side Processing</span>
              </div>
              <span className="privacy-badge-active">ACTIVE</span>
            </div>

            <div className="privacy-item">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-[#56E39F]" />
                <span className="text-xs text-white font-medium">No Raw-Video Storage</span>
              </div>
              <span className="privacy-badge-active">ZERO RECORDING</span>
            </div>

            <div className="privacy-item">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-[#56E39F]" />
                <span className="text-xs text-white font-medium">Human Review Enforced</span>
              </div>
              <span className="privacy-badge-active">MANDATORY</span>
            </div>

            <div className="privacy-item">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-[#56E39F]" />
                <span className="text-xs text-white font-medium">Ephemeral Feature Vectors</span>
              </div>
              <span className="privacy-badge-active">NON-INVASIVE</span>
            </div>
          </div>

          <div className="privacy-audit-footer">
            <LockKeyhole size={13} className="text-[#6977FF]" />
            <span className="text-[11px] text-muted">
              Client vectors expire immediately upon session termination. No biometric data leaves the local memory buffer.
            </span>
          </div>
        </div>
      </div>

      {/* Four Signal Cards Section */}
      <div className="signals-section mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="eyebrow">TELEMETRY DECOMPOSITION</span>
            <h2 className="text-sm font-semibold text-white">Four Core Integrity Signals</h2>
          </div>
          <span className="text-xs text-muted flex items-center gap-1.5">
            <span className="live-dot" /> Evaluated synchronously
          </span>
        </div>

        <div className="signal-grid">
          {/* Signal 1: Face + Motion */}
          <div className="signal-card" id="card-face-motion">
            <div className="signal-icon">
              <Video size={18} />
            </div>
            <div className="signal-info">
              <div className="flex justify-between items-baseline">
                <span className="signal-title">Face + Motion</span>
                <span className="signal-score" id="score-face-motion">
                  {data.scores.face === null ? 'Low confidence' : `${data.scores.face}/100`}
                </span>
              </div>
              <div className="signal-bar-track">
                <div
                  className="signal-bar-fill"
                  style={{ width: `${data.scores.face ?? 25}%` }}
                />
              </div>
              <div className="signal-status-line">
                <span
                  className={`status-dot ${
                    data.scores.face === null
                      ? 'orange'
                      : data.scores.face > 70
                      ? 'green'
                      : 'pink'
                  }`}
                />
                <span>
                  {data.scores.face === null
                    ? 'Visual evidence degraded'
                    : data.scores.face > 70
                    ? 'Natural micro-motion consistent'
                    : 'Reduced natural variance / mask anomaly'}
                </span>
              </div>
            </div>
          </div>

          {/* Signal 2: Voice + Lip Sync */}
          <div className="signal-card" id="card-voice-lip">
            <div className="signal-icon">
              <AudioLines size={18} />
            </div>
            <div className="signal-info">
              <div className="flex justify-between items-baseline">
                <span className="signal-title">Voice + Lip Sync</span>
                <span className="signal-score" id="score-voice-lip">
                  {data.scores.voice}/100
                </span>
              </div>
              <div className="signal-bar-track">
                <div
                  className="signal-bar-fill"
                  style={{ width: `${data.scores.voice ?? 35}%` }}
                />
              </div>
              <div className="signal-status-line">
                <span
                  className={`status-dot ${
                    (data.scores.voice ?? 0) > 70 ? 'green' : 'pink'
                  }`}
                />
                <span>
                  {(data.scores.voice ?? 0) > 70
                    ? 'Lip articulators tightly synchronized'
                    : 'Speech timing lag exceeds tolerance threshold'}
                </span>
              </div>
            </div>
          </div>

          {/* Signal 3: Live Challenge */}
          <div className="signal-card" id="card-live-challenge">
            <div className="signal-icon">
              <Zap size={18} />
            </div>
            <div className="signal-info">
              <div className="flex justify-between items-baseline">
                <span className="signal-title">Live Challenge</span>
                <span className="signal-score" id="score-live-challenge">
                  {data.challenge === 'passed'
                    ? 'Passed'
                    : data.challenge === 'partial'
                    ? 'Partial'
                    : data.challenge === 'failed'
                    ? 'Failed'
                    : 'Pending'}
                </span>
              </div>
              <div className="signal-bar-track">
                <div
                  className="signal-bar-fill"
                  style={{
                    width:
                      data.challenge === 'passed'
                        ? '100%'
                        : data.challenge === 'partial'
                        ? '50%'
                        : data.challenge === 'failed'
                        ? '15%'
                        : '0%',
                  }}
                />
              </div>
              <div className="signal-status-line">
                <span
                  className={`status-dot ${
                    data.challenge === 'passed'
                      ? 'green'
                      : data.challenge === 'partial'
                      ? 'gold'
                      : data.challenge === 'failed'
                      ? 'pink'
                      : 'gold'
                  }`}
                />
                <span>
                  {data.challenge === 'passed'
                    ? 'Zero-shot prompt response passed'
                    : data.challenge === 'partial'
                    ? 'Incomplete or delayed response'
                    : data.challenge === 'failed'
                    ? 'Response verification failed'
                    : 'Awaiting candidate trigger'}
                </span>
              </div>
            </div>
          </div>

          {/* Signal 4: Stream Quality */}
          <div className="signal-card" id="card-stream-quality">
            <div className="signal-icon">
              <Wifi size={18} />
            </div>
            <div className="signal-info">
              <div className="flex justify-between items-baseline">
                <span className="signal-title">Stream Quality</span>
                <span className="signal-score" id="score-stream-quality">
                  {data.scores.stream}/100
                </span>
              </div>
              <div className="signal-bar-track">
                <div
                  className="signal-bar-fill"
                  style={{ width: `${data.scores.stream ?? 20}%` }}
                />
              </div>
              <div className="signal-status-line">
                <span
                  className={`status-dot ${
                    (data.scores.stream ?? 0) > 60 ? 'green' : 'orange'
                  }`}
                />
                <span>
                  {(data.scores.stream ?? 0) > 60
                    ? 'High packet continuity (1080p, 30 FPS)'
                    : 'Network degradation (480p, packet loss)'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Candidate Live Monitor + Session Timeline + Demo Scenario Controller */}
      <div className="recruiter-lower-grid">
        {/* Candidate Feed Monitor */}
        <div className="panel monitor-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">CANDIDATE FEED</span>
              <h2 className="panel-title">Live Interaction Monitor</h2>
            </div>
            <span className="pill pill-green text-[10px]">
              <span className="live-dot" /> Feed Streaming
            </span>
          </div>

          <CameraPreview
            stream={stream}
            quality={data.quality}
            isLowQualityMode={data.quality === 'Poor'}
            onStartCamera={() => {}}
            onStopCamera={() => {}}
            showControls={false}
          />

          <div className="monitor-footer-meta">
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <Activity size={13} className="text-[#25E0FF]" />
              <span>Cryptographic hash: 0x9e4a...f82b</span>
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <CheckCircle2 size={13} className="text-[#56E39F]" />
              <span>Face mesh lock: Verified</span>
            </span>
          </div>
        </div>

        {/* Timeline & Demo Controller Column */}
        <div className="recruiter-side-stack">
          {/* Demo Scenario Controller */}
          <DemoScenarioController
            currentScenario={currentScenario}
            onSelectScenario={onSelectScenario}
          />

          {/* Session Timeline */}
          <div className="panel timeline-panel">
            <div className="panel-header">
              <div>
                <span className="eyebrow">AUDIT TRAIL</span>
                <h2 className="panel-title">Session Timeline</h2>
              </div>
              <span className="text-xs text-muted">Sequential Event Log</span>
            </div>

            <div className="timeline-list" id="session-timeline">
              {events.map((event, idx) => (
                <div key={`${event.time}-${idx}`} className="timeline-node">
                  <div className={`timeline-marker ${event.type}`}>
                    <span className="marker-inner" />
                  </div>
                  <div className="timeline-content">
                    <div className="flex items-center gap-2">
                      <span className="timeline-time-badge">{event.time}</span>
                      <strong className="timeline-node-title">{event.title}</strong>
                    </div>
                    <p className="timeline-node-desc">{event.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
