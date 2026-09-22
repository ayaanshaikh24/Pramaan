'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Video, AudioLines, Zap, Wifi, Camera, CameraOff, Mic, MicOff,
  AlertTriangle, CheckCircle2, Clock, Sparkles, ShieldAlert,
} from 'lucide-react'
import {
  TimelineEvent, IntegrityStatus, ChallengeStatus, EventType,
} from '@/types/pramaan'
import { useAudioMeter, deriveVoiceScore } from '@/lib/useAudioMeter'
import { getRealStreamInfo, deriveStreamScore } from '@/lib/streamInfo'
import { detectFaceInVideo, initializeFaceDetector, destroyFaceDetector, FaceDetectionResult } from '@/lib/faceDetector'
import { BrowserSpeechSession, isSpeechRecognitionSupported, evaluateChallengePhrase } from '@/lib/speechRecognition'
import { api } from '@/lib/api'
import { subscribeToSession } from '@/lib/socket'
import { useSessionState } from '@/lib/sessionState'

function formatRiskStatus(s: string): IntegrityStatus {
  switch (s) {
    case 'LOW_RISK': return 'Low Risk'
    case 'REVIEW_RECOMMENDED': return 'Review Recommended'
    case 'INSUFFICIENT_EVIDENCE': return 'Insufficient Evidence'
    case 'HIGH_CONCERN': return 'High Concern'
    default: return 'Not evaluated'
  }
}

