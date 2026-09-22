'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Sidebar, ActiveView } from '@/components/Sidebar'
import { TopBar } from '@/components/TopBar'
import { LiveSessionView } from '@/components/LiveSessionView'
import { CandidateSessionView } from '@/components/CandidateSessionView'
import { EvidenceView } from '@/components/EvidenceView'
import { DemoLabView } from '@/components/DemoLabView'
import { PrivacyControlsView } from '@/components/PrivacyControlsView'
import { GuidedDemoPanel } from '@/components/GuidedDemoPanel'
import { DemoSummaryModal } from '@/components/DemoSummaryModal'
import { scenarios, CANDIDATE_DETAILS } from '@/lib/scenarios'
import { Scenario, ScenarioData, ChallengeStatus, TimelineEvent, IntegrityStatus, FacePresenceState } from '@/types/pramaan'
import { CheckCircle2 } from 'lucide-react'
import { api } from '@/lib/api'
import { subscribeToSession } from '@/lib/socket'
import { detectFaceInVideo, initializeFaceDetector } from '@/lib/faceDetector'

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
      return 'Low Risk'
  }
}

function formatConfidence(conf: string): 'High' | 'Medium' | 'Low' {
  switch (conf) {
    case 'HIGH':
      return 'High'
    case 'MEDIUM':
      return 'Medium'
    case 'LOW':
      return 'Low'
    default:
      return 'High'
  }
}

