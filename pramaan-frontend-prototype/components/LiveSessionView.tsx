import React, { useRef, useEffect, useState } from 'react'
import {
  Video,
  AudioLines,
  Zap,
  Wifi,
  Camera,
  CameraOff,
  Mic,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sliders,
} from 'lucide-react'
import { ScenarioData, TimelineEvent, Scenario, EventType, FacePresenceState } from '@/types/pramaan'
import { CANDIDATE_DETAILS } from '@/lib/scenarios'
import { ChallengeBanner } from '@/components/ChallengeBanner'
import { useAudioMeter } from '@/lib/useAudioMeter'
import { getRealStreamInfo } from '@/lib/streamInfo'

function useAnimatedNumber(target: number, durationMs: number = 400): number {
  const [display, setDisplay] = useState(target)

  useEffect(() => {
    let animId: number
    const startVal = display
    const endVal = target
    if (startVal === endVal) return

    const startTime = performance.now()
    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / durationMs, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(startVal + (endVal - startVal) * ease))
      if (progress < 1) {
        animId = requestAnimationFrame(step)
      }
    }
    animId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animId)
  }, [target, durationMs])

  return display
}

interface LiveSessionViewProps {
  data: ScenarioData
  currentScenario: Scenario
  events: TimelineEvent[]
  stream: MediaStream | null
  cameraError: string | null
  isLowQualityMode: boolean
  faceState?: FacePresenceState
  onStartCamera: () => void
  onStopCamera: () => void
  onToggleLowQuality: (val: boolean) => void
  onRequestVerification: () => void
  onGoToLab: () => void
  onRegisterVideo?: (el: HTMLVideoElement | null) => void
  isChallengeBannerOpen?: boolean
  challengeStatus?: 'waiting' | 'recorded' | 'passed'
  challengePrompt?: string
  challengeSecondsLeft?: number
  onPassChallenge?: () => void
  onPartialChallenge?: () => void
  onDismissChallenge?: () => void
}

