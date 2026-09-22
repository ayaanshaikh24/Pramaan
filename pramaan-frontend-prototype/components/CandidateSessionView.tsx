'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Camera,
  CameraOff,
  Mic,
  Clock,
  Check,
  AlertTriangle,
  X,
  RefreshCw,
  Play,
  FileCheck,
  Wifi,
  Shield,
} from 'lucide-react'
import { ScenarioData, ChallengeStatus, FacePresenceState } from '@/types/pramaan'
import { CANDIDATE_DETAILS, SAMPLE_CHALLENGES } from '@/lib/scenarios'

interface CandidateSessionViewProps {
  data: ScenarioData
  stream: MediaStream | null
  cameraError: string | null
  isLowQualityMode: boolean
  faceState?: FacePresenceState
  onStartCamera: () => void
  onStopCamera: () => void
  onToggleLowQuality: (val: boolean) => void
  onChallengeResult: (res: ChallengeStatus) => void
  onStartIntegrityCheck?: () => void
}

type CheckProgression = 'waiting' | 'baseline' | 'active'

export function CandidateSessionView({
  data,
  stream,
  cameraError,
  isLowQualityMode,
  faceState,
  onStartCamera,
  onStopCamera,
  onToggleLowQuality,
  onChallengeResult,
  onStartIntegrityCheck,
}: CandidateSessionViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [challengeIdx, setChallengeIdx] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [timeLeft, setTimeLeft] = useState(20)
  const [checkState, setCheckState] = useState<CheckProgression>('waiting')
  const [challengeState, setChallengeState] = useState<ChallengeStatus>(data.challenge)

  useEffect(() => {
    setChallengeState(data.challenge)
  }, [data.challenge])

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => {})
    }
  }, [stream])

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

  const handleStartIntegrityCheck = () => {
    setCheckState('baseline')
    setIsTimerRunning(true)
    setTimeLeft(20)
    onStartIntegrityCheck?.()

    // Progression: Waiting -> Creating baseline -> Monitoring active
    setTimeout(() => {
      setCheckState('active')
    }, 1800)
  }

  const handleCyclePrompt = () => {
    setChallengeIdx((prev) => (prev + 1) % SAMPLE_CHALLENGES.length)
    setTimeLeft(20)
  }

  const handleEvaluation = (result: ChallengeStatus) => {
    setChallengeState(result)
    setIsTimerRunning(false)
    onChallengeResult(result)
  }

  const currentPrompt = SAMPLE_CHALLENGES[challengeIdx]
  const isPoor = isLowQualityMode || data.quality === 'Poor'

  // Dynamic waveform heights
  const waveformHeights = [6, 12, 18, 9, 22, 15, 8, 19, 11, 24, 14, 7, 16, 10, 20, 12]

  return (
    <div className="flex flex-col gap-4 max-w-5xl mx-auto">
      {/* Session Candidate Header Card */}
      <div className="paper-card p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--ink-black)]">
            <FileCheck size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-[var(--ink-black)]">{CANDIDATE_DETAILS.name}</h1>
              <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--surface-subtle)] border border-[var(--border-hairline)] px-2 py-0.5 rounded">
                {CANDIDATE_DETAILS.id}
              </span>
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              {CANDIDATE_DETAILS.role} • {CANDIDATE_DETAILS.stage}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-[var(--verified-green)] bg-[var(--verified-bg)] px-2.5 py-1 rounded border border-[rgba(25,135,84,0.25)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--verified-green)]" />
            Biometric consent recorded
          </span>
          <span className="flex items-center gap-1 text-[var(--text-muted)]">
            <Wifi size={13} className={isPoor ? 'text-[var(--review-amber)]' : 'text-[var(--cobalt)]'} />
            <span>Connection: {isPoor ? 'Degraded (Low BW)' : 'Stable (1080p)'}</span>
          </span>
        </div>
      </div>

      {/* Main 2-Column Room Workspace */}
      <div className="candidate-room-grid">
        {/* Left Column: Camera Preview & Local Audio */}
        <div className="flex flex-col gap-3">
          <div className="paper-card">
            <div className="paper-card-header">
              <span className="paper-section-title">Candidate room feed</span>
              {stream ? (
                <span className="text-[11px] text-[var(--verified-green)] flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--verified-green)]" />
                  Browser camera feed connected
                </span>
              ) : (
                <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--border-strong)]" />
                  Demo signal mode
                </span>
              )}
            </div>

            <div className="p-3">
              <div className={`video-preview-box relative h-[270px] ${isPoor ? 'degraded' : ''}`}>
                {stream ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="video-element-fit"
                  />
                ) : (
                  <div className="fallback-video-slate">
                    <Camera size={28} className="text-[#8E928F]" />
                    <div className="text-xs font-semibold text-white">
                      {cameraError ? 'Camera permission denied' : 'Camera inactive'}
                    </div>
                    <div className="text-[11px] text-[#A6AAA7] max-w-[240px]">
                      {cameraError
                        ? 'Simulated video active with local presence signal mock.'
                        : 'Click "Start camera" to connect your real webcam.'}
                    </div>
                  </div>
                )}

                {/* Minimal Face Framing Brackets (hidden when face is missing) */}
                {(!stream || faceState?.faceVisible) && (
                  <div className="framing-brackets">
                    <div className="frame-corner tl" />
                    <div className="frame-corner tr" />
                    <div className="frame-corner bl" />
                    <div className="frame-corner br" />
                  </div>
                )}

                {/* Face Missing / Covered Alert Overlay */}
                {stream && !faceState?.faceVisible && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4 z-10">
                    <div className="bg-[rgba(15,20,30,0.88)] border border-[var(--concern-coral)] text-white px-3 py-2 rounded-[6px] text-xs flex items-center gap-2.5 shadow-xl backdrop-blur-xs">
                      <span className="w-2 h-2 rounded-full bg-[var(--concern-coral)] animate-pulse" />
                      <div className="flex flex-col">
                        <span className="font-semibold text-[var(--concern-coral)]">
                          {faceState?.isCovered ? 'Camera Lens Obscured' : 'Face Not In Frame'}
                        </span>
                        <span className="text-[11px] text-[#C0C4C1]">
                          {faceState?.isCovered
                            ? 'Please uncover your camera to verify attendance'
                            : 'Please remain centered in front of the camera'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bottom telemetry */}
                <div className="video-telemetry-strip font-mono">
                  <span>{isPoor ? '480p · 15 FPS' : '1080p · 30 FPS'}</span>
                  <span className="text-[var(--verified-green)]">Demo signal layer active</span>
                </div>
              </div>

              {/* Honest Camera Disclaimer */}
              <div className="text-[10px] text-[var(--text-muted)] italic leading-tight px-1 mt-1.5">
                Camera preview is live. Integrity scores are controlled through Demo Lab for this prototype.
              </div>

              {/* Hardware Status Records */}
              <div className="meta-record-card mt-3">
                <div className="meta-record-row">
                  <div className="flex items-center gap-1.5">
                    <Mic size={13} className="text-[var(--verified-green)]" />
                    <span>Microphone status:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[var(--ink-black)]">Microphone ready</span>
                    <div className="audio-waveform-bars">
                      {waveformHeights.map((h, i) => (
                        <span
                          key={i}
                          className="audio-bar-tick"
                          style={{
                            height: `${isPoor ? Math.max(3, h * 0.4) : h}px`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="meta-record-row">
                  <span>Stream bitrate:</span>
                  <span className="font-mono text-[var(--ink-black)]">
                    {isPoor ? '420 kbps' : '3,100 kbps'}
                  </span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-[var(--border-hairline)]">
                {stream ? (
                  <button
                    type="button"
                    className="btn-doc btn-doc-sm"
                    onClick={onStopCamera}
                  >
                    <CameraOff size={12} />
                    <span>Stop camera</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-doc btn-doc-sm btn-subtle-cobalt"
                    onClick={onStartCamera}
                  >
                    <Camera size={12} />
                    <span>Start camera</span>
                  </button>
                )}

                <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isLowQualityMode}
                    onChange={(e) => onToggleLowQuality(e.target.checked)}
                    className="cursor-pointer"
                  />
                  <span>Simulate low bandwidth</span>
                </label>
              </div>
            </div>
          </div>

          {/* Privacy Note */}
          <div className="p-3 bg-[var(--surface-white)] border border-[var(--border-hairline)] rounded-[6px] text-[11px] text-[var(--text-muted)] flex items-start gap-2">
            <Shield size={13} className="text-[var(--cobalt)] flex-shrink-0 mt-0.5" />
            <span>
              Zero video or audio is stored on remote servers. All signal hashes are processed inside your browser memory.
            </span>
          </div>
        </div>

        {/* Right Column: Live Challenge Terminal */}
        <div className="paper-card p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="paper-section-title">Live challenge</span>
              <div className="text-xs text-[var(--ink-black)] font-medium mt-0.5">
                Random presence check
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-doc btn-doc-sm"
                onClick={handleCyclePrompt}
                title="Next prompt"
              >
                <RefreshCw size={11} />
                <span>Next prompt</span>
              </button>
              <div className="flex items-center gap-1 font-mono text-xs text-[var(--cobalt)] bg-[var(--cobalt-subtle)] px-2.5 py-1 rounded border border-[rgba(49,91,255,0.2)]">
                <Clock size={11} />
                <span>00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}</span>
              </div>
            </div>
          </div>

          {/* Challenge Prompt Plate */}
          <div className="challenge-quote-plate">
            <div className="text-[10px] text-[var(--cobalt)] font-semibold uppercase tracking-wider mb-1.5">
              Prompt #{currentPrompt.id}
            </div>
            <div>“{currentPrompt.prompt}”</div>
          </div>

          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Short random challenges help verify live presence. They are not used as an automatic rejection mechanism.
          </p>

          {/* Verification State Progression */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
              Verification state progression
            </span>
            <div className="progression-strip">
              <div className={`progression-step ${checkState === 'waiting' ? 'current' : ''}`}>
                <span>1. Waiting</span>
              </div>
              <span className="text-[var(--text-muted)]">→</span>
              <div className={`progression-step ${checkState === 'baseline' ? 'current' : ''}`}>
                <span>2. Creating baseline</span>
              </div>
              <span className="text-[var(--text-muted)]">→</span>
              <div className={`progression-step ${checkState === 'active' ? 'current' : ''}`}>
                <span>3. Monitoring active</span>
              </div>
            </div>
          </div>

          {/* Start Integrity Check CTA */}
          <button
            type="button"
            className="btn-doc btn-primary-cobalt w-full py-2"
            onClick={handleStartIntegrityCheck}
          >
            <Play size={13} />
            <span>
              {checkState === 'waiting'
                ? 'Start Integrity Check'
                : 'Restart Integrity Check'}
            </span>
          </button>

          {/* Demo Evaluation Controls */}
          <div className="mt-1 pt-3 border-t border-[var(--border-hairline)] flex flex-col gap-2">
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
              Demo controls (simulate candidate response)
            </span>
            <div className="eval-toggles-row">
              <button
                type="button"
                className={`btn-eval-box pass ${challengeState === 'passed' ? 'active' : ''}`}
                onClick={() => handleEvaluation('passed')}
              >
                <Check size={12} />
                <span>Pass</span>
              </button>

              <button
                type="button"
                className={`btn-eval-box partial ${challengeState === 'partial' ? 'active' : ''}`}
                onClick={() => handleEvaluation('partial')}
              >
                <AlertTriangle size={12} />
                <span>Partial</span>
              </button>

              <button
                type="button"
                className={`btn-eval-box fail ${challengeState === 'failed' ? 'active' : ''}`}
                onClick={() => handleEvaluation('failed')}
              >
                <X size={12} />
                <span>Fail</span>
              </button>
            </div>
            <span className="text-[10px] text-[var(--text-muted)]">
              Evaluation result is immediately reflected in the recruiter timeline.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