export default function PramaanApp() {
  // Opens directly into a live session console
  const [view, setView] = useState<ActiveView>('live')
  const [currentScenario, setCurrentScenario] = useState<Scenario>('normal')
  const [scenarioData, setScenarioData] = useState<ScenarioData>(scenarios.normal)
  const [events, setEvents] = useState<TimelineEvent[]>(scenarios.normal.events)
  const [isLowQualityMode, setIsLowQualityMode] = useState<boolean>(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [backendConnected, setBackendConnected] = useState<boolean>(false)
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(null)

  // Browser-side face presence detection state
  const [faceState, setFaceState] = useState<FacePresenceState>({
    liveState: 'DETECTOR_LOADING',
    isLiveActive: false,
    faceVisible: true,
    confidence: 94,
    motionScore: 94,
    isCovered: false,
    isOutsideFrame: false,
    missingDurationMs: 0,
    detectorStatus: 'loading',
    detectorType: 'none',
  })
  const hiddenVideoRef = useRef<HTMLVideoElement>(null)
  const activeVideoRef = useRef<HTMLVideoElement | null>(null)
  const missingStartTimeRef = useRef<number | null>(null)
  const wasMissingRef = useRef<boolean>(false)
  const isSamplingRef = useRef<boolean>(false)

  // Show self-dismissing toast
  const notify = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev))
    }, 3200)
  }, [])

  // Presentation Demo Mode state
  const [isGuidedDemoOpen, setIsGuidedDemoOpen] = useState<boolean>(true)
  const [guidedStep, setGuidedStep] = useState<number>(1)
  const [isAutoRunning, setIsAutoRunning] = useState<boolean>(false)
  const [autoSeconds, setAutoSeconds] = useState<number>(0)
  const [showSummaryModal, setShowSummaryModal] = useState<boolean>(false)

  // Full-width live challenge banner state
  const [isChallengeBannerOpen, setIsChallengeBannerOpen] = useState<boolean>(false)
  const [challengePhase, setChallengePhase] = useState<'waiting' | 'recorded' | 'passed'>('waiting')
  const [challengeSecondsLeft, setChallengeSecondsLeft] = useState<number>(20)
  const [challengePrompt, setChallengePrompt] = useState<string>('Turn your head slightly to the right and say BLUE 47')

  // Step 1: Normal Candidate
  const applyStep1Normal = useCallback(() => {
    setCurrentScenario('normal')
    setIsLowQualityMode(false)
    setIsChallengeBannerOpen(false)
    setGuidedStep(1)
    setScenarioData({
      name: 'Normal Session',
      risk: 12,
      status: 'Low Risk',
      confidence: 'High',
      quality: 'Good',
      challenge: 'passed',
      explanation: 'All biometric interaction signals align with baseline expectations. No synthetic manipulation or desynchronization observed.',
      scores: {
        face: 94,
        voice: 96,
        challenge: 100,
        stream: 92,
      },
      events: scenarios.normal.events,
    })
    setEvents(scenarios.normal.events)
    notify('Demo Step 1: Normal candidate (Risk 12/100 · Low Risk)')
  }, [notify])

  // Step 2: Random Challenge
  const applyStep2Challenge = useCallback((phase: 'waiting' | 'passed' = 'waiting') => {
    setGuidedStep(2)
    setIsChallengeBannerOpen(true)
    setChallengePrompt('Turn your head slightly to the right and say BLUE 47')
    setChallengePhase(phase)
    setChallengeSecondsLeft(phase === 'passed' ? 15 : 20)

    if (phase === 'waiting') {
      const promptEvent: TimelineEvent = {
        time: '04:55',
        title: 'Live Challenge Issued',
        description: 'Instruction: “Turn your head slightly to the right and say BLUE 47”. Active latency window 20s.',
        type: 'info',
      }
      setEvents((prev) => [promptEvent, ...prev.filter((e) => e.title !== promptEvent.title)])
      notify('Demo Step 2: Random live challenge issued')
    } else if (phase === 'passed') {
      setScenarioData((prev) => ({
        ...prev,
        challenge: 'passed',
        scores: {
          ...prev.scores,
          challenge: 100,
        },
      }))
      const passedEvent: TimelineEvent = {
        time: '05:00',
        title: 'Challenge Passed',
        description: 'Synchronized head rotation and phrase verification confirmed within 20s latency window.',
        type: 'normal',
      }
      setEvents((prev) => [passedEvent, ...prev.filter((e) => e.title !== passedEvent.title)])
      notify('Live challenge passed: 100/100 verification confirmed')
    }
  }, [notify])

  // Step 3: Simulated Proxy
  const applyStep3Proxy = useCallback(() => {
    setCurrentScenario('proxy')
    setIsLowQualityMode(false)
    setIsChallengeBannerOpen(false)
    setGuidedStep(3)
    setScenarioData({
      name: 'Simulated Proxy',
      risk: 78,
      status: 'Review Recommended',
      confidence: 'Medium',
      quality: 'Good',
      challenge: 'partial',
      explanation: 'Lip-sync timing inconsistency and reduced natural motion detected across facial landmarks. Divergence between audio formant onset and labial occlusion.',
      scores: {
        face: 38,
        voice: 42,
        challenge: 50,
        stream: 88,
      },
      events: scenarios.proxy.events,
    })
    const proxyEvents: TimelineEvent[] = [
      {
        time: '05:15',
        title: 'Lip-sync timing inconsistency',
        description: 'Audio formant onset precedes visual labial occlusion by 140ms.',
        type: 'critical',
      },
      {
        time: '05:16',
        title: 'Reduced natural motion',
        description: 'Facial landmark dynamics indicate synthetic rendering artifact.',
        type: 'critical',
      },
      {
        time: '05:17',
        title: 'Challenge partially completed',
        description: 'Latency exceeded threshold during active motion instruction.',
        type: 'warning',
      },
    ]
    setEvents((prev) => [...proxyEvents, ...prev.filter((e) => !proxyEvents.some((pe) => pe.title === e.title))])
    notify('Signal state changed: Three interaction signals now require human review.')
  }, [notify])

  // Step 4: Low Bandwidth Fairness Check
  const applyStep4LowBandwidth = useCallback(() => {
    setCurrentScenario('low-bandwidth')
    setIsLowQualityMode(true)
    setIsChallengeBannerOpen(false)
    setGuidedStep(4)
    setScenarioData({
      name: 'Low Bandwidth',
      risk: 32,
      status: 'Insufficient Evidence',
      confidence: 'Low',
      quality: 'Poor',
      challenge: 'partial',
      explanation: 'Poor video quality lowers confidence. It does not prove dishonesty. Visual evidence is limited because of stream quality.',
      scores: {
        face: null,
        voice: null,
        challenge: 50,
        stream: 24,
      },
      events: scenarios['low-bandwidth'].events,
    })
    const bwEvent: TimelineEvent = {
      time: '05:25',
      title: 'Algorithmic Fairness Safeguard Applied',
      description: 'Poor video quality lowers confidence. It does not prove dishonesty. Risk capped at 32 and status marked Insufficient Evidence.',
      type: 'info',
    }
    setEvents((prev) => [bwEvent, ...prev.filter((e) => e.title !== bwEvent.title)])
    notify('Poor video quality lowers confidence. It does not prove dishonesty.')
  }, [notify])

  // Step 5: Final Summary & Evidence Report
  const applyStep5Report = useCallback(() => {
    setGuidedStep(5)
    setShowSummaryModal(true)
    notify('Demo sequence complete: Session review summary ready')
  }, [notify])

  // Automated 35-second Demo Sequence Runner
  useEffect(() => {
    if (!isAutoRunning) return

    const interval = setInterval(() => {
      setAutoSeconds((prevSec) => {
        const nextSec = prevSec + 1

        if (nextSec === 1) {
          applyStep1Normal()
        } else if (nextSec === 5) {
          applyStep2Challenge('waiting')
        } else if (nextSec === 10) {
          applyStep2Challenge('passed')
        } else if (nextSec === 15) {
          applyStep3Proxy()
        } else if (nextSec === 25) {
          applyStep4LowBandwidth()
        } else if (nextSec >= 35) {
          applyStep1Normal()
          applyStep5Report()
          setIsAutoRunning(false)
          return 35
        }

        return nextSec
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isAutoRunning, applyStep1Normal, applyStep2Challenge, applyStep3Proxy, applyStep4LowBandwidth, applyStep5Report])

  // Challenge 20-second countdown effect
  useEffect(() => {
    if (!isChallengeBannerOpen || challengePhase !== 'waiting') return

    const timer = setInterval(() => {
      setChallengeSecondsLeft((prev) => {
        if (prev <= 1) {
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isChallengeBannerOpen, challengePhase])

  const handleSelectGuidedStep = (step: number) => {
    setIsAutoRunning(false)
    switch (step) {
      case 1:
        setAutoSeconds(0)
        applyStep1Normal()
        break
      case 2:
        setAutoSeconds(5)
        applyStep2Challenge('waiting')
        break
      case 3:
        setAutoSeconds(15)
        applyStep3Proxy()
        break
      case 4:
        setAutoSeconds(25)
        applyStep4LowBandwidth()
        break
      case 5:
        setAutoSeconds(35)
        applyStep5Report()
        break
      default:
        break
    }
  }

  const handleToggleAutoRun = () => {
    if (isAutoRunning) {
      setIsAutoRunning(false)
      notify('Automated demo paused')
    } else {
      if (autoSeconds >= 35) {
        setAutoSeconds(0)
        applyStep1Normal()
      }
      setIsAutoRunning(true)
      notify('Automated 35-second demo running...')
    }
  }

  const handleSkipNext = () => {
    const nextStep = Math.min(guidedStep + 1, 5)
    handleSelectGuidedStep(nextStep)
  }

  const handleSkipPrev = () => {
    const prevStep = Math.max(guidedStep - 1, 1)
    handleSelectGuidedStep(prevStep)
  }

  const handleRunDemoAgain = () => {
    setShowSummaryModal(false)
    setAutoSeconds(0)
    applyStep1Normal()
    setIsAutoRunning(true)
    notify('Restarting automated 35-second demo flow...')
  }

  // Initialize Backend connection & Socket.IO realtime synchronization
  useEffect(() => {
    let unsubscribe: (() => void) | null = null

    async function initBackend() {
      try {
        const health = await api.checkHealth()
        if (health.status === 'ok') {
          setBackendConnected(true)
          // Recruiter demo login
          await api.auth.demoLogin()

          // Load latest events and session state from backend
          try {
            const sessionRes = await api.sessions.get('PRM-CX0104')
            if (sessionRes.session) {
              const s = sessionRes.session
              setScenarioData((prev) => ({
                ...prev,
                risk: s.riskScore ?? prev.risk,
                status: s.riskStatus ? formatRiskStatus(s.riskStatus) : prev.status,
                confidence: s.confidence ? formatConfidence(s.confidence) : prev.confidence,
              }))
            }
          } catch (e) {
            console.warn('Initial session fetch notice:', e)
          }

          // Subscribe to realtime updates for session PRM-CX0104
          unsubscribe = subscribeToSession('PRM-CX0104', {
            onRiskUpdate: (data) => {
              setScenarioData((prev) => ({
                ...prev,
                risk: data.riskScore ?? prev.risk,
                status: data.riskStatus ? formatRiskStatus(data.riskStatus) : prev.status,
                confidence: data.confidence ? formatConfidence(data.confidence) : prev.confidence,
                explanation: data.explanation || prev.explanation,
              }))
            },
            onSignalUpdate: (data) => {
              if (data.signals) {
                setScenarioData((prev) => ({
                  ...prev,
                  scores: {
                    face: data.signals.faceMotionScore ?? prev.scores.face,
                    voice: data.signals.lipSyncScore ?? prev.scores.voice,
                    challenge: data.signals.challengeScore ?? prev.scores.challenge,
                    stream: data.signals.streamQualityScore ?? prev.scores.stream,
                  },
                }))
              }
            },
            onChallengeIssued: (data) => {
              if (data.challenge) {
                setActiveChallengeId(data.challenge.id)
                notify(`Challenge issued: "${data.challenge.prompt}"`)
              }
            },
            onChallengeResult: (data) => {
              if (data.challenge) {
                const res = data.challenge.status.toLowerCase() as ChallengeStatus
                setScenarioData((prev) => ({
                  ...prev,
                  challenge: res,
                  scores: {
                    ...prev.scores,
                    challenge: data.challengeScore ?? (res === 'passed' ? 100 : res === 'partial' ? 50 : 0),
                  },
                }))
              }
            },
            onScenarioChanged: (data) => {
              if (data.scenario) {
                const scKey: Scenario =
                  data.scenario === 'LOW_BANDWIDTH'
                    ? 'low-bandwidth'
                    : data.scenario === 'PROXY'
                    ? 'proxy'
                    : 'normal'
                setCurrentScenario(scKey)
                setIsLowQualityMode(scKey === 'low-bandwidth')
              }
            },
            onIntegrityEvent: (data) => {
              if (data.event) {
                const newEv: TimelineEvent = {
                  time: new Date(data.event.createdAt).toLocaleTimeString([], {
                    minute: '2-digit',
                    second: '2-digit',
                  }),
                  title: data.event.title,
                  description: data.event.description,
                  type:
                    data.event.type?.toLowerCase() === 'warning'
                      ? 'warning'
                      : data.event.type?.toLowerCase() === 'review'
                      ? 'critical'
                      : data.event.type?.toLowerCase() === 'verified'
                      ? 'normal'
                      : 'info',
                }
                setEvents((prev) => [newEv, ...prev])
              }
            },
          })

          notify('Connected to PRAMAAN backend (Express + Socket.IO)')
        }
      } catch {
        console.warn('Operating in offline frontend demo mode.')
        setBackendConnected(false)
      }
    }

    initBackend()

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [notify])

  // Synchronize scenario state
  const handleSelectScenario = async (scenarioKey: Scenario) => {
    setCurrentScenario(scenarioKey)
    const nextData = scenarios[scenarioKey]
    setScenarioData(nextData)
    setIsLowQualityMode(scenarioKey === 'low-bandwidth')

    // Scenario switch event prepended to timeline
    const scenarioEvent: TimelineEvent = {
      time: '05:00',
      title: `Scenario active: ${nextData.name}`,
      description: `Integrity parameters updated: Risk ${nextData.risk}/100, Status "${nextData.status}".`,
      type: scenarioKey === 'proxy' ? 'warning' : scenarioKey === 'low-bandwidth' ? 'info' : 'normal',
    }

    setEvents([scenarioEvent, ...nextData.events])
    notify(`Scenario switched: ${nextData.name}`)

    // If backend is connected, synchronize with server scenario API
    if (backendConnected) {
      try {
        const backendScenario =
          scenarioKey === 'low-bandwidth'
            ? 'LOW_BANDWIDTH'
            : scenarioKey === 'proxy'
            ? 'PROXY'
            : 'NORMAL'

        await api.sessions.applyScenario('PRM-CX0104', backendScenario)
      } catch (err) {
        console.warn('Could not sync scenario with backend:', err)
      }
    }
  }

  // Start Camera handler with graceful fallback
  const handleStartCamera = async () => {
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('Webcam API not supported in this browser environment')
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      })
      setStream(mediaStream)
      setCameraError(null)
      setFaceState((prev) => ({
        ...prev,
        liveState: prev.detectorStatus === 'ready' ? 'FACE_VISIBLE' : 'DETECTOR_LOADING',
        isLiveActive: true,
        faceVisible: true,
        confidence: 96,
        motionScore: 94,
      }))
      notify('Local camera and microphone connected')
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Camera access denied'
      setCameraError(errorMsg)
      setFaceState((prev) => ({
        ...prev,
        liveState: 'CAMERA_PERMISSION_DENIED',
        isLiveActive: false,
      }))
      notify('Camera permission denied')
    }
  }

  const handleStopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
      missingStartTimeRef.current = null
      wasMissingRef.current = false
      setFaceState((prev) => ({
        ...prev,
        liveState: 'DETECTOR_LOADING',
        isLiveActive: false,
        faceVisible: true,
        confidence: 94,
        motionScore: 94,
        isCovered: false,
        isOutsideFrame: false,
        missingDurationMs: 0,
      }))
      const normalScenario = scenarios[currentScenario] || scenarios.normal
      setScenarioData(normalScenario)
      notify('Camera stream stopped')
    }
  }

  // Initialize Face Detector on client mount
  useEffect(() => {
    let mounted = true
    initializeFaceDetector().then((res) => {
      if (!mounted) return
      setFaceState((prev) => ({
        ...prev,
        detectorStatus: res.success ? 'ready' : 'unavailable',
        detectorType: res.detectorType,
        liveState: res.success
          ? prev.isLiveActive
            ? 'FACE_VISIBLE'
            : prev.liveState
          : 'DETECTOR_UNAVAILABLE',
      }))
    })
    return () => {
      mounted = false
    }
  }, [])

  // Sync media stream to hidden video element for sampling
  useEffect(() => {
    if (hiddenVideoRef.current) {
      if (stream) {
        hiddenVideoRef.current.srcObject = stream
        hiddenVideoRef.current.play().catch(() => {})
        setFaceState((prev) => ({
          ...prev,
          liveState: prev.detectorStatus === 'ready' ? 'FACE_VISIBLE' : 'DETECTOR_LOADING',
          isLiveActive: currentScenario === 'normal',
          faceVisible: true,
          confidence: 94,
        }))
      } else {
        hiddenVideoRef.current.srcObject = null
        missingStartTimeRef.current = null
        wasMissingRef.current = false
        setFaceState((prev) => ({
          ...prev,
          liveState: 'DETECTOR_LOADING',
          isLiveActive: false,
          faceVisible: true,
          confidence: 94,
          motionScore: 94,
          isCovered: false,
          isOutsideFrame: false,
          missingDurationMs: 0,
        }))
      }
    }
  }, [stream, currentScenario])

  // Continuous Video Sampling Loop (Every 300ms)
  useEffect(() => {
    if (!stream || currentScenario !== 'normal') {
      return
    }

    const interval = setInterval(async () => {
      const videoToSample =
        activeVideoRef.current && activeVideoRef.current.readyState >= 2
          ? activeVideoRef.current
          : hiddenVideoRef.current

      if (!videoToSample || isSamplingRef.current) return
      isSamplingRef.current = true

      try {
        const result = await detectFaceInVideo(videoToSample)

        if (result.faceDetected) {
          missingStartTimeRef.current = null

          if (wasMissingRef.current) {
            // FACE RETURNING!
            wasMissingRef.current = false
            notify('Face visible again')

            const restoredEvent: TimelineEvent = {
              time: new Date().toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
              title: 'Visual evidence restored',
              description: 'Candidate face returned to the browser camera frame.',
              type: 'normal',
            }
            setEvents((prev) => [restoredEvent, ...prev.filter((e) => e.title !== 'Visual evidence restored')])

            const derivedMotion = result.motionScore ?? 94

            setScenarioData((prev) => ({
              ...prev,
              risk: 12,
              status: 'Low Risk',
              confidence: 'High',
              scores: {
                face: derivedMotion,
                voice: 96,
                challenge: 100,
                stream: 92,
              },
              quality: 'Good',
              explanation:
                'Signals are consistent across face motion, voice timing, challenge response and stream quality.',
            }))

            if (backendConnected) {
              try {
                await api.sessions.sendSignals('PRM-CX0104', {
                  faceMotionScore: derivedMotion,
                  lipSyncScore: 96,
                  challengeScore: 100,
                  streamQualityScore: 92,
                  visualEvidenceAvailable: true,
                  audioEvidenceAvailable: true,
                })
                await api.sessions.createEvent('PRM-CX0104', {
                  type: 'VERIFIED',
                  title: 'Visual evidence restored',
                  description: 'Candidate face returned to the browser camera frame.',
                  severity: 'normal',
                })
              } catch (e) {
                console.warn('Backend sync on face restored notice:', e)
              }
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
          // Face NOT detected (covered or candidate outside frame)
          if (missingStartTimeRef.current === null) {
            missingStartTimeRef.current = Date.now()
          }
          const elapsed = Date.now() - missingStartTimeRef.current

          if (elapsed >= 1500 && !wasMissingRef.current) {
            // Continuous missing for > 1.5 seconds -> FACE MISSING!
            wasMissingRef.current = true
            notify('Face not visible')

            const missingEvent: TimelineEvent = {
              time: new Date().toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
              title: 'Face no longer visible',
              description: 'Visual evidence temporarily unavailable. Additional review may be required.',
              type: 'warning',
            }
            setEvents((prev) => [missingEvent, ...prev.filter((e) => e.title !== 'Face no longer visible')])

            setScenarioData((prev) => ({
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

            if (backendConnected) {
              try {
                await api.sessions.sendSignals('PRM-CX0104', {
                  faceMotionScore: null,
                  lipSyncScore: null,
                  challengeScore: null,
                  streamQualityScore: 24,
                  visualEvidenceAvailable: false,
                  audioEvidenceAvailable: true,
                })
                await api.sessions.createEvent('PRM-CX0104', {
                  type: 'WARNING',
                  title: 'Face no longer visible',
                  description: 'Visual evidence temporarily unavailable. Additional review may be required.',
                  severity: 'warning',
                })
              } catch (e) {
                console.warn('Backend sync on face missing notice:', e)
              }
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
            detectorStatus: 'ready',
            detectorType: result.detectorType,
            box: undefined,
          }))
        }
      } catch (err) {
        console.warn('Face detection sample tick error:', err)
      } finally {
        isSamplingRef.current = false
      }
    }, 300)

    return () => clearInterval(interval)
  }, [stream, currentScenario, backendConnected, notify])

  // Handle Candidate Starting Integrity Check (consent + start)
  const handleStartIntegrityCheck = async () => {
    if (backendConnected) {
      try {
        await api.sessions.recordConsent('PRM-CX0104', {
          cameraConsent: true,
          microphoneConsent: true,
          signalProcessingConsent: true,
          consentVersion: 'v1',
        })
        await api.sessions.start('PRM-CX0104')
        notify('Biometric consent recorded & integrity check active')
      } catch (err) {
        console.warn('Backend consent sync error:', err)
      }
    } else {
      notify('Local integrity check active (offline mode)')
    }
  }

  // Handle Challenge Result (Pass, Partial, Fail)
  const handleChallengeResult = async (result: ChallengeStatus) => {
    const scoreVal = result === 'passed' ? 100 : result === 'partial' ? 50 : 0
    setChallengePhase(result === 'passed' ? 'passed' : 'recorded')

    setScenarioData((prev) => ({
      ...prev,
      challenge: result,
      scores: {
        ...prev.scores,
        challenge: scoreVal,
      },
    }))

    const resultEvent: TimelineEvent = {
      time: '05:00',
      title: `Challenge ${result.toUpperCase()}`,
      description:
        result === 'passed'
          ? 'Live challenge response verified.'
          : result === 'partial'
          ? 'Live challenge response was incomplete or delayed.'
          : 'Live challenge response failed verification checks.',
      type: result === 'passed' ? 'normal' : result === 'partial' ? 'warning' : 'critical',
    }

    setEvents((prev) => [resultEvent, ...prev.filter((e) => e.title !== resultEvent.title)])
    notify(`Live challenge recorded: ${result.toUpperCase()}`)

    if (backendConnected) {
      try {
        let challengeId = activeChallengeId
        if (!challengeId) {
          const issued = await api.challenges.issue('PRM-CX0104')
          challengeId = issued.challenge?.id
        }
        if (challengeId) {
          await api.challenges.submitResult(
            challengeId,
            result.toUpperCase() as 'PASSED' | 'PARTIAL' | 'FAILED'
          )
        }
      } catch (err) {
        console.warn('Backend challenge submission error:', err)
      }
    }
  }

  // Recruiter requests an immediate challenge
  const handleRequestVerification = async () => {
    setIsChallengeBannerOpen(true)
    setChallengePhase('waiting')
    setChallengeSecondsLeft(20)
    setChallengePrompt('Turn your head slightly to the right and say BLUE 47')

    const requestEvent: TimelineEvent = {
      time: '04:55',
      title: 'Recruiter Requested Challenge',
      description: 'Instruction: “Turn your head slightly to the right and say BLUE 47”. Active latency window 20s.',
      type: 'info',
    }
    setEvents((prev) => [requestEvent, ...prev])
    notify('Random challenge dispatched to candidate')

    if (backendConnected) {
      try {
        const res = await api.challenges.issue('PRM-CX0104')
        if (res.challenge) {
          setActiveChallengeId(res.challenge.id)
        }
      } catch (err) {
        console.warn('Error issuing challenge on backend:', err)
      }
    }
  }

  // Export Forensic JSON Report (from backend report generator with local fallback)
  const handleExportReport = async () => {
    if (backendConnected) {
      try {
        const res = await api.sessions.generateReport('PRM-CX0104')
        const reportObj = res.report?.reportData || res.report || {}
        const blob = new Blob([JSON.stringify(reportObj, null, 2)], {
          type: 'application/json',
        })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `pramaan-backend-audit-${CANDIDATE_DETAILS.id}-${currentScenario}.json`
        link.click()
        URL.revokeObjectURL(url)
        notify('Forensic report downloaded from backend (JSON)')
        return
      } catch (err) {
        console.warn('Backend report generation fallback to local:', err)
      }
    }

    // Local fallback export
    const reportData = {
      product: 'PRAMAAN Interview Integrity Layer',
      version: '1.0.0-hackathon-ready',
      generatedAt: new Date().toISOString(),
      candidate: CANDIDATE_DETAILS,
      activeScenario: currentScenario,
      integrityAudit: {
        riskScore: scenarioData.risk,
        status: scenarioData.status,
        confidence: scenarioData.confidence,
        signals: scenarioData.scores,
        challengeOutcome: scenarioData.challenge,
        explanation: scenarioData.explanation,
      },
      privacyGuarantees: {
        browserSideProcessing: true,
        rawVideoStored: false,
        rawAudioStored: false,
        humanReviewMandatory: true,
        disclaimer:
          'PRAMAAN provides decision-support signals and does not make automatic hiring decisions.',
      },
      sessionTimeline: events,
    }

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `pramaan-audit-${CANDIDATE_DETAILS.id}-${currentScenario}.json`
    link.click()
    URL.revokeObjectURL(url)
    notify('Forensic report downloaded (JSON)')
  }

  // Periodic signal telemetry ingestion (derived numeric signals ONLY — NO raw video/audio)
  useEffect(() => {
    if (!backendConnected) return

    const interval = setInterval(async () => {
      try {
        await api.sessions.sendSignals('PRM-CX0104', {
          faceMotionScore: scenarioData.scores.face,
          lipSyncScore: scenarioData.scores.voice,
          challengeScore: scenarioData.scores.challenge,
          streamQualityScore: isLowQualityMode ? 35 : scenarioData.scores.stream,
          visualEvidenceAvailable: !isLowQualityMode,
          audioEvidenceAvailable: true,
        })
      } catch {
        // Silent periodic ping
      }
    }, 12000)

    return () => clearInterval(interval)
  }, [backendConnected, scenarioData.scores, isLowQualityMode])

  // Cleanup media stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [stream])

  return (
    <div className="evidence-shell">
      {/* Left Charcoal Navigation Rail */}
      <Sidebar
        currentView={view}
        onViewChange={setView}
        currentScenario={currentScenario}
      />

      {/* Main Workspace Column */}
      <div className="workspace-wrapper">
        {/* Top Session Metadata Bar */}
        <TopBar
          currentView={view}
          scenario={currentScenario}
          data={scenarioData}
          isLowQualityMode={isLowQualityMode}
          backendConnected={backendConnected}
          isGuidedDemoOpen={isGuidedDemoOpen}
          onToggleGuidedDemo={() => setIsGuidedDemoOpen((prev) => !prev)}
          onRequestVerification={handleRequestVerification}
          onExportReport={handleExportReport}
        />

        {/* Guided Demo Control Panel Bar */}
        {isGuidedDemoOpen && view === 'live' && (
          <GuidedDemoPanel
            currentStep={guidedStep}
            isAutoRunning={isAutoRunning}
            elapsedSeconds={autoSeconds}
            onSelectStep={handleSelectGuidedStep}
            onToggleAutoRun={handleToggleAutoRun}
            onSkipNext={handleSkipNext}
            onSkipPrev={handleSkipPrev}
            onClose={() => setIsGuidedDemoOpen(false)}
          />
        )}

        {/* View Body */}
        <main className="workspace-content">
          {view === 'live' && (
            <LiveSessionView
              data={scenarioData}
              currentScenario={currentScenario}
              events={events}
              stream={stream}
              cameraError={cameraError}
              isLowQualityMode={isLowQualityMode}
              faceState={faceState}
              onRegisterVideo={(el) => {
                activeVideoRef.current = el
              }}
              onStartCamera={handleStartCamera}
              onStopCamera={handleStopCamera}
              onToggleLowQuality={setIsLowQualityMode}
              onRequestVerification={handleRequestVerification}
              onGoToLab={() => setView('lab')}
              isChallengeBannerOpen={isChallengeBannerOpen}
              challengeStatus={challengePhase}
              challengePrompt={challengePrompt}
              challengeSecondsLeft={challengeSecondsLeft}
              onPassChallenge={() => {
                setChallengePhase('passed')
                handleChallengeResult('passed')
              }}
              onPartialChallenge={() => {
                setChallengePhase('recorded')
                handleChallengeResult('partial')
              }}
              onDismissChallenge={() => setIsChallengeBannerOpen(false)}
            />
          )}

          {view === 'candidate' && (
            <CandidateSessionView
              data={scenarioData}
              stream={stream}
              cameraError={cameraError}
              isLowQualityMode={isLowQualityMode}
              faceState={faceState}
              onRegisterVideo={(el) => {
                activeVideoRef.current = el
              }}
              onStartCamera={handleStartCamera}
              onStopCamera={handleStopCamera}
              onToggleLowQuality={setIsLowQualityMode}
              onChallengeResult={handleChallengeResult}
              onStartIntegrityCheck={handleStartIntegrityCheck}
            />
          )}

          {view === 'evidence' && (
            <EvidenceView
              events={events}
              data={scenarioData}
              onExportReport={handleExportReport}
            />
          )}

          {view === 'lab' && (
            <DemoLabView
              currentScenario={currentScenario}
              onSelectScenario={handleSelectScenario}
              onToggleLowQuality={setIsLowQualityMode}
              isLowQualityMode={isLowQualityMode}
              onGoToLive={() => setView('live')}
            />
          )}

          {view === 'privacy' && <PrivacyControlsView />}
        </main>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="evidence-toast" role="status">
          <CheckCircle2 size={14} className="text-[#198754]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Final Demo Review Summary Modal */}
      <DemoSummaryModal
        isOpen={showSummaryModal}
        onExportReport={handleExportReport}
        onRunAgain={handleRunDemoAgain}
        onClose={() => setShowSummaryModal(false)}
      />

      {/* Offscreen Video Element for Local Face Detection Sampling */}
      <video
        ref={hiddenVideoRef}
        autoPlay
        muted
        playsInline
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 320,
          height: 240,
          opacity: 0.001,
          pointerEvents: 'none',
          zIndex: -1,
        }}
      />
    </div>
  )
}

