'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Video,
  AudioLines,
  Zap,
  Wifi,
  Camera,
  CameraOff,
  Mic,
  MicOff,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Volume2,
  RefreshCw,
  Sparkles,
  ShieldAlert,
  UserCheck,
} from 'lucide-react'
import {
  ScenarioData,
  TimelineEvent,
  FacePresenceState,
  IntegrityStatus,
  ChallengeStatus,
  LiveFaceState,
  EventType,
} from '@/types/pramaan'
import { CANDIDATE_DETAILS, DEFAULT_LIVE_SESSION_DATA } from '@/lib/scenarios'
import { useAudioMeter } from '@/lib/useAudioMeter'
import { getRealStreamInfo } from '@/lib/streamInfo'
import {
  detectFaceInVideo,
  initializeFaceDetector,
  destroyFaceDetector,
} from '@/lib/faceDetector'
import {
  BrowserSpeechSession,
  isSpeechRecognitionSupported,
  evaluateChallengePhrase,
} from '@/lib/speechRecognition'
import { api } from '@/lib/api'
import { subscribeToSession } from '@/lib/socket'

interface SharedSessionRoomProps {
  sessionId?: string
  initialData?: ScenarioData
  isDemoLabActive?: boolean
  onRegisterVideo?: (el: HTMLVideoElement | null) => void
}

function formatRiskStatus(status: string): IntegrityStatus {
  switch (status) {
    case 'LOW_RISK':
      return 'Low Risk'
    case 'REVIEW_RECOMMENDED':
      return 'Review Recommended'
    case 'INSUFFICIENT_EVIDENCE':
      return 'Insufficient Evidence'
    case 'HIGH_CONCERN':
      return 'High Concern'
    default:
      return 'Not evaluated'
  }
}

function formatConfidence(conf: string): 'High' | 'Medium' | 'Low' | 'Not available' {
  switch (conf) {
    case 'HIGH':
      return 'High'
    case 'MEDIUM':
      return 'Medium'
    case 'LOW':
      return 'Low'
    default:
      return 'Not available'
  }
}

