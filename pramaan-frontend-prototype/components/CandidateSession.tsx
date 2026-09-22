'use client'

import React, { useState, useEffect } from 'react'
import {
  Video,
  AudioLines,
  Zap,
  Wifi,
  Play,
  Check,
  AlertTriangle,
  X,
  Clock,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  HelpCircle,
  RefreshCw,
  Info,
} from 'lucide-react'
import { CameraPreview } from './CameraPreview'
import { ScenarioData, ChallengeStatus } from '@/types/pramaan'
import { CANDIDATE_DETAILS, SAMPLE_CHALLENGES } from '@/lib/scenarios'

interface CandidateSessionProps {
  data: ScenarioData
  stream: MediaStream | null
  cameraError: string | null
  isLowQualityMode: boolean
  onStartCamera: () => void
  onStopCamera: () => void
  onToggleLowQuality: (val: boolean) => void
  onChallengeResult: (res: ChallengeStatus) => void
  onGoToRecruiter: () => void
}

export function CandidateSession({
  data,
  stream,
  cameraError,
  isLowQualityMode,
  onStartCamera,
  onStopCamera,
  onToggleLowQuality,
  onChallengeResult,
  onGoToRecruiter,
}: CandidateSessionProps) {
  const [challengeIdx, setChallengeIdx] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [timeLeft, setTimeLeft] = useState(20)
  const [challengeState, setChallengeState] = useState<ChallengeStatus>(data.challenge)

  useEffect(() => {
    setChallengeState(data.challenge)
  }, [data.challenge])

  // Countdown timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1)
      }, 1000)
    } else if (timeLeft === 0) {
      setIsTimerRunning(false)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isTimerRunning, timeLeft])

  const startIntegrityCheck = () => {
    setIsTimerRunning(true)
    setTimeLeft(20)
  }

  const handleShuffleChallenge = () => {
    setChallengeIdx((prev) => (prev + 1) % SAMPLE_CHALLENGES.length)
    setTimeLeft(20)
  }

  const handleResult = (result: ChallengeStatus) => {
    setChallengeState(result)
    setIsTimerRunning(false)
    onChallengeResult(result)
  }

  const currentChallenge = SAMPLE_CHALLENGES[challengeIdx]

  return (
    <div className="candidate-page">
      {/* Session Top Header */}
      <div className="candidate-session-header">
        <div className="candidate-info-block">
          <div className="eyebrow flex items-center gap-2">
            <span>CANDIDATE SESSION CONSOLE</span>
            <span className="dot-sep">•</span>
            <span className="text-[#25E0FF]">ACTIVE PROCTORING</span>
          </div>

          <h1 className="candidate-title">
            {CANDIDATE_DETAILS.name}
          </h1>

          <div className="candidate-meta-pills">
            <span className="meta-pill">
              <strong>Role:</strong> {CANDIDATE_DETAILS.role}
            </span>
            <span className="meta-pill">
              <strong>Interview Stage:</strong> {CANDIDATE_DETAILS.stage}
            </span>
            <span className="meta-pill text-[#56E39F]">
              <ShieldCheck size={14} />
              <span>Biometric Consent Recorded</span>
            </span>
          </div>
        </div>

        <div className="session-header-actions">
          <button
            type="button"
            id="btn-nav-to-recruiter"
            className="btn btn-primary"
            onClick={onGoToRecruiter}
          >
            <span>Open Recruiter Dashboard</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Main Grid: Camera Preview on Left, Live Challenge on Right */}
      <div className="candidate-grid">
        {/* Camera & Microphone Section */}
        <div className="panel camera-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">LOCAL SIGNAL EXTRACTION</span>
              <h2 className="panel-title">Camera & Microphone Preview</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">
                {stream ? 'Hardware Connected' : 'Simulated Vector Mode'}
              </span>
            </div>
          </div>

          <CameraPreview
            stream={stream}
            quality={data.quality}
            isLowQualityMode={isLowQualityMode}
            cameraError={cameraError}
            onStartCamera={onStartCamera}
            onStopCamera={onStopCamera}
            onToggleLowQuality={onToggleLowQuality}
            showControls={true}
          />
        </div>

        {/* Live Challenge Panel */}
        <div className="panel challenge-panel">
          <div className="flex items-start justify-between mb-4">
            <div>
              <span className="eyebrow">ACTIVE PRESENCE PROTOCOL</span>
              <h2 className="panel-title">Random Live Challenge</h2>
            </div>

            {/* Countdown Timer */}
            <div className="countdown-timer-box">
              <div className="flex items-center gap-1 text-[#25E0FF]">
                <Clock size={15} />
                <span className="timer-digits">
                  00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
                </span>
              </div>
              <span className="text-[9px] text-muted tracking-wider uppercase">
                {isTimerRunning ? 'Active Timer' : 'Ready'}
              </span>
            </div>
          </div>

          {/* Current Challenge Card */}
          <div className="challenge-quote-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-[#25E0FF] font-semibold tracking-wider uppercase flex items-center gap-1">
                <Zap size={12} /> Prompt #{challengeIdx + 1}
              </span>
              <button
                type="button"
                className="btn-text-ghost text-xs flex items-center gap-1"
                onClick={handleShuffleChallenge}
                title="Cycle through random challenges"
              >
                <RefreshCw size={12} />
                <span>Next Prompt</span>
              </button>
            </div>
            <p className="challenge-prompt-text">
              “{currentChallenge.prompt}”
            </p>
            <div className="challenge-subtext">
              <Info size={12} className="text-[#6977FF] flex-shrink-0 mt-0.5" />
              <span>{currentChallenge.instruction}</span>
            </div>
          </div>

          {/* Current Challenge Status Indicator */}
          <div className="challenge-status-strip">
            <div
              className={`challenge-status-badge ${
                challengeState === 'passed'
                  ? 'badge-passed'
                  : challengeState === 'partial'
                  ? 'badge-partial'
                  : challengeState === 'failed'
                  ? 'badge-failed'
                  : 'badge-pending'
              }`}
            >
              <Zap size={16} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">
                {challengeState === 'pending' && 'Awaiting Candidate Verification'}
                {challengeState === 'passed' && 'Challenge Passed (Verified Live)'}
                {challengeState === 'partial' && 'Partial Completion Recorded'}
                {challengeState === 'failed' && 'Challenge Response Failed'}
              </div>
              <div className="text-xs text-muted">
                {challengeState === 'pending'
                  ? 'Click "Start Integrity Check" to trigger the challenge timer.'
                  : 'Result dynamically reflected in Recruiter Timeline.'}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="challenge-controls">
            <button
              type="button"
              id="btn-start-integrity-check"
              className={`btn btn-primary w-full ${isTimerRunning ? 'pulse-border' : ''}`}
              onClick={startIntegrityCheck}
            >
              <Play size={16} />
              <span>{isTimerRunning ? 'Restart Integrity Check' : 'Start Integrity Check'}</span>
            </button>

            <div className="text-[11px] text-muted text-center pt-2">
              Evaluate Candidate Response:
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                id="btn-challenge-pass"
                className={`btn btn-eval ${challengeState === 'passed' ? 'btn-eval-passed' : 'btn-ghost'}`}
                onClick={() => handleResult('passed')}
              >
                <Check size={14} className="text-[#56E39F]" />
                <span>Pass</span>
              </button>

              <button
                type="button"
                id="btn-challenge-partial"
                className={`btn btn-eval ${challengeState === 'partial' ? 'btn-eval-partial' : 'btn-ghost'}`}
                onClick={() => handleResult('partial')}
              >
                <AlertTriangle size={14} className="text-[#FF9D4D]" />
                <span>Partial</span>
              </button>

              <button
                type="button"
                id="btn-challenge-fail"
                className={`btn btn-eval ${challengeState === 'failed' ? 'btn-eval-failed' : 'btn-ghost'}`}
                onClick={() => handleResult('failed')}
              >
                <X size={14} className="text-[#FF6F91]" />
                <span>Fail</span>
              </button>
            </div>
          </div>

          {/* Next Step Banner */}
          <div className="recruiter-jump-banner">
            <div className="flex items-center justify-between">
              <div>
                <strong className="text-white text-xs block">Ready to inspect recruiter signals?</strong>
                <span className="text-[11px] text-muted">
                  View risk gauge, 4 multimodal signals, and timeline.
                </span>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={onGoToRecruiter}
              >
                <span>View Dashboard</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Live Signal Summary Strip */}
      <div className="candidate-signals-section">
        <div className="mb-3 flex items-center justify-between">
          <div className="eyebrow">REAL-TIME INFERENCE STATUS</div>
          <span className="text-xs text-muted flex items-center gap-1.5">
            <span className="live-dot" /> Client-side feature extraction active
          </span>
        </div>

        <div className="signal-grid">
          {/* Card 1: Face + Motion */}
          <div className="signal-card">
            <div className="signal-icon">
              <Video size={16} />
            </div>
            <div className="signal-info">
              <div className="flex justify-between items-baseline">
                <span className="signal-title">Face + Motion</span>
                <span className="signal-score">
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
                      : 'orange'
                  }`}
                />
                <span>
                  {data.scores.face === null
                    ? 'Degraded video stream'
                    : data.scores.face > 70
                    ? 'Natural micro-motion verified'
                    : 'Reduced natural variance'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Voice + Lip Sync */}
          <div className="signal-card">
            <div className="signal-icon">
              <AudioLines size={16} />
            </div>
            <div className="signal-info">
              <div className="flex justify-between items-baseline">
                <span className="signal-title">Voice + Lip Sync</span>
                <span className="signal-score">{data.scores.voice}/100</span>
              </div>
              <div className="signal-bar-track">
                <div
                  className="signal-bar-fill"
                  style={{ width: `${data.scores.voice ?? 30}%` }}
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
                    ? 'Audio-visual phonemes aligned'
                    : 'Lip-sync discrepancy detected'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Live Challenge */}
          <div className="signal-card">
            <div className="signal-icon">
              <Zap size={16} />
            </div>
            <div className="signal-info">
              <div className="flex justify-between items-baseline">
                <span className="signal-title">Live Challenge</span>
                <span className="signal-score">
                  {challengeState === 'pending'
                    ? 'Pending'
                    : challengeState === 'passed'
                    ? '100/100'
                    : challengeState === 'partial'
                    ? '50/100'
                    : '0/100'}
                </span>
              </div>
              <div className="signal-bar-track">
                <div
                  className="signal-bar-fill"
                  style={{
                    width:
                      challengeState === 'passed'
                        ? '100%'
                        : challengeState === 'partial'
                        ? '50%'
                        : challengeState === 'failed'
                        ? '10%'
                        : '0%',
                  }}
                />
              </div>
              <div className="signal-status-line">
                <span
                  className={`status-dot ${
                    challengeState === 'passed'
                      ? 'green'
                      : challengeState === 'partial'
                      ? 'gold'
                      : challengeState === 'failed'
                      ? 'pink'
                      : 'gold'
                  }`}
                />
                <span>
                  {challengeState === 'pending'
                    ? 'Challenge awaiting candidate'
                    : challengeState === 'passed'
                    ? 'Verified responsive'
                    : challengeState === 'partial'
                    ? 'Partial response'
                    : 'Failed prompt'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Stream Quality */}
          <div className="signal-card">
            <div className="signal-icon">
              <Wifi size={16} />
            </div>
            <div className="signal-info">
              <div className="flex justify-between items-baseline">
                <span className="signal-title">Stream Quality</span>
                <span className="signal-score">{data.scores.stream}/100</span>
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
                    ? 'High frame continuity'
                    : 'Degraded network bandwidth'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