export function LiveSessionView({
  data,
  currentScenario,
  events,
  stream,
  cameraError,
  isLowQualityMode,
  faceState,
  onStartCamera,
  onStopCamera,
  onToggleLowQuality,
  onRequestVerification,
  onGoToLab,
  onRegisterVideo,
  isChallengeBannerOpen = false,
  challengeStatus = 'waiting',
  challengePrompt = 'Turn your head slightly to the right and say BLUE 47',
  challengeSecondsLeft = 20,
  onPassChallenge,
  onPartialChallenge,
  onDismissChallenge,
}: LiveSessionViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { isMicAvailable, waveformHeights } = useAudioMeter(stream)
  const streamInfo = getRealStreamInfo(stream)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => {})
    }
    if (onRegisterVideo) {
      onRegisterVideo(videoRef.current)
    }
  }, [stream, onRegisterVideo])

  const isPoor = isLowQualityMode || data.quality === 'Poor'

  const getStatusColor = (status: string) => {
    if (status === 'Low Risk') return 'var(--verified-green)'
    if (status === 'Review Recommended') return 'var(--concern-coral)'
    return 'var(--review-amber)'
  }

  const getStatusBg = (status: string) => {
    if (status === 'Low Risk') return 'var(--verified-bg)'
    if (status === 'Review Recommended') return 'var(--concern-bg)'
    return 'var(--review-bg)'
  }

  const getSignalColor = (score: number | null) => {
    if (score === null) return 'var(--review-amber)'
    if (score >= 80) return 'var(--verified-green)'
    if (score >= 50) return 'var(--review-amber)'
    return 'var(--concern-coral)'
  }

  const getSeverityLabel = (type: EventType) => {
    switch (type) {
      case 'critical':
        return { label: 'CRITICAL', class: 'critical' }
      case 'warning':
        return { label: 'WARNING', class: 'warning' }
      case 'normal':
        return { label: 'VERIFIED', class: 'normal' }
      case 'info':
        return { label: 'SYSTEM', class: 'info' }
    }
  }

  // Smoothly animated risk score
  const animatedRisk = useAnimatedNumber(data.risk ?? 0, 400)
  const spectrumPosition = data.risk === null ? 0 : Math.min(Math.max(animatedRisk, 0), 100)

  return (
    <div className="flex flex-col gap-3">
      {/* Full-Width Live Challenge Banner */}
      {isChallengeBannerOpen && (
        <ChallengeBanner
          isOpen={isChallengeBannerOpen}
          prompt={challengePrompt}
          status={challengeStatus}
          secondsLeft={challengeSecondsLeft}
          onPass={onPassChallenge || (() => {})}
          onPartial={onPartialChallenge || (() => {})}
          onDismiss={onDismissChallenge || (() => {})}
        />
      )}

      {/* Prominent Algorithmic Fairness Callout when in Low Bandwidth */}
      {currentScenario === 'low-bandwidth' && (
        <div className="prominent-fairness-banner">
          <AlertTriangle size={18} className="text-[#B25E00] flex-shrink-0 mt-0.5" />
          <div>
            <div className="prominent-fairness-title">Algorithmic Fairness Safeguard Active</div>
            <div className="prominent-fairness-desc font-semibold text-sm">
              “Poor video quality lowers confidence. It does not prove dishonesty.”
            </div>
            <div className="text-[11px] text-[#5A3200] mt-0.5">
              Degraded network bandwidth reduces decision confidence without falsely accusing the candidate of fraud.
            </div>
          </div>
        </div>
      )}

      <div className="console-grid-3col">
        {/* ============================================================ */}
        {/* COLUMN 1: LEFT — Candidate Video & Hardware Context */}
        {/* ============================================================ */}
        <div className="flex flex-col gap-3">
          <div className="paper-card">
            <div className="paper-card-header">
              <span className="paper-section-title">Candidate video stream</span>
              {stream ? (
                faceState?.liveState === 'FACE_VISIBLE' ? (
                  <span className="text-[11px] text-[var(--verified-green)] flex items-center gap-1.5 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--verified-green)]" />
                    Face visible · Browser sensor active
                  </span>
                ) : faceState?.liveState === 'FACE_NOT_VISIBLE' ? (
                  <span className="text-[11px] text-[var(--review-amber)] flex items-center gap-1.5 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--review-amber)] animate-pulse" />
                    Face not visible
                  </span>
                ) : faceState?.liveState === 'CAMERA_PERMISSION_DENIED' ? (
                  <span className="text-[11px] text-[var(--concern-coral)] flex items-center gap-1.5 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--concern-coral)]" />
                    Camera permission denied
                  </span>
                ) : faceState?.liveState === 'DETECTOR_UNAVAILABLE' ? (
                  <span className="text-[11px] text-[var(--concern-coral)] flex items-center gap-1.5 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--concern-coral)]" />
                    Detector unavailable
                  </span>
                ) : (
                  <span className="text-[11px] text-[var(--cobalt)] flex items-center gap-1.5 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--cobalt)] animate-pulse" />
                    Detector loading
                  </span>
                )
              ) : (
                <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--border-strong)]" />
                  Camera not started
                </span>
              )}
            </div>

            <div className="p-3 flex flex-col gap-3">
              {/* Viewfinder Preview */}
              <div className={`video-preview-box relative ${isPoor ? 'degraded' : ''}`}>
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
                    <Camera size={24} className="text-[#8E928F]" />
                    <div className="text-xs font-semibold text-white">
                      {cameraError ? 'Camera unavailable' : 'Camera not started'}
                    </div>
                    <div className="text-[11px] text-[#A6AAA7] max-w-[220px]">
                      {cameraError
                        ? 'Camera permission denied or unavailable.'
                        : 'Click "Start camera" to initialize local MediaPipe detector.'}
                    </div>
                  </div>
                )}

                {/* Face Overlay (Bounding Box ONLY when landmarks actually detected) */}
                {stream && faceState?.faceVisible && faceState.box && (
                  <div
                    className="face-detected-bounding-box"
                    style={{
                      left: `${faceState.box.x}%`,
                      top: `${faceState.box.y}%`,
                      width: `${faceState.box.width}%`,
                      height: `${faceState.box.height}%`,
                    }}
                  >
                    <div className="face-box-label">
                      Face visible · {faceState.confidence}%
                    </div>
                  </div>
                )}

                {/* Minimal Framing Brackets */}
                {(!stream || faceState?.faceVisible) && (
                  <div className="framing-brackets">
                    <div className="frame-corner tl" />
                    <div className="frame-corner tr" />
                    <div className="frame-corner bl" />
                    <div className="frame-corner br" />
                  </div>
                )}

                {/* Face Missing / Covered Alert Overlay */}
                {stream && faceState?.liveState === 'FACE_NOT_VISIBLE' && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4 z-10">
                    <div className="bg-[rgba(15,20,30,0.92)] border border-[var(--review-amber)] text-white px-3.5 py-2.5 rounded-[6px] text-xs flex items-center gap-2.5 shadow-xl backdrop-blur-xs">
                      <span className="w-2 h-2 rounded-full bg-[var(--review-amber)] animate-pulse" />
                      <div className="flex flex-col">
                        <span className="font-semibold text-[var(--review-amber)]">
                          {faceState?.isCovered ? 'Camera Lens Obscured / Covered' : 'Face not visible'}
                        </span>
                        <span className="text-[11px] text-[#C0C4C1]">
                          {faceState?.isCovered
                            ? 'Visual evidence temporarily unavailable'
                            : 'Candidate face moved outside camera frame'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Live Tag */}
                <div className="video-live-tag">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--verified-green)]" />
                  <span>{CANDIDATE_DETAILS.name}</span>
                </div>

                {/* Video Telemetry Strip */}
                <div className="video-telemetry-strip font-mono">
                  <span>{stream ? `${streamInfo.resolution} · ${streamInfo.fps}` : 'Camera not started'}</span>
                  <span className={faceState?.isLiveActive ? 'text-[var(--verified-green)]' : 'text-[var(--text-muted)]'}>
                    {faceState?.isLiveActive ? 'Browser sensor active' : 'Sensor idle'}
                  </span>
                </div>
              </div>

              {/* Honest Camera Disclaimer */}
              <div className="text-[10px] text-[var(--text-muted)] italic leading-tight px-1">
                {faceState?.isLiveActive
                  ? 'Browser sensor active: Biometric presence processed locally on-device. Zero raw video uploaded.'
                  : 'Camera not started. Start camera to begin real-time biometric evaluation.'}
              </div>

            {/* Hardware Status Records */}
            <div className="meta-record-card">
              <div className="meta-record-row">
                <div className="flex items-center gap-1.5">
                  <Mic size={13} className={isMicAvailable ? 'text-[var(--verified-green)]' : 'text-[var(--text-muted)]'} />
                  <span>Microphone status:</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--ink-black)]">
                    {isMicAvailable ? 'Microphone ready' : 'Microphone unavailable'}
                  </span>
                  {isMicAvailable && (
                    <div className="audio-waveform-bars">
                      {waveformHeights.map((h, i) => (
                        <span
                          key={i}
                          className="audio-bar-tick"
                          style={{
                            height: `${isPoor ? Math.max(3, h * 0.4) : h}px`,
                            opacity: isPoor ? 0.6 : 1,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="meta-record-row">
                <div className="flex items-center gap-1.5">
                  <Wifi size={13} className={isPoor ? 'text-[var(--review-amber)]' : 'text-[var(--cobalt)]'} />
                  <span>Stream context:</span>
                </div>
                <span className="font-mono text-[var(--ink-black)]">
                  {stream ? streamInfo.bandwidth : 'Waiting for camera'}
                </span>
              </div>

              <div className="meta-record-row">
                <span>Candidate / Stage:</span>
                <strong className="text-[var(--ink-black)] truncate max-w-[180px]">
                  {CANDIDATE_DETAILS.role} • {CANDIDATE_DETAILS.stage}
                </strong>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between gap-2 pt-1">
              {stream ? (
                <button
                  type="button"
                  className="btn-doc btn-doc-sm"
                  onClick={onStopCamera}
                  title="Disconnect camera"
                >
                  <CameraOff size={12} />
                  <span>Stop camera</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-doc btn-doc-sm btn-subtle-cobalt"
                  onClick={onStartCamera}
                  title="Connect webcam"
                >
                  <Camera size={12} />
                  <span>Start camera</span>
                </button>
              )}

              <button
                type="button"
                className="btn-doc btn-doc-sm btn-subtle-cobalt"
                onClick={onRequestVerification}
                title="Dispatch challenge"
              >
                <Zap size={12} />
                <span>Request challenge</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Scenario Jumper */}
        <div className="p-3 bg-[var(--surface-white)] border border-[var(--border-hairline)] rounded-[6px] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Sliders size={13} className="text-[var(--text-muted)]" />
            <span className="text-[var(--text-muted)]">Scenario:</span>
            <strong className="text-[var(--ink-black)] capitalize">{data.name}</strong>
          </div>
          <button
            type="button"
            className="text-[11px] text-[var(--cobalt)] font-medium hover:underline"
            onClick={onGoToLab}
          >
            Demo lab →
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* COLUMN 2: CENTER — Integrity Signal & Flat Confidence Spectrum */}
      {/* ============================================================ */}
      <div className="flex flex-col gap-3">
        {/* Integrity Signal & Spectrum Card */}
        <div className="paper-card confidence-spectrum-box">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="paper-section-title">Integrity signal</span>
              <span className={`scenario-badge ${currentScenario}`}>
                {faceState?.isLiveActive ? 'BROWSER SENSOR' : `DEMO SCENARIO: ${currentScenario === 'low-bandwidth' ? 'LOW BANDWIDTH' : currentScenario.toUpperCase()}`}
              </span>
            </div>
            <span className="text-xs font-mono text-[var(--text-muted)]">
              {CANDIDATE_DETAILS.id}
            </span>
          </div>

          <div className="spectrum-heading-row">
            <div className="flex items-baseline gap-2">
              <span
                className="score-prominent font-mono transition-colors duration-300"
                style={{ color: getStatusColor(data.status) }}
              >
                {data.risk === null ? '--' : animatedRisk}
              </span>
              <span className="text-sm font-mono text-[var(--text-muted)]">{data.risk === null ? '' : '/ 100'}</span>
            </div>

            <div
              className="spectrum-label-tag"
              style={{
                color: getStatusColor(data.status),
                background: getStatusBg(data.status),
                border: `1px solid ${getStatusColor(data.status)}`,
              }}
            >
              {data.status}
            </div>
          </div>

          {/* Flat Confidence Spectrum Track */}
          <div className="spectrum-track-wrap">
            <div className="spectrum-bar-axis">
              {data.risk !== null && (
                <div
                  className="spectrum-pin-indicator"
                  style={{
                    left: `${spectrumPosition}%`,
                    backgroundColor: getStatusColor(data.status),
                  }}
                />
              )}
            </div>
            <div className="spectrum-scale-legend">
              <span className="text-[var(--verified-green)]">Low risk</span>
              <span className="text-[var(--review-amber)]">Review</span>
              <span className="text-[var(--concern-coral)]">High concern</span>
            </div>
          </div>

          <div className="meta-stats-strip">
            <div className="meta-stat-unit">
              <span>Confidence</span>
              <span style={{ color: data.confidence === 'High' ? 'var(--verified-green)' : 'var(--review-amber)' }}>
                {data.confidence}
              </span>
            </div>

            <div className="meta-stat-unit">
              <span>Evidence quality</span>
              <span>{data.quality}</span>
            </div>

            <div className="meta-stat-unit">
              <span>Last updated</span>
              <span className="font-mono">Just now</span>
            </div>
          </div>
        </div>

        {/* 4 Compact Signal Analysis Rows */}
        <div className="paper-card signals-evidence-table">
          <div className="flex items-center justify-between mb-1">
            <span className="paper-section-title">Signal analysis</span>
            <span className="text-[11px] text-[var(--text-muted)] font-mono">
              {faceState?.isLiveActive ? 'Browser sensor' : 'Demo scenario'}
            </span>
          </div>

          {/* Signal 1: Face + Motion */}
          <div className="signal-data-row">
            <div className="signal-title-line">
              <strong className="flex items-center gap-1.5">
                <Video size={13} className="text-[var(--cobalt)]" />
                <span>Face + Motion</span>
                <span
                  className="text-[10px] font-mono font-normal px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: faceState?.isLiveActive ? 'rgba(37,224,255,0.1)' : 'var(--surface-subtle)',
                    color: faceState?.isLiveActive ? 'var(--cobalt)' : 'var(--text-muted)',
                    border: '1px solid var(--border-hairline)',
                  }}
                >
                  {faceState?.isLiveActive ? 'Browser sensor' : 'Demo scenario'}
                </span>
              </strong>
              <span
                className="signal-score-badge font-mono"
                style={{ color: getSignalColor(data.scores.face) }}
              >
                {data.scores.face === null ? 'NOT AVAILABLE' : `${data.scores.face} / 100`}
              </span>
            </div>
            <div className="flat-signal-bar">
              <div
                className="flat-signal-progress"
                style={{
                  width: `${data.scores.face ?? 0}%`,
                  background: data.scores.face === null ? 'var(--review-amber)' : getSignalColor(data.scores.face),
                  opacity: data.scores.face === null ? 0.35 : 1,
                }}
              />
            </div>
            <div className="signal-explainer-subtext">
              {data.scores.face === null
                ? 'Visual evidence temporarily unavailable'
                : (data.scores.face ?? 0) > 70
                ? 'Natural motion is consistent'
                : 'Reduced natural motion'}
            </div>
          </div>

          {/* Signal 2: Voice + Lip Sync */}
          <div className="signal-data-row">
            <div className="signal-title-line">
              <strong>
                <AudioLines size={13} className="text-[#6456B7]" />
                <span>Voice + Lip Sync</span>
              </strong>
              <span
                className="signal-score-badge"
                style={{ color: getSignalColor(data.scores.voice) }}
              >
                {data.scores.voice === null ? 'NOT AVAILABLE' : `${data.scores.voice} / 100`}
              </span>
            </div>
            <div className="flat-signal-bar">
              <div
                className="flat-signal-progress"
                style={{
                  width: `${data.scores.voice ?? 30}%`,
                  background: getSignalColor(data.scores.voice),
                }}
              />
            </div>
            <div className="signal-explainer-subtext">
              {(data.scores.voice ?? 0) > 70
                ? 'Speech timing is aligned'
                : 'Lip-sync timing inconsistency'}
            </div>
          </div>

          {/* Signal 3: Live Challenge */}
          <div className="signal-data-row">
            <div className="signal-title-line">
              <strong>
                <Zap size={13} className="text-[var(--review-amber)]" />
                <span>Live Challenge</span>
              </strong>
              <span
                className="signal-score-badge capitalize font-mono"
                style={{
                  color:
                    data.challenge === 'passed'
                      ? 'var(--verified-green)'
                      : data.challenge === 'partial'
                      ? 'var(--review-amber)'
                      : 'var(--concern-coral)',
                }}
              >
                {data.challenge}
              </span>
            </div>
            <div className="flat-signal-bar">
              <div
                className="flat-signal-progress"
                style={{
                  width:
                    data.challenge === 'passed'
                      ? '100%'
                      : data.challenge === 'partial'
                      ? '50%'
                      : '15%',
                  background:
                    data.challenge === 'passed'
                      ? 'var(--verified-green)'
                      : data.challenge === 'partial'
                      ? 'var(--review-amber)'
                      : 'var(--concern-coral)',
                }}
              />
            </div>
            <div className="signal-explainer-subtext">
              {data.challenge === 'passed'
                ? 'Response recorded'
                : data.challenge === 'partial'
                ? 'Challenge only partially completed'
                : 'Response delayed or unverified'}
            </div>
          </div>

          {/* Signal 4: Stream Context */}
          <div className="signal-data-row">
            <div className="signal-title-line">
              <strong>
                <Wifi size={13} className="text-[var(--verified-green)]" />
                <span>Stream Context</span>
              </strong>
              <span
                className="signal-score-badge"
                style={{ color: getSignalColor(data.scores.stream) }}
              >
                {data.scores.stream === null ? 'NOT AVAILABLE' : `${data.scores.stream} / 100`}
              </span>
            </div>
            <div className="flat-signal-bar">
              <div
                className="flat-signal-progress"
                style={{
                  width: `${data.scores.stream ?? 25}%`,
                  background: getSignalColor(data.scores.stream),
                }}
              />
            </div>
            <div className="signal-explainer-subtext">
              {(data.scores.stream ?? 0) > 60
                ? 'Video continuity is stable'
                : 'Degraded network bandwidth'}
            </div>
          </div>
        </div>

        {/* Why this status? */}
        <div className="rationale-card">
          <div className="rationale-title">Why this status?</div>
          <p className="text-[var(--text-primary)] mb-2">{data.explanation}</p>

          {currentScenario === 'low-bandwidth' && (
            <div className="fairness-banner-box">
              <AlertTriangle size={13} className="flex-shrink-0" />
              <span>Poor video quality lowers confidence. It does not prove dishonesty.</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] mt-2.5">
            <CheckCircle2 size={12} className="text-[var(--verified-green)] flex-shrink-0" />
            <span>Decision-support only. Final hiring decisions remain with the recruiter.</span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* COLUMN 3: RIGHT — Evidence Timeline (Incident Report Style) */}
      {/* ============================================================ */}
      <div className="paper-card flex flex-col">
        <div className="paper-card-header">
          <span className="paper-section-title">Live evidence</span>
          <span className="font-mono text-[11px] text-[var(--text-muted)]">
            {events.length} records
          </span>
        </div>

        <div className="incident-events-list">
          {events.map((evt, idx) => {
            const severityMeta = getSeverityLabel(evt.type)
            return (
              <div key={`${evt.time}-${idx}`} className="incident-row">
                <div className="incident-meta-top">
                  <span className="incident-timestamp">{evt.time}</span>
                  <span className={`incident-severity-tag ${severityMeta.class}`}>
                    {severityMeta.label}
                  </span>
                </div>
                <div className="incident-headline">{evt.title}</div>
                <div className="incident-details-text">{evt.description}</div>
              </div>
            )
          })}
        </div>

        <div className="p-3 border-t border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[11px] text-[var(--text-muted)] flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Clock size={12} className="text-[var(--cobalt)]" />
            <span>Evidence audit</span>
          </span>
          <span className="font-mono text-[var(--ink-black)]">{events.length} events recorded</span>
        </div>
      </div>
    </div>
  </div>
)
}