function formatConfidence(c: string): 'High' | 'Medium' | 'Low' | 'Not available' {
  switch (c) {
    case 'HIGH': return 'High'
    case 'MEDIUM': return 'Medium'
    case 'LOW': return 'Low'
    default: return 'Not available'
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

interface SharedSessionRoomProps {
  sessionId?: string
  isDemoLabActive?: boolean
  onRegisterVideo?: (el: HTMLVideoElement | null) => void
}

export function SharedSessionRoom({
  sessionId = 'PRM-CX0104',
  isDemoLabActive = false,
  onRegisterVideo,
}: SharedSessionRoomProps) {
  const { contract, update, addTimelineEvent, setChallengeStatus, setFaceState, setScores, setRisk } = useSessionState(sessionId)

  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const notify = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage((p) => (p === msg ? null : p)), 3200)
  }, [])

  const [stream, setStreamState] = useState<MediaStream | null>(null)
  const streamRef = useRef(stream)
  streamRef.current = stream
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const { isMicAvailable, audioLevel, waveformHeights } = useAudioMeter(stream)
  const streamInfo = getRealStreamInfo(stream)
  const voiceScore = deriveVoiceScore(isMicAvailable, audioLevel)
  const streamScore = deriveStreamScore(stream)

  const audioLevelRef = useRef(audioLevel)
  useEffect(() => { audioLevelRef.current = audioLevel }, [audioLevel])
  const isMicRef = useRef(isMicAvailable)
  useEffect(() => { isMicRef.current = isMicAvailable }, [isMicAvailable])

  const missingStartTimeRef = useRef<number | null>(null)
  const wasMissingRef = useRef(false)
  const faceVisibleRef = useRef(false)
  const lastSignalSentRef = useRef(0)
  const isSamplingRef = useRef(false)
  const challengeScoreRef = useRef<number | null>(null)

  const [challengePrompt] = useState('Turn your head slightly to the right and say BLUE 47.')
  const [countdownSeconds, setCountdownSeconds] = useState(20)
  const [speechActive, setSpeechActive] = useState(false)
  const [speechTranscript, setSpeechTranscript] = useState('')
  const [hasSpeechSupport, setHasSpeechSupport] = useState(false)
  const speechSessionRef = useRef<BrowserSpeechSession | null>(null)
  const activeChallengeIdRef = useRef<string | null>(null)

  useEffect(() => { setHasSpeechSupport(isSpeechRecognitionSupported()) }, [])

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => {})
    }
    if (onRegisterVideo) onRegisterVideo(videoRef.current)
  }, [stream, onRegisterVideo])

  useEffect(() => {
    let unsubscribe: (() => void) | null = null
    async function initSocket() {
      try {
        await api.auth.demoLogin()
        unsubscribe = subscribeToSession(sessionId, {
          onRiskUpdate: (res) => {
            update({ riskScore: res.riskScore ?? null, riskStatus: res.riskStatus ? formatRiskStatus(res.riskStatus) : contract.riskStatus })
          },
          onSignalUpdate: (res) => {
            if (res.signals) {
              setScores({
                face: res.signals.faceMotionScore ?? null,
                voice: res.signals.lipSyncScore ?? null,
                challenge: res.signals.challengeScore ?? null,
                stream: res.signals.streamQualityScore ?? null,
              })
            }
          },
          onChallengeIssued: (res) => {
            if (res.challenge) {
              update({ challengePrompt: res.challenge.prompt })
              setChallengeStatus('waiting_for_response')
              setCountdownSeconds(20)
            }
          },
          onChallengeResult: (res) => {
            if (res.challenge) {
              const rs = res.challenge.status.toLowerCase() as ChallengeStatus
              const score = rs === 'passed' ? 100 : rs === 'partial' ? 50 : 0
              challengeScoreRef.current = rs === 'failed' ? 0 : score
              update({ challengeStatus: rs, scores: { ...contract.scores, challenge: score } })
            }
          },
          onIntegrityEvent: (res) => {
            if (res.event) {
              addTimelineEvent({
                time: formatTime(new Date(res.event.createdAt)),
                title: res.event.title,
                description: res.event.description,
                type: res.event.type?.toLowerCase() === 'warning' ? 'warning' : res.event.type?.toLowerCase() === 'verified' ? 'normal' : 'info',
              })
            }
          },
        })
      } catch { /* socket unavailable */ }
    }
    initSocket()
    return () => { if (unsubscribe) unsubscribe() }
  }, [sessionId])

  const handleStartCamera = async () => {
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('Webcam API not supported in this browser')
      }
      update({ cameraStatus: 'NOT_STARTED' })
      const initRes = await initializeFaceDetector()
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      setStreamState(mediaStream)
      update({ cameraStatus: 'ACTIVE' })
      setFaceState((prev) => ({
        ...prev,
        liveState: initRes.success ? 'DETECTOR_LOADING' : 'DETECTOR_UNAVAILABLE',
        isLiveActive: true,
        faceVisible: false,
        confidence: 0,
        motionScore: null,
        detectorStatus: initRes.success ? 'ready' : 'unavailable',
        detectorType: initRes.detectorType,
      }))
      notify(initRes.success ? 'Camera & microphone active — Browser sensor connected' : 'Face detector unavailable — local model failed to load')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Camera access denied'
      setCameraError(msg)
      update({ cameraStatus: 'PERMISSION_DENIED' })
      setFaceState((prev) => ({ ...prev, liveState: 'CAMERA_PERMISSION_DENIED', isLiveActive: false }))
      notify('Camera permission denied')
    }
  }

  const handleStopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      setStreamState(null)
    }
    destroyFaceDetector()
    missingStartTimeRef.current = null
    wasMissingRef.current = false
    faceVisibleRef.current = false
    lastSignalSentRef.current = 0

    setFaceState({
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
    })

    update({
      cameraStatus: 'STOPPED',
      riskScore: null,
      riskStatus: 'Not evaluated',
      confidence: null,
      evidenceQuality: 'Not available',
      scores: { face: null, voice: null, challenge: contract.scores.challenge, stream: null },
      visualEvidenceAvailable: false,
    })
    notify('Camera disconnected & face detector unloaded')
  }

  useEffect(() => {
    if (!streamRef.current || isDemoLabActive) return

    const sendVisibleSignals = async (result: FaceDetectionResult) => {
      const faceScore = result.motionScore
      const voice = deriveVoiceScore(isMicRef.current, audioLevelRef.current)
      const quality = deriveStreamScore(streamRef.current)

      update({
        scores: { ...contract.scores, face: faceScore, voice, stream: quality },
        visualEvidenceAvailable: true,
      })
      lastSignalSentRef.current = Date.now()

      try {
        const res = await api.sessions.sendSignals(sessionId, {
          faceMotionScore: faceScore,
          lipSyncScore: voice,
          challengeScore: challengeScoreRef.current,
          streamQualityScore: quality,
          visualEvidenceAvailable: true,
          audioEvidenceAvailable: isMicRef.current,
        })
        update({ riskScore: res.riskScore, riskStatus: formatRiskStatus(res.riskStatus), confidence: formatConfidence(res.confidence) })
      } catch { /* backend unreachable */ }
    }

    const sendMissingSignals = async () => {
      update({
        riskScore: null,
        riskStatus: 'Insufficient Evidence',
        confidence: 'Low',
        evidenceQuality: 'Degraded',
        scores: { ...contract.scores, face: null, voice: null, stream: null },
        visualEvidenceAvailable: false,
      })
      lastSignalSentRef.current = Date.now()
      try {
        await api.sessions.sendSignals(sessionId, {
          faceMotionScore: null, lipSyncScore: null, challengeScore: null, streamQualityScore: null,
          visualEvidenceAvailable: false, audioEvidenceAvailable: isMicRef.current,
        })
      } catch { /* backend unreachable */ }
    }

    const interval = setInterval(async () => {
      const videoEl = videoRef.current
      if (!videoEl || videoEl.readyState < 2 || isSamplingRef.current) return
      isSamplingRef.current = true
      try {
        const result = await detectFaceInVideo(videoEl)
        if (result.detectorStatus === 'loading') return

        if (result.detectorStatus === 'unavailable') {
          faceVisibleRef.current = false
          wasMissingRef.current = false
          missingStartTimeRef.current = null
          setFaceState((prev) => ({ ...prev, liveState: 'DETECTOR_UNAVAILABLE', faceVisible: false, confidence: 0, motionScore: null }))
          return
        }

        if (result.faceDetected) {
          const hadBeenMissing = wasMissingRef.current
          const firstVisible = !faceVisibleRef.current
          faceVisibleRef.current = true
          wasMissingRef.current = false
          missingStartTimeRef.current = null

          if (hadBeenMissing) {
            notify('Face visible again')
            addTimelineEvent({ time: formatTime(new Date()), title: 'Visual evidence restored', description: 'Candidate face returned to the browser camera frame.', type: 'normal' })
            await sendVisibleSignals(result)
            try { await api.sessions.createEvent(sessionId, { type: 'VERIFIED', title: 'Visual evidence restored', description: 'Candidate face returned to the camera frame.', severity: 'normal' }) } catch { /* */ }
          } else if (firstVisible) {
            notify('Face visible — Browser sensor connected')
            await sendVisibleSignals(result)
          } else if (Date.now() - lastSignalSentRef.current >= 3000) {
            await sendVisibleSignals(result)
          }

          setFaceState((prev) => ({ ...prev, liveState: 'FACE_VISIBLE', isLiveActive: true, faceVisible: true, confidence: result.confidence, motionScore: result.motionScore, isCovered: false, isOutsideFrame: false, missingDurationMs: 0, detectorStatus: 'ready', detectorType: result.detectorType, box: result.box, landmarks: result.landmarks }))
        } else {
          if (missingStartTimeRef.current === null) missingStartTimeRef.current = Date.now()
          const elapsed = Date.now() - missingStartTimeRef.current

          if (elapsed >= 1500 && !wasMissingRef.current) {
            wasMissingRef.current = true
            faceVisibleRef.current = false
            notify('Face not visible')
            addTimelineEvent({ time: formatTime(new Date()), title: 'Face no longer visible', description: 'Visual evidence is temporarily unavailable. This does not prove dishonesty.', type: 'warning' })
            await sendMissingSignals()
            try { await api.sessions.createEvent(sessionId, { type: 'WARNING', title: 'Face no longer visible', description: 'Visual evidence is temporarily unavailable. This does not prove dishonesty.', severity: 'warning' }) } catch { /* */ }
          }

          setFaceState((prev) => ({
            ...prev,
            liveState: elapsed >= 1500 ? 'FACE_NOT_VISIBLE' : prev.liveState,
            isLiveActive: true,
            faceVisible: elapsed >= 1500 ? false : prev.faceVisible,
            confidence: elapsed >= 1500 ? 0 : prev.confidence,
            motionScore: elapsed >= 1500 ? null : prev.motionScore,
            isCovered: result.isCovered,
            isOutsideFrame: result.isOutsideFrame,
            missingDurationMs: elapsed,
            box: undefined,
          }))
        }
      } catch { /* detection tick error */ }
      finally { isSamplingRef.current = false }
    }, 300)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream, isDemoLabActive, sessionId])

  const handleRequestChallenge = async () => {
    setChallengeStatus('waiting_for_response')
    setCountdownSeconds(20)
    setSpeechTranscript('')
    notify('Live challenge requested — awaiting candidate response')

    let challengeId: string | null = null
    try {
      const issued = await api.challenges.issue(sessionId)
      if (issued.challenge?.id) challengeId = issued.challenge.id
      activeChallengeIdRef.current = challengeId
    } catch { /* backend unavailable */ }

    if (isSpeechRecognitionSupported()) {
      setSpeechActive(true)
      if (speechSessionRef.current) speechSessionRef.current.abort()
      const session = new BrowserSpeechSession({
        expectedPhrase: challengePrompt,
        lang: 'en-US',
        onTranscript: setSpeechTranscript,
        onOutcome: (outcome, transcript) => { setSpeechActive(false); setSpeechTranscript(transcript); handleCompleteChallenge(outcome, transcript, challengeId, 'Speech recognition') },
        onError: (err) => console.warn('[PRAMAAN] Speech error:', err),
        onEnd: () => setSpeechActive(false),
      })
      speechSessionRef.current = session
      session.start()
    } else {
      setHasSpeechSupport(false)
      notify('Speech verification unavailable — recruiter confirmation required')
    }
  }

  const handleCompleteChallenge = async (outcome: 'passed' | 'partial' | 'failed', transcript?: string, challengeId?: string | null, source: 'Speech recognition' | 'Recruiter recorded' = 'Speech recognition') => {
    setChallengeStatus(outcome)
    setSpeechActive(false)
    const score = outcome === 'passed' ? 100 : outcome === 'partial' ? 50 : 0
    challengeScoreRef.current = score

    const eventTitle = outcome === 'passed'
      ? (source === 'Recruiter recorded' ? 'Challenge passed — Recruiter recorded' : 'Challenge passed')
      : outcome === 'partial'
        ? 'Challenge partially completed'
        : 'Challenge failed'
    const eventDesc = source === 'Recruiter recorded'
      ? `Recruiter recorded outcome: ${outcome.toUpperCase()}.`
      : transcript
        ? `Candidate response: "${transcript}" — Result: ${outcome.toUpperCase()}.`
        : `Challenge outcome evaluated as ${outcome.toUpperCase()}.`

    addTimelineEvent({ time: formatTime(new Date()), title: eventTitle, description: eventDesc, type: outcome === 'passed' ? 'normal' : outcome === 'partial' ? 'warning' : 'critical' })

    update({ scores: { ...contract.scores, challenge: score } })
    notify(source === 'Recruiter recorded' ? `Challenge recorded: ${outcome.toUpperCase()} (Recruiter)` : `Challenge evaluated: ${outcome.toUpperCase()}`)

    const cid = challengeId || activeChallengeIdRef.current
    if (cid) {
      try { await api.challenges.submitResult(cid, outcome.toUpperCase() as 'PASSED' | 'PARTIAL' | 'FAILED') } catch { /* */ }
    }
  }

  useEffect(() => {
    if (contract.challengeStatus !== 'waiting_for_response' || !hasSpeechSupport) return
    if (countdownSeconds <= 0) { handleCompleteChallenge('failed', 'Response window expired (20s)'); return }
    const timer = setTimeout(() => setCountdownSeconds((p) => p - 1), 1000)
    return () => clearTimeout(timer)
  }, [contract.challengeStatus, countdownSeconds, hasSpeechSupport])

  const getStatusColor = (s: string) => {
    if (s === 'Low Risk') return 'var(--verified-green)'
    if (s === 'Review Recommended') return 'var(--concern-coral)'
    if (s === 'Insufficient Evidence') return 'var(--review-amber)'
    return 'var(--text-muted)'
  }

  const getStatusBg = (s: string) => {
    if (s === 'Low Risk') return 'var(--verified-bg)'
    if (s === 'Review Recommended') return 'var(--concern-bg)'
    if (s === 'Insufficient Evidence') return 'var(--review-bg)'
    return 'var(--surface-subtle)'
  }

  const getSignalColor = (score: number | null) => {
    if (score === null) return 'var(--review-amber)'
    if (score >= 80) return 'var(--verified-green)'
    if (score >= 50) return 'var(--review-amber)'
    return 'var(--concern-coral)'
  }

  const getSeverityLabel = (type: EventType) => {
    switch (type) {
      case 'critical': return { label: 'CRITICAL', class: 'critical' }
      case 'warning': return { label: 'WARNING', class: 'warning' }
      case 'normal': return { label: 'VERIFIED', class: 'normal' }
      case 'info': return { label: 'SYSTEM', class: 'info' }
    }
  }

  const faceState = contract.faceState

  return (
    <div className="flex flex-col gap-3">
      {toastMessage && (
        <div className="evidence-toast" role="status">
          <CheckCircle2 size={14} className="text-[#198754]" />
          <span>{toastMessage}</span>
        </div>
      )}
      <div className="shared-session-grid">
        {/* LEFT PANEL: CANDIDATE */}
        <div className="flex flex-col gap-3">
          {/* Camera & Face Card */}
          <div className="paper-card">
            <div className="paper-card-header">
              <span className="paper-section-title">Candidate Video Stream</span>
              {faceState.liveState === 'WAITING_FOR_CAMERA' && <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-[var(--border-strong)]" /> Waiting for camera</span>}
              {faceState.liveState === 'FACE_VISIBLE' && <span className="text-[11px] text-[var(--verified-green)] flex items-center gap-1.5 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-[var(--verified-green)]" /> Face visible · Browser sensor active</span>}
              {faceState.liveState === 'FACE_NOT_VISIBLE' && <span className="text-[11px] text-[var(--review-amber)] flex items-center gap-1.5 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-[var(--review-amber)] animate-pulse" /> Face not visible</span>}
              {faceState.liveState === 'DETECTOR_LOADING' && <span className="text-[11px] text-[var(--cobalt)] flex items-center gap-1.5 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-[var(--cobalt)] animate-pulse" /> Detector loading…</span>}
              {faceState.liveState === 'DETECTOR_UNAVAILABLE' && <span className="text-[11px] text-[var(--concern-coral)] flex items-center gap-1.5 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-[var(--concern-coral)]" /> Face detector unavailable</span>}
              {faceState.liveState === 'CAMERA_PERMISSION_DENIED' && <span className="text-[11px] text-[var(--concern-coral)] flex items-center gap-1.5 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-[var(--concern-coral)]" /> Camera permission denied</span>}
            </div>
            <div className="p-3 flex flex-col gap-3">
              <div className="video-preview-box relative">
                {stream ? (
                  <video ref={videoRef} autoPlay muted playsInline className="video-element-fit" />
                ) : (
                  <div className="fallback-video-slate">
                    <Camera size={28} className="text-[#8E928F]" />
                    <div className="text-xs font-semibold text-white">{cameraError ? 'Camera unavailable' : 'Camera not started'}</div>
                    <div className="text-[11px] text-[#A6AAA7] max-w-[220px]">{cameraError || 'Click "Start camera" to initialize local MediaPipe detector.'}</div>
                  </div>
                )}
                {stream && faceState.faceVisible && faceState.box && (
                  <div className="face-detected-bounding-box" style={{ left: `${faceState.box.x}%`, top: `${faceState.box.y}%`, width: `${faceState.box.width}%`, height: `${faceState.box.height}%` }}>
                    <div className="face-box-label">Face visible · {faceState.confidence}%</div>
                  </div>
                )}
                {(!stream || faceState.faceVisible) && (
                  <div className="framing-brackets">
                    <div className="frame-corner tl" /><div className="frame-corner tr" /><div className="frame-corner bl" /><div className="frame-corner br" />
                  </div>
                )}
                {stream && faceState.liveState === 'FACE_NOT_VISIBLE' && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4 z-10">
                    <div className="bg-[rgba(15,20,30,0.92)] border border-[var(--review-amber)] text-white px-3.5 py-2.5 rounded-[6px] text-xs flex items-center gap-2.5 shadow-xl backdrop-blur-xs">
                      <span className="w-2 h-2 rounded-full bg-[var(--review-amber)] animate-pulse" />
                      <div className="flex flex-col">
                        <span className="font-semibold text-[var(--review-amber)]">Face not visible</span>
                        <span className="text-[11px] text-[#C0C4C1]">Visual evidence temporarily unavailable.</span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="video-telemetry-strip font-mono">
                  <span>{stream ? `${streamInfo.resolution} · ${streamInfo.fps}` : 'Camera not started'}</span>
                  <span className={faceState.isLiveActive ? 'text-[var(--verified-green)]' : 'text-[var(--text-muted)]'}>{faceState.isLiveActive ? 'Browser sensor active' : 'Sensor idle'}</span>
                </div>
              </div>
              <div className="meta-record-card">
                <div className="meta-record-row">
                  <div className="flex items-center gap-1.5">
                    {isMicAvailable ? <Mic size={13} className="text-[var(--verified-green)]" /> : <MicOff size={13} className="text-[var(--text-muted)]" />}
                    <span>Microphone status:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[var(--ink-black)]">{isMicAvailable ? 'Microphone ready' : 'Microphone unavailable'}</span>
                    {isMicAvailable && (
                      <div className="audio-waveform-bars">
                        {waveformHeights.map((h, i) => <span key={i} className="audio-bar-tick" style={{ height: `${h}px` }} />)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="meta-record-row">
                  <div className="flex items-center gap-1.5"><Wifi size={13} className="text-[var(--cobalt)]" /><span>Stream context:</span></div>
                  <span className="font-mono text-[var(--ink-black)]">{stream ? streamInfo.bandwidth : 'Waiting for camera'}</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--border-hairline)]">
                {stream ? (
                  <button type="button" className="btn-doc btn-doc-sm" onClick={handleStopCamera}><CameraOff size={12} /><span>Stop camera</span></button>
                ) : (
                  <button type="button" className="btn-doc btn-doc-sm btn-primary-cobalt" onClick={handleStartCamera}><Camera size={12} /><span>Start camera</span></button>
                )}
                <button type="button" className="btn-doc btn-doc-sm btn-subtle-cobalt" onClick={handleRequestChallenge} disabled={contract.challengeStatus === 'waiting_for_response'}><Zap size={12} /><span>Request challenge</span></button>
              </div>
            </div>
          </div>

          {/* Live Challenge Card */}
          <div className="paper-card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="paper-section-title">Live Challenge</span>
                <div className="text-xs text-[var(--ink-black)] font-medium mt-0.5">Speech & Presence Verification</div>
              </div>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded uppercase" style={{ backgroundColor: contract.challengeStatus === 'passed' ? 'var(--verified-bg)' : contract.challengeStatus === 'partial' ? 'var(--review-bg)' : contract.challengeStatus === 'failed' ? 'var(--concern-bg)' : 'var(--surface-subtle)', color: contract.challengeStatus === 'passed' ? 'var(--verified-green)' : contract.challengeStatus === 'partial' ? 'var(--review-amber)' : contract.challengeStatus === 'failed' ? 'var(--concern-coral)' : 'var(--text-muted)', border: '1px solid var(--border-hairline)' }}>
                {contract.challengeStatus === 'waiting_for_response' ? !hasSpeechSupport ? 'Waiting (recruiter)' : `Waiting (${countdownSeconds}s)` : contract.challengeStatus === 'pending' ? 'Pending' : contract.challengeStatus}
              </span>
              {contract.challengeStatus === 'waiting_for_response' && hasSpeechSupport && (
                <div className="flex items-center gap-1 font-mono text-xs text-[var(--cobalt)] bg-[var(--cobalt-subtle)] px-2 py-0.5 rounded"><Clock size={11} /><span>{countdownSeconds}s</span></div>
              )}
            </div>
            <div className="challenge-quote-plate">
              <div className="text-[10px] text-[var(--cobalt)] font-semibold uppercase tracking-wider mb-1">Challenge Prompt</div>
              <div className="text-xs font-semibold text-[var(--ink-black)]">"{challengePrompt}"</div>
            </div>
            {contract.challengeStatus === 'waiting_for_response' && (
              <div className="p-2.5 rounded bg-[var(--cobalt-subtle)] border border-[rgba(49,91,255,0.2)] text-xs flex flex-col gap-1">
                <div className="flex items-center gap-2 text-[var(--cobalt)] font-semibold text-[11px]">
                  {hasSpeechSupport ? <Sparkles size={12} className="animate-spin" /> : <Clock size={12} />}
                  <span>{!hasSpeechSupport ? 'Speech verification unavailable — awaiting recruiter confirmation' : speechActive ? 'Listening for candidate speech…' : 'Speech processing…'}</span>
                </div>
                {speechTranscript && <div className="font-mono text-[11px] text-[var(--ink-black)] bg-white/70 p-1.5 rounded border border-[var(--border-hairline)]">Detected: &ldquo;{speechTranscript}&rdquo;</div>}
              </div>
            )}
            {(!hasSpeechSupport || contract.challengeStatus === 'waiting_for_response') && (
              <div className="pt-2 border-t border-[var(--border-hairline)] flex flex-col gap-1.5">
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">{!hasSpeechSupport ? 'Speech verification unavailable — recruiter confirmation required' : 'Recruiter manual override:'}</span>
                <div className="flex items-center gap-2">
                  <button type="button" className="btn-doc btn-doc-sm flex-1" onClick={() => handleCompleteChallenge('passed', undefined, null, 'Recruiter recorded')}><CheckCircle2 size={11} className="text-[var(--verified-green)]" /><span>Pass (Recruiter recorded)</span></button>
                  <button type="button" className="btn-doc btn-doc-sm flex-1" onClick={() => handleCompleteChallenge('partial', undefined, null, 'Recruiter recorded')}><AlertTriangle size={11} className="text-[var(--review-amber)]" /><span>Partial (Recruiter recorded)</span></button>
                  <button type="button" className="btn-doc btn-doc-sm flex-1" onClick={() => handleCompleteChallenge('failed', undefined, null, 'Recruiter recorded')}><AlertTriangle size={11} className="text-[var(--concern-coral)]" /><span>Fail (Recruiter recorded)</span></button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: RECRUITER */}
        <div className="flex flex-col gap-3">
          <div className="paper-card confidence-spectrum-box">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="paper-section-title">Integrity Signal</span>
                <span className="scenario-badge normal">{isDemoLabActive ? 'Demo scenario' : 'Browser sensor'}</span>
              </div>
              <span className="text-xs font-mono text-[var(--text-muted)]">{sessionId}</span>
            </div>
            <div className="spectrum-heading-row">
              <div className="flex items-baseline gap-2">
                <span className="score-prominent font-mono transition-colors duration-300" style={{ color: getStatusColor(contract.riskStatus) }}>{contract.riskScore === null ? '--' : contract.riskScore}</span>
                <span className="text-sm font-mono text-[var(--text-muted)]">{contract.riskScore === null ? '' : '/ 100'}</span>
              </div>
              <div className="spectrum-label-tag" style={{ color: getStatusColor(contract.riskStatus), background: getStatusBg(contract.riskStatus), border: `1px solid ${getStatusColor(contract.riskStatus)}` }}>{contract.riskStatus}</div>
            </div>
            <div className="spectrum-track-wrap">
              <div className="spectrum-bar-axis">
                {contract.riskScore !== null && <div className="spectrum-pin-indicator" style={{ left: `${Math.min(100, Math.max(0, contract.riskScore))}%`, backgroundColor: getStatusColor(contract.riskStatus) }} />}
              </div>
              <div className="spectrum-scale-legend"><span className="text-[var(--verified-green)]">Low risk</span><span className="text-[var(--review-amber)]">Review</span><span className="text-[var(--concern-coral)]">High concern</span></div>
            </div>
            <div className="meta-stats-strip">
              <div className="meta-stat-unit"><span>Confidence</span><span style={{ color: contract.confidence === 'High' ? 'var(--verified-green)' : contract.confidence === 'Low' ? 'var(--review-amber)' : 'var(--text-muted)' }}>{contract.confidence}</span></div>
              <div className="meta-stat-unit"><span>Evidence quality</span><span>{contract.evidenceQuality}</span></div>
              <div className="meta-stat-unit"><span>Last updated</span><span className="font-mono">{faceState.isLiveActive ? 'Live sensor' : 'Waiting'}</span></div>
            </div>
          </div>

          <div className="paper-card signals-evidence-table">
            <div className="flex items-center justify-between mb-1">
              <span className="paper-section-title">Signal Analysis</span>
              <span className="text-[11px] text-[var(--text-muted)] font-mono">{isDemoLabActive ? 'Demo scenario' : 'Browser sensor'}</span>
            </div>
            <div className="signal-data-row">
              <div className="signal-title-line">
                <strong className="flex items-center gap-1.5"><Video size={13} className="text-[var(--cobalt)]" /><span>Face + Motion</span><span className="text-[10px] font-mono font-normal px-1.5 py-0.5 rounded" style={{ backgroundColor: faceState.isLiveActive ? 'rgba(37,224,255,0.1)' : 'var(--surface-subtle)', color: faceState.isLiveActive ? 'var(--cobalt)' : 'var(--text-muted)', border: '1px solid var(--border-hairline)' }}>{faceState.isLiveActive ? 'Browser sensor' : 'Demo scenario'}</span></strong>
                <span className="signal-score-badge font-mono" style={{ color: getSignalColor(contract.scores.face) }}>{contract.scores.face === null ? faceState.liveState === 'WAITING_FOR_CAMERA' ? 'Waiting for camera' : 'NOT AVAILABLE' : `${contract.scores.face} / 100`}</span>
              </div>
              <div className="flat-signal-bar"><div className="flat-signal-progress" style={{ width: `${contract.scores.face ?? 0}%`, background: contract.scores.face === null ? 'var(--border-strong)' : getSignalColor(contract.scores.face), opacity: contract.scores.face === null ? 0.3 : 1 }} /></div>
              <div className="signal-explainer-subtext">{contract.scores.face === null ? faceState.liveState === 'WAITING_FOR_CAMERA' ? 'Camera not started. Waiting for browser sensor.' : 'Visual evidence temporarily unavailable' : 'Natural motion is consistent'}</div>
            </div>
            <div className="signal-data-row">
              <div className="signal-title-line">
                <strong><AudioLines size={13} className="text-[#6456B7]" /><span>Voice + Lip Sync</span></strong>
                <span className="signal-score-badge" style={{ color: getSignalColor(contract.scores.voice) }}>{contract.scores.voice === null ? isMicAvailable ? 'Microphone active' : 'Waiting for mic' : `${contract.scores.voice} / 100`}</span>
              </div>
              <div className="flat-signal-bar"><div className="flat-signal-progress" style={{ width: `${contract.scores.voice ?? 0}%`, background: getSignalColor(contract.scores.voice ?? null) }} /></div>
              <div className="signal-explainer-subtext">{isMicAvailable ? contract.scores.voice === null ? 'Microphone active — waiting for face signal' : 'Microphone activity measured from real audio analyser' : 'Waiting for microphone audio sensor.'}</div>
            </div>
            <div className="signal-data-row">
              <div className="signal-title-line">
                <strong><Zap size={13} className="text-[var(--review-amber)]" /><span>Live Challenge</span></strong>
                <span className="signal-score-badge capitalize font-mono" style={{ color: contract.challengeStatus === 'passed' ? 'var(--verified-green)' : contract.challengeStatus === 'partial' ? 'var(--review-amber)' : 'var(--concern-coral)' }}>{contract.challengeStatus}</span>
              </div>
              <div className="flat-signal-bar"><div className="flat-signal-progress" style={{ width: contract.challengeStatus === 'passed' ? '100%' : contract.challengeStatus === 'partial' ? '50%' : contract.challengeStatus === 'failed' ? '15%' : '0%', background: contract.challengeStatus === 'passed' ? 'var(--verified-green)' : contract.challengeStatus === 'partial' ? 'var(--review-amber)' : 'var(--concern-coral)' }} /></div>
              <div className="signal-explainer-subtext">{contract.challengeStatus === 'passed' ? 'Response recorded' : contract.challengeStatus === 'partial' ? 'Challenge only partially completed' : 'Response delayed or unverified'}</div>
            </div>
            <div className="signal-data-row">
              <div className="signal-title-line">
                <strong><Wifi size={13} className="text-[var(--verified-green)]" /><span>Stream Context</span></strong>
                <span className="signal-score-badge" style={{ color: getSignalColor(contract.scores.stream) }}>{contract.scores.stream === null ? 'Waiting for camera' : `${contract.scores.stream} / 100`}</span>
              </div>
              <div className="flat-signal-bar"><div className="flat-signal-progress" style={{ width: `${contract.scores.stream ?? 0}%`, background: contract.scores.stream === null ? 'var(--border-strong)' : getSignalColor(contract.scores.stream), opacity: contract.scores.stream === null ? 0.3 : 1 }} /></div>
              <div className="signal-explainer-subtext">{contract.scores.stream === null ? 'Waiting for camera stream.' : (contract.scores.stream ?? 0) > 60 ? 'Video continuity is stable' : 'Degraded network bandwidth'}</div>
            </div>
          </div>

          <div className="paper-card flex flex-col">
            <div className="paper-card-header"><span className="paper-section-title">Live evidence</span><span className="font-mono text-[11px] text-[var(--text-muted)]">{contract.timeline.length} records</span></div>
            <div className="incident-events-list">
              {contract.timeline.map((evt, idx) => {
                const sev = getSeverityLabel(evt.type)
                return (
                  <div key={`${evt.time}-${idx}`} className="incident-row">
                    <div className="incident-meta-top"><span className="incident-timestamp">{evt.time}</span><span className={`incident-severity-tag ${sev.class}`}>{sev.label}</span></div>
                    <div className="incident-headline">{evt.title}</div>
                    <div className="incident-details-text">{evt.description}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