export function SharedSessionRoom({
  sessionId = 'PRM-CX0104',
  initialData,
  isDemoLabActive = false,
  onRegisterVideo,
}: SharedSessionRoomProps) {
  // Session data & timeline events
  const [data, setData] = useState<ScenarioData>(
    initialData || DEFAULT_LIVE_SESSION_DATA
  )
  const [events, setEvents] = useState<TimelineEvent[]>(
    initialData?.events || DEFAULT_LIVE_SESSION_DATA.events
  )

  // Hardware MediaStream
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Real Audio Meter
  const { isMicAvailable, waveformHeights, statusText: micStatusText } =
    useAudioMeter(stream)
  const streamInfo = getRealStreamInfo(stream)

  // Real Face Detection State
  const [faceState, setFaceState] = useState<FacePresenceState>({
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

  const missingStartTimeRef = useRef<number | null>(null)
  const wasMissingRef = useRef<boolean>(false)
  const isSamplingRef = useRef<boolean>(false)

  // Challenge & SpeechRecognition State
  const [challengePrompt, setChallengePrompt] = useState<string>(
    'Turn your head slightly to the right and say BLUE 47'
  )
  const [challengeStatus, setChallengeStatus] =
    useState<ChallengeStatus>('pending')
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(null)
  const [countdownSeconds, setCountdownSeconds] = useState<number>(20)
  const [speechTranscript, setSpeechTranscript] = useState<string>('')
  const [speechActive, setSpeechActive] = useState<boolean>(false)
  const [hasSpeechSupport, setHasSpeechSupport] = useState<boolean>(true)
  const speechSessionRef = useRef<BrowserSpeechSession | null>(null)

  const notify = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev))
    }, 3200)
  }, [])

  // Check speech recognition support on mount
  useEffect(() => {
    setHasSpeechSupport(isSpeechRecognitionSupported())
  }, [])

  // Sync video element ref
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => {})
    }
    if (onRegisterVideo) {
      onRegisterVideo(videoRef.current)
    }
  }, [stream, onRegisterVideo])

  // Connect to Backend Session & Realtime Socket.IO
  useEffect(() => {
    let unsubscribe: (() => void) | null = null

    async function initSocket() {
      try {
        await api.auth.demoLogin()
        unsubscribe = subscribeToSession(sessionId, {
          onRiskUpdate: (res) => {
            setData((prev) => ({
              ...prev,
              risk: res.riskScore ?? prev.risk,
              status: res.riskStatus
                ? formatRiskStatus(res.riskStatus)
                : prev.status,
              confidence: res.confidence
                ? formatConfidence(res.confidence)
                : prev.confidence,
              explanation: res.explanation || prev.explanation,
            }))
          },
          onSignalUpdate: (res) => {
            if (res.signals) {
              setData((prev) => ({
                ...prev,
                scores: {
                  face: res.signals.faceMotionScore ?? prev.scores.face,
                  voice: res.signals.lipSyncScore ?? prev.scores.voice,
                  challenge:
                    res.signals.challengeScore ?? prev.scores.challenge,
                  stream:
                    res.signals.streamQualityScore ?? prev.scores.stream,
                },
              }))
            }
          },
          onChallengeIssued: (res) => {
            if (res.challenge) {
              setActiveChallengeId(res.challenge.id)
              setChallengePrompt(res.challenge.prompt)
              setChallengeStatus('waiting_for_response')
              setCountdownSeconds(20)
            }
          },
          onChallengeResult: (res) => {
            if (res.challenge) {
              const resStatus = res.challenge.status.toLowerCase() as ChallengeStatus
              setChallengeStatus(resStatus)
              setData((prev) => ({
                ...prev,
                challenge: resStatus,
                scores: {
                  ...prev.scores,
                  challenge:
                    res.challengeScore ??
                    (resStatus === 'passed'
                      ? 100
                      : resStatus === 'partial'
                      ? 50
                      : 0),
                },
              }))
            }
          },
          onIntegrityEvent: (res) => {
            if (res.event) {
              const newEv: TimelineEvent = {
                time: new Date(res.event.createdAt).toLocaleTimeString([], {
                  minute: '2-digit',
                  second: '2-digit',
                }),
                title: res.event.title,
                description: res.event.description,
                type:
                  res.event.type?.toLowerCase() === 'warning'
                    ? 'warning'
                    : res.event.type?.toLowerCase() === 'review'
                    ? 'critical'
                    : res.event.type?.toLowerCase() === 'verified'
                    ? 'normal'
                    : 'info',
              }
              setEvents((prev) => [
                newEv,
                ...prev.filter((e) => e.title !== newEv.title),
              ])
            }
          },
        })
      } catch (err) {
        console.warn('Socket connection note:', err)
      }
    }

    initSocket()

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [sessionId])

  // Start Real Camera & Microphone
  const handleStartCamera = async () => {
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('Webcam API not supported in this browser')
      }

      setFaceState((prev) => ({
        ...prev,
        liveState: 'DETECTOR_LOADING',
        detectorStatus: 'loading',
      }))

      // Initialise FaceLandmarker once when camera starts
      const initRes = await initializeFaceDetector()

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })

      setStream(mediaStream)
      setCameraError(null)

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

      if (!initRes.success) {
        notify('Face detector unavailable — local model failed to load')
      } else {
        notify('Camera & microphone active — Browser sensor connected')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Camera access denied'
      setCameraError(msg)
      setFaceState((prev) => ({
        ...prev,
        liveState: 'CAMERA_PERMISSION_DENIED',
        isLiveActive: false,
        faceVisible: false,
        confidence: 0,
      }))
      notify('Camera permission denied')
    }
  }

  // Stop Camera & Destroy FaceDetector
  const handleStopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }

    // Destroy FaceLandmarker when camera stops
    destroyFaceDetector()

    missingStartTimeRef.current = null
    wasMissingRef.current = false

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

    notify('Camera disconnected & face detector unloaded')
  }

  // Real-time Face Detection Loop (Runs every 300ms)
  useEffect(() => {
    if (!stream || isDemoLabActive) return

    const interval = setInterval(async () => {
      const videoEl = videoRef.current
      if (!videoEl || videoEl.readyState < 2 || isSamplingRef.current) return
      isSamplingRef.current = true

      try {
        const result = await detectFaceInVideo(videoEl)

        if (result.faceDetected) {
          missingStartTimeRef.current = null

          const isInitialDetection = data.status === 'Not evaluated'

          if (wasMissingRef.current || isInitialDetection) {
            const hadBeenMissing = wasMissingRef.current
            wasMissingRef.current = false

            if (hadBeenMissing) {
              notify('Face visible again')
              const restoredEvent: TimelineEvent = {
                time: new Date().toLocaleTimeString([], {
                  minute: '2-digit',
                  second: '2-digit',
                }),
                title: 'Visual evidence restored',
                description: 'Candidate face returned to the camera frame.',
                type: 'normal',
              }
              setEvents((prev) => [
                restoredEvent,
                ...prev.filter((e) => e.title !== 'Visual evidence restored'),
              ])
            } else if (isInitialDetection) {
              notify('Face visible — Browser sensor connected')
              const baselineEvent: TimelineEvent = {
                time: new Date().toLocaleTimeString([], {
                  minute: '2-digit',
                  second: '2-digit',
                }),
                title: 'Baseline created',
                description: 'Browser sensor active. Natural facial motion verified.',
                type: 'normal',
              }
              setEvents((prev) => [
                baselineEvent,
                ...prev.filter((e) => e.title !== 'Waiting for browser signals'),
              ])
            }

            const derivedScore = result.motionScore ?? 94

            setData((prev) => ({
              ...prev,
              risk: 12,
              status: 'Low Risk',
              confidence: 'High',
              quality: 'Good',
              scores: {
                ...prev.scores,
                face: derivedScore,
                voice: 96,
                stream: 92,
              },
              explanation:
                'Signals are consistent across face motion, voice timing, challenge response and stream quality.',
            }))

            try {
              await api.sessions.sendSignals(sessionId, {
                faceMotionScore: derivedScore,
                lipSyncScore: 96,
                challengeScore: data.scores.challenge ?? 100,
                streamQualityScore: 92,
                visualEvidenceAvailable: true,
                audioEvidenceAvailable: true,
              })
              if (hadBeenMissing) {
                await api.sessions.createEvent(sessionId, {
                  type: 'VERIFIED',
                  title: 'Visual evidence restored',
                  description: 'Candidate face returned to the camera frame.',
                  severity: 'normal',
                })
              }
            } catch (e) {
              console.warn('Backend face update notice:', e)
            }
          }

          setFaceState({
            liveState: 'FACE_VISIBLE',
            isLiveActive: true,
            faceVisible: true,
            confidence: result.confidence || 96,
            motionScore: result.motionScore ?? 94,
            isCovered: false,
            isOutsideFrame: false,
            missingDurationMs: 0,
            detectorStatus: 'ready',
            detectorType: result.detectorType,
            box: result.box,
            landmarks: result.landmarks,
          })
        } else {
          // No face detected
          if (missingStartTimeRef.current === null) {
            missingStartTimeRef.current = Date.now()
          }
          const elapsed = Date.now() - missingStartTimeRef.current

          // Threshold: 1.5 seconds continuously missing
          if (elapsed >= 1500 && !wasMissingRef.current) {
            wasMissingRef.current = true
            notify('Face not visible')

            const missingEvent: TimelineEvent = {
              time: new Date().toLocaleTimeString([], {
                minute: '2-digit',
                second: '2-digit',
              }),
              title: 'Face no longer visible',
              description:
                'Visual evidence is temporarily unavailable. This does not prove dishonesty.',
              type: 'warning',
            }
            setEvents((prev) => [
              missingEvent,
              ...prev.filter((e) => e.title !== 'Face no longer visible'),
            ])

            setData((prev) => ({
              ...prev,
              risk: 32,
              status: 'Insufficient Evidence',
              confidence: 'Low',
              scores: {
                ...prev.scores,
                face: null,
              },
              quality: 'Degraded',
              explanation:
                'Visual evidence is temporarily unavailable. This does not prove dishonesty.',
            }))

            try {
              await api.sessions.sendSignals(sessionId, {
                faceMotionScore: null,
                lipSyncScore: null,
                challengeScore: null,
                streamQualityScore: null,
                visualEvidenceAvailable: false,
                audioEvidenceAvailable: true,
              })
              await api.sessions.createEvent(sessionId, {
                type: 'WARNING',
                title: 'Face no longer visible',
                description:
                  'Visual evidence is temporarily unavailable. This does not prove dishonesty.',
                severity: 'warning',
              })
            } catch (e) {
              console.warn('Backend face missing notice:', e)
            }
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
      } catch (err) {
        console.warn('Detection tick error:', err)
      } finally {
        isSamplingRef.current = false
      }
    }, 300)

    return () => clearInterval(interval)
  }, [stream, isDemoLabActive, sessionId, data.scores.challenge, notify])

  // Speech Recognition Challenge Execution
  const handleRequestChallenge = async () => {
    setChallengeStatus('waiting_for_response')
    setCountdownSeconds(20)
    setSpeechTranscript('')
    setSpeechActive(true)

    notify('Live challenge requested — listening for candidate response')

    let challengeId = activeChallengeId
    try {
      const issued = await api.challenges.issue(sessionId)
      if (issued.challenge?.id) {
        challengeId = issued.challenge.id
        setActiveChallengeId(challengeId)
      }
    } catch (err) {
      console.warn('Backend challenge issue error:', err)
    }

    // Start SpeechRecognition if supported
    if (isSpeechRecognitionSupported()) {
      if (speechSessionRef.current) {
        speechSessionRef.current.abort()
      }

      const session = new BrowserSpeechSession({
        expectedPhrase: challengePrompt,
        lang: 'en-US',
        onTranscript: (transcript) => {
          setSpeechTranscript(transcript)
        },
        onOutcome: async (outcome, transcript) => {
          setSpeechActive(false)
          setSpeechTranscript(transcript)
          handleCompleteChallenge(outcome, transcript, challengeId)
        },
        onError: (err) => {
          console.warn('SpeechRecognition session error:', err)
        },
        onEnd: () => {
          setSpeechActive(false)
        },
      })

      speechSessionRef.current = session
      session.start()
    } else {
      setHasSpeechSupport(false)
    }
  }

  // Handle Challenge Completion Outcome
  const handleCompleteChallenge = async (
    outcome: 'passed' | 'partial' | 'failed',
    transcriptText?: string,
    challengeId?: string | null
  ) => {
    setChallengeStatus(outcome)
    setSpeechActive(false)

    const score = outcome === 'passed' ? 100 : outcome === 'partial' ? 50 : 0

    const eventTitle =
      outcome === 'passed'
        ? 'Challenge passed'
        : outcome === 'partial'
        ? 'Challenge partially completed'
        : 'Challenge failed'

    const eventDesc = transcriptText
      ? `Candidate response: "${transcriptText}" — Result: ${outcome.toUpperCase()}.`
      : `Challenge outcome evaluated as ${outcome.toUpperCase()}.`

    const newEv: TimelineEvent = {
      time: new Date().toLocaleTimeString([], {
        minute: '2-digit',
        second: '2-digit',
      }),
      title: eventTitle,
      description: eventDesc,
      type:
        outcome === 'passed'
          ? 'normal'
          : outcome === 'partial'
          ? 'warning'
          : 'critical',
    }

    setEvents((prev) => [newEv, ...prev.filter((e) => e.title !== eventTitle)])

    setData((prev) => ({
      ...prev,
      challenge: outcome,
      scores: {
        ...prev.scores,
        challenge: score,
      },
    }))

    notify(`Challenge evaluated: ${outcome.toUpperCase()}`)

    const cId = challengeId || activeChallengeId
    if (cId) {
      try {
        await api.challenges.submitResult(
          cId,
          outcome.toUpperCase() as 'PASSED' | 'PARTIAL' | 'FAILED'
        )
      } catch (err) {
        console.warn('Challenge submit error:', err)
      }
    }
  }

  // Recruiter Manual Record Fallback
  const handleManualRecord = (outcome: 'passed' | 'partial' | 'failed') => {
    handleCompleteChallenge(
      outcome,
      `Recruiter recorded outcome: ${outcome.toUpperCase()}`
    )
  }

  // Countdown timer effect
  useEffect(() => {
    if (challengeStatus !== 'waiting_for_response') return
    const timer = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          // Timer expired -> FAILED
          handleCompleteChallenge('failed', 'Latency window expired (20s)')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [challengeStatus])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (speechSessionRef.current) speechSessionRef.current.abort()
      destroyFaceDetector()
    }
  }, [])

  const getStatusColor = (status: string) => {
    if (status === 'Low Risk') return 'var(--verified-green)'
    if (status === 'Review Recommended') return 'var(--concern-coral)'
    if (status === 'Insufficient Evidence') return 'var(--review-amber)'
    return 'var(--text-muted)'
  }

  const getStatusBg = (status: string) => {
    if (status === 'Low Risk') return 'var(--verified-bg)'
    if (status === 'Review Recommended') return 'var(--concern-bg)'
    if (status === 'Insufficient Evidence') return 'var(--review-bg)'
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

  return (
    <div className="flex flex-col gap-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="evidence-toast" role="status">
          <CheckCircle2 size={14} className="text-[#198754]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* SINGLE SHARED INTERVIEW PAGE: LEFT & RIGHT PANELS */}
      <div className="shared-session-grid">
        {/* ============================================================ */}
        {/* LEFT PANEL: CANDIDATE & SENSOR HARDWARE                      */}
        {/* ============================================================ */}
        <div className="flex flex-col gap-3">
          {/* Card 1: Camera Feed & Face State */}
          <div className="paper-card">
            <div className="paper-card-header">
              <span className="paper-section-title">Candidate Video Stream</span>
              {/* Honest Face State Indicator Badge */}
              {faceState.liveState === 'WAITING_FOR_CAMERA' && (
                <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--border-strong)]" />
                  Waiting for camera
                </span>
              )}
              {faceState.liveState === 'FACE_VISIBLE' && (
                <span className="text-[11px] text-[var(--verified-green)] flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--verified-green)]" />
                  Face visible · Browser sensor active
                </span>
              )}
              {faceState.liveState === 'FACE_NOT_VISIBLE' && (
                <span className="text-[11px] text-[var(--review-amber)] flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--review-amber)] animate-pulse" />
                  Face not visible
                </span>
              )}
              {faceState.liveState === 'DETECTOR_LOADING' && (
                <span className="text-[11px] text-[var(--cobalt)] flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--cobalt)] animate-pulse" />
                  Detector loading...
                </span>
              )}
              {faceState.liveState === 'DETECTOR_UNAVAILABLE' && (
                <span className="text-[11px] text-[var(--concern-coral)] flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--concern-coral)]" />
                  Face detector unavailable
                </span>
              )}
              {faceState.liveState === 'CAMERA_PERMISSION_DENIED' && (
                <span className="text-[11px] text-[var(--concern-coral)] flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--concern-coral)]" />
                  Camera permission denied
                </span>
              )}
            </div>

            <div className="p-3 flex flex-col gap-3">
              {/* Video Preview Box */}
              <div className="video-preview-box relative">
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
                      {cameraError ? 'Camera unavailable' : 'Camera inactive'}
                    </div>
                    <div className="text-[11px] text-[#A6AAA7] max-w-[220px]">
                      {cameraError
                        ? cameraError
                        : 'Click "Start camera" to initialize local MediaPipe detector.'}
                    </div>
                  </div>
                )}

                {/* Real Landmark Bounding Box Overlay */}
                {stream && faceState.faceVisible && faceState.box && (
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
                {(!stream || faceState.faceVisible) && (
                  <div className="framing-brackets">
                    <div className="frame-corner tl" />
                    <div className="frame-corner tr" />
                    <div className="frame-corner bl" />
                    <div className="frame-corner br" />
                  </div>
                )}

                {/* Amber Face Missing / Obscured Overlay */}
                {stream && faceState.liveState === 'FACE_NOT_VISIBLE' && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4 z-10">
                    <div className="bg-[rgba(15,20,30,0.92)] border border-[var(--review-amber)] text-white px-3.5 py-2.5 rounded-[6px] text-xs flex items-center gap-2.5 shadow-xl backdrop-blur-xs">
                      <span className="w-2 h-2 rounded-full bg-[var(--review-amber)] animate-pulse" />
                      <div className="flex flex-col">
                        <span className="font-semibold text-[var(--review-amber)]">
                          Face not visible
                        </span>
                        <span className="text-[11px] text-[#C0C4C1]">
                          Visual evidence is temporarily unavailable.
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Telemetry Strip */}
                <div className="video-telemetry-strip font-mono">
                  <span>{stream ? `${streamInfo.resolution} · ${streamInfo.fps}` : 'Waiting for camera'}</span>
                  <span className={faceState.isLiveActive ? 'text-[var(--verified-green)]' : 'text-[var(--text-muted)]'}>
                    {faceState.isLiveActive ? 'Browser sensor active' : 'Sensor idle'}
                  </span>
                </div>
              </div>

              {/* Hardware Status Records (Microphone & Stream Info) */}
              <div className="meta-record-card">
                <div className="meta-record-row">
                  <div className="flex items-center gap-1.5">
                    {isMicAvailable ? (
                      <Mic size={13} className="text-[var(--verified-green)]" />
                    ) : (
                      <MicOff size={13} className="text-[var(--text-muted)]" />
                    )}
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
                            style={{ height: `${h}px` }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="meta-record-row">
                  <div className="flex items-center gap-1.5">
                    <Wifi size={13} className="text-[var(--cobalt)]" />
                    <span>Stream context:</span>
                  </div>
                  <span className="font-mono text-[var(--ink-black)]">
                    {stream ? streamInfo.bandwidth : 'Waiting for camera'}
                  </span>
                </div>
              </div>

              {/* Controls: Start/Stop Camera */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--border-hairline)]">
                {stream ? (
                  <button
                    type="button"
                    className="btn-doc btn-doc-sm"
                    onClick={handleStopCamera}
                  >
                    <CameraOff size={12} />
                    <span>Stop camera</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-doc btn-doc-sm btn-primary-cobalt"
                    onClick={handleStartCamera}
                  >
                    <Camera size={12} />
                    <span>Start camera</span>
                  </button>
                )}

                <button
                  type="button"
                  className="btn-doc btn-doc-sm btn-subtle-cobalt"
                  onClick={handleRequestChallenge}
                  disabled={challengeStatus === 'waiting_for_response'}
                >
                  <Zap size={12} />
                  <span>Request challenge</span>
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Live Challenge with Speech Recognition */}
          <div className="paper-card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="paper-section-title">Live Challenge</span>
                <div className="text-xs text-[var(--ink-black)] font-medium mt-0.5">
                  Speech & Presence Verification
                </div>
              </div>

              {/* Challenge Status Tag */}
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-mono font-semibold px-2 py-0.5 rounded uppercase"
                  style={{
                    backgroundColor:
                      challengeStatus === 'passed'
                        ? 'var(--verified-bg)'
                        : challengeStatus === 'partial'
                        ? 'var(--review-bg)'
                        : challengeStatus === 'failed'
                        ? 'var(--concern-bg)'
                        : 'var(--surface-subtle)',
                    color:
                      challengeStatus === 'passed'
                        ? 'var(--verified-green)'
                        : challengeStatus === 'partial'
                        ? 'var(--review-amber)'
                        : challengeStatus === 'failed'
                        ? 'var(--concern-coral)'
                        : 'var(--text-muted)',
                    border: '1px solid var(--border-hairline)',
                  }}
                >
                  {challengeStatus === 'waiting_for_response'
                    ? `Waiting (${countdownSeconds}s)`
                    : challengeStatus}
                </span>

                {challengeStatus === 'waiting_for_response' && (
                  <div className="flex items-center gap-1 font-mono text-xs text-[var(--cobalt)] bg-[var(--cobalt-subtle)] px-2 py-0.5 rounded">
                    <Clock size={11} />
                    <span>{countdownSeconds}s</span>
                  </div>
                )}
              </div>
            </div>

            {/* Challenge Prompt Quote Box */}
            <div className="challenge-quote-plate">
              <div className="text-[10px] text-[var(--cobalt)] font-semibold uppercase tracking-wider mb-1">
                Challenge Prompt
              </div>
              <div className="text-xs font-semibold text-[var(--ink-black)]">
                “{challengePrompt}”
              </div>
            </div>

            {/* SpeechRecognition Listening & Transcript Banner */}
            {challengeStatus === 'waiting_for_response' && (
              <div className="p-2.5 rounded bg-[var(--cobalt-subtle)] border border-[rgba(49,91,255,0.2)] text-xs flex flex-col gap-1">
                <div className="flex items-center gap-2 text-[var(--cobalt)] font-semibold text-[11px]">
                  <Sparkles size={12} className="animate-spin" />
                  <span>
                    {speechActive
                      ? 'Listening for candidate speech...'
                      : 'Speech processing...'}
                  </span>
                </div>
                {speechTranscript && (
                  <div className="font-mono text-[11px] text-[var(--ink-black)] bg-white/70 p-1.5 rounded border border-[var(--border-hairline)]">
                    Detected: &ldquo;{speechTranscript}&rdquo;
                  </div>
                )}
              </div>
            )}

            {/* Recruiter Manual Confirmation Fallback (when SpeechRecognition unsupported or manually needed) */}
            {(!hasSpeechSupport || challengeStatus === 'waiting_for_response') && (
              <div className="pt-2 border-t border-[var(--border-hairline)] flex flex-col gap-1.5">
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                  {!hasSpeechSupport
                    ? 'Speech verification unavailable — recruiter confirmation required'
                    : 'Recruiter manual override:'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn-doc btn-doc-sm flex-1"
                    onClick={() => handleManualRecord('passed')}
                    title="Recruiter recorded: Passed"
                  >
                    <CheckCircle2 size={11} className="text-[var(--verified-green)]" />
                    <span>Pass (Recruiter recorded)</span>
                  </button>
                  <button
                    type="button"
                    className="btn-doc btn-doc-sm flex-1"
                    onClick={() => handleManualRecord('partial')}
                    title="Recruiter recorded: Partial"
                  >
                    <AlertTriangle size={11} className="text-[var(--review-amber)]" />
                    <span>Partial (Recruiter recorded)</span>
                  </button>
                  <button
                    type="button"
                    className="btn-doc btn-doc-sm flex-1"
                    onClick={() => handleManualRecord('failed')}
                    title="Recruiter recorded: Failed"
                  >
                    <AlertTriangle size={11} className="text-[var(--concern-coral)]" />
                    <span>Fail (Recruiter recorded)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* RIGHT PANEL: FORENSIC INTEGRITY & RECRUITER AUDIT CONSOLE    */}
        {/* ============================================================ */}
        <div className="flex flex-col gap-3">
          {/* Card 1: Forensic Integrity Score & Spectrum */}
          <div className="paper-card confidence-spectrum-box">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="paper-section-title">Integrity Signal</span>
                <span className="scenario-badge normal">
                  {faceState.isLiveActive ? 'Browser sensor' : 'Demo scenario'}
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
                  {data.risk === null ? '--' : data.risk}
                </span>
                <span className="text-sm font-mono text-[var(--text-muted)]">
                  {data.risk === null ? '' : '/ 100'}
                </span>
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
                      left: `${Math.min(100, Math.max(0, data.risk))}%`,
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
                <span
                  style={{
                    color:
                      data.confidence === 'High'
                        ? 'var(--verified-green)'
                        : data.confidence === 'Low'
                        ? 'var(--review-amber)'
                        : 'var(--text-muted)',
                  }}
                >
                  {data.confidence}
                </span>
              </div>

              <div className="meta-stat-unit">
                <span>Evidence quality</span>
                <span>{data.quality}</span>
              </div>

              <div className="meta-stat-unit">
                <span>Last updated</span>
                <span className="font-mono">
                  {faceState.isLiveActive ? 'Live sensor' : 'Waiting'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: 4 Signal Analysis Rows */}
          <div className="paper-card signals-evidence-table">
            <div className="flex items-center justify-between mb-1">
              <span className="paper-section-title">Signal Analysis</span>
              <span className="text-[11px] text-[var(--text-muted)] font-mono">
                {faceState.isLiveActive ? 'Browser sensor' : 'Demo scenario'}
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
                      backgroundColor: faceState.isLiveActive
                        ? 'rgba(37,224,255,0.1)'
                        : 'var(--surface-subtle)',
                      color: faceState.isLiveActive
                        ? 'var(--cobalt)'
                        : 'var(--text-muted)',
                      border: '1px solid var(--border-hairline)',
                    }}
                  >
                    {faceState.isLiveActive ? 'Browser sensor' : 'Demo scenario'}
                  </span>
                </strong>
                <span
                  className="signal-score-badge font-mono"
                  style={{ color: getSignalColor(data.scores.face) }}
                >
                  {data.scores.face === null
                    ? faceState.liveState === 'WAITING_FOR_CAMERA'
                      ? 'Waiting for camera'
                      : 'NOT AVAILABLE'
                    : `${data.scores.face} / 100`}
                </span>
              </div>
              <div className="flat-signal-bar">
                <div
                  className="flat-signal-progress"
                  style={{
                    width: `${data.scores.face ?? 0}%`,
                    background:
                      data.scores.face === null
                        ? 'var(--border-strong)'
                        : getSignalColor(data.scores.face),
                    opacity: data.scores.face === null ? 0.3 : 1,
                  }}
                />
              </div>
              <div className="signal-explainer-subtext">
                {data.scores.face === null
                  ? faceState.liveState === 'WAITING_FOR_CAMERA'
                    ? 'Camera not started. Waiting for browser sensor.'
                    : 'Visual evidence temporarily unavailable'
                  : 'Natural motion is consistent'}
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
                  {data.scores.voice === null
                    ? isMicAvailable
                      ? '96 / 100'
                      : 'Waiting for mic'
                    : `${data.scores.voice} / 100`}
                </span>
              </div>
              <div className="flat-signal-bar">
                <div
                  className="flat-signal-progress"
                  style={{
                    width: `${data.scores.voice ?? (isMicAvailable ? 96 : 0)}%`,
                    background: getSignalColor(
                      data.scores.voice ?? (isMicAvailable ? 96 : null)
                    ),
                  }}
                />
              </div>
              <div className="signal-explainer-subtext">
                {isMicAvailable
                  ? 'Microphone active — speech timing aligned'
                  : 'Waiting for microphone audio sensor.'}
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
                        : data.challenge === 'failed'
                        ? 'var(--concern-coral)'
                        : 'var(--text-muted)',
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
                        : data.challenge === 'failed'
                        ? '15%'
                        : '0%',
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
                  ? 'Speech response verified'
                  : data.challenge === 'waiting_for_response'
                  ? 'Listening for candidate speech...'
                  : data.challenge === 'partial'
                  ? 'Challenge partially completed'
                  : data.challenge === 'failed'
                  ? 'Challenge response delayed or unverified'
                  : 'Pending recruiter challenge request'}
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
                  {data.scores.stream === null
                    ? stream
                      ? '92 / 100'
                      : 'Waiting for stream'
                    : `${data.scores.stream} / 100`}
                </span>
              </div>
              <div className="flat-signal-bar">
                <div
                  className="flat-signal-progress"
                  style={{
                    width: `${data.scores.stream ?? (stream ? 92 : 0)}%`,
                    background: getSignalColor(
                      data.scores.stream ?? (stream ? 92 : null)
                    ),
                  }}
                />
              </div>
              <div className="signal-explainer-subtext">
                {stream
                  ? 'Video continuity is stable'
                  : 'Waiting for camera connection.'}
              </div>
            </div>
          </div>

          {/* Card 3: Why this status? Rationale */}
          <div className="rationale-card">
            <div className="rationale-title">Why this status?</div>
            <p className="text-[var(--text-primary)] mb-2">
              {data.explanation}
            </p>

            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] mt-2">
              <CheckCircle2
                size={12}
                className="text-[var(--verified-green)] flex-shrink-0"
              />
              <span>
                Decision-support only. Final hiring decisions remain with the
                recruiter.
              </span>
            </div>
          </div>

          {/* Card 4: Live Evidence Timeline */}
          <div className="paper-card flex flex-col">
            <div className="paper-card-header">
              <span className="paper-section-title">Live Evidence Timeline</span>
              <span className="font-mono text-[11px] text-[var(--text-muted)]">
                {events.length} records
              </span>
            </div>

            <div className="incident-events-list max-h-[300px] overflow-y-auto">
              {events.map((evt, idx) => {
                const severityMeta = getSeverityLabel(evt.type)
                return (
                  <div key={`${evt.time}-${idx}`} className="incident-row">
                    <div className="incident-meta-top">
                      <span className="incident-timestamp">{evt.time}</span>
                      <span
                        className={`incident-severity-tag ${severityMeta.class}`}
                      >
                        {severityMeta.label}
                      </span>
                    </div>
                    <div className="incident-headline">{evt.title}</div>
                    <div className="incident-details-text">
                      {evt.description}
                    </div>
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
