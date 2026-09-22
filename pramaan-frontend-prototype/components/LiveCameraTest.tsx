'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, AlertTriangle, Loader2 } from 'lucide-react'

// @mediapipe/tasks-vision is browser-only; dynamic import keeps this out of the
// server bundle and off the critical render path.
const VISION_CDN_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
const MODEL_PATH = '/models/face_landmarker.task'

type DetectionStatus =
  | 'IDLE'
  | 'LOADING_DETECTOR'
  | 'FACE_VISIBLE'
  | 'FACE_NOT_VISIBLE'
  | 'CAMERA_PERMISSION_DENIED'
  | 'DETECTOR_UNAVAILABLE'

interface DetectedFace {
  x: number
  y: number
  z: number
}

interface TimelineEvent {
  time: string
  title: string
}

type VisionLikeLandmarker = {
  detectForVideo: (video: HTMLVideoElement, timestamp: number) => {
    faceLandmarks?: DetectedFace[][]
  }
  close: () => void
}

// Compact landmark connection subsets (indices into the 478-point Face Landmarker mesh)
const FACE_OVAL = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109]
const RIGHT_EYE = [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246]
const LEFT_EYE = [362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398]
const RIGHT_BROW = [70,63,105,66,107]
const LEFT_BROW = [336,296,334,293,300]
const MOUTH_OUTLINE = [61,146,91,181,84,17,314,405,321,375,291,308,324,318,402,317,14,87,178,88,95]

const CONNECTIONS = [
  ...FACE_OVAL,
  ...RIGHT_EYE,
  ...LEFT_EYE,
  ...RIGHT_BROW,
  ...LEFT_BROW,
  ...MOUTH_OUTLINE,
]

const STATUS_COLOR: Record<DetectionStatus, string> = {
  IDLE: '#8A8FA0',
  LOADING_DETECTOR: '#E9A23B',
  FACE_VISIBLE: '#2ECC71',
  FACE_NOT_VISIBLE: '#E74C3C',
  CAMERA_PERMISSION_DENIED: '#E74C3C',
  DETECTOR_UNAVAILABLE: '#E74C3C',
}

const STATUS_MESSAGE: Record<DetectionStatus, string> = {
  IDLE: 'Camera not started. Press "Start Camera" to initialise the real browser face detector.',
  LOADING_DETECTOR: 'Loading MediaPipe Face Landmarker model + WASM…',
  FACE_VISIBLE: 'Real browser sensor active. Face landmarks detected from the live camera stream.',
  FACE_NOT_VISIBLE: 'Visual evidence unavailable. No face detected in frame for over 1.5 seconds.',
  CAMERA_PERMISSION_DENIED: 'The browser blocked camera access. No fake feed is substituted.',
  DETECTOR_UNAVAILABLE: 'The MediaPipe model failed to load. No fake detector is used.',
}

export function LiveCameraTest() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const landmarkerRef = useRef<VisionLikeLandmarker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const restoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Transition tracking refs (avoids a re-render per 300ms tick)
  const prevVisibleRef = useRef(false) // was a face visible on the previous tick
  const missingSinceRef = useRef<number | null>(null)
  const statusRef = useRef<DetectionStatus>('IDLE')

  const [status, setStatusState] = useState<DetectionStatus>('IDLE')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [faceCount, setFaceCount] = useState(0)
  const [showRestored, setShowRestored] = useState(false)
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [detectorStatus, setDetectorStatus] = useState('not started')
  const [lastDetectionTime, setLastDetectionTime] = useState<string | null>(null)
  const [cameraWidth, setCameraWidth] = useState<number | null>(null)
  const [cameraHeight, setCameraHeight] = useState<number | null>(null)
  const [videoTime, setVideoTime] = useState(0)
  const [cameraStarted, setCameraStarted] = useState(false)

  const setStatus = useCallback((s: DetectionStatus) => {
    statusRef.current = s
    setStatusState(s)
  }, [])

  const addEvent = useCallback((title: string) => {
    const time = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    setEvents((prev) => [{ time, title }, ...prev])
  }, [])

  const clearOverlay = useCallback(() => {
    const canvas = overlayRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }, [])

  const drawLandmarks = useCallback((landmarks: DetectedFace[]) => {
    const video = videoRef.current
    const canvas = overlayRef.current
    if (!video || !canvas) return
    const width = video.offsetWidth
    const height = video.offsetHeight
    if (width === 0 || height === 0) return

    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)

    const minX = Math.min(...landmarks.map((l) => l.x))
    const maxX = Math.max(...landmarks.map((l) => l.x))
    const minY = Math.min(...landmarks.map((l) => l.y))
    const maxY = Math.max(...landmarks.map((l) => l.y))
    const box = {
      x: minX * width - 8,
      y: minY * height - 8,
      w: (maxX - minX) * width + 16,
      h: (maxY - minY) * height + 16,
    }

    // Label chip
    ctx.font = '600 11px "IBM Plex Mono", monospace'
    ctx.fillStyle = '#12231a'
    ctx.fillRect(box.x, box.y - 18, 118, 18)
    ctx.fillStyle = '#2ECC71'
    ctx.fillText('FACE DETECTED', box.x + 6, box.y - 5)

    // Bounding box
    ctx.strokeStyle = '#2ECC71'
    ctx.lineWidth = 3
    ctx.strokeRect(box.x, box.y, box.w, box.h)

    // Landmark points
    ctx.fillStyle = 'rgba(46, 204, 113, 0.9)'
    for (const l of landmarks) {
      ctx.beginPath()
      ctx.arc(l.x * width, l.y * height, 1.6, 0, Math.PI * 2)
      ctx.fill()
    }

    // Connection lines
    ctx.strokeStyle = 'rgba(46, 204, 113, 0.5)'
    ctx.lineWidth = 1
    for (let i = 0; i < CONNECTIONS.length; i += 2) {
      const a = landmarks[CONNECTIONS[i]]
      const b = landmarks[CONNECTIONS[i + 1]]
      if (!a || !b) continue
      ctx.beginPath()
      ctx.moveTo(a.x * width, a.y * height)
      ctx.lineTo(b.x * width, b.y * height)
      ctx.stroke()
    }
  }, [])

  const stopAll = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (restoreTimerRef.current) {
      clearTimeout(restoreTimerRef.current)
      restoreTimerRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    landmarkerRef.current = null
    prevVisibleRef.current = false
    missingSinceRef.current = null
    clearOverlay()
    setFaceCount(0)
    setShowRestored(false)
    setCameraStarted(false)
    setVideoTime(0)
    setStatus('IDLE')
  }, [clearOverlay, setStatus])

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
      if (landmarkerRef.current) landmarkerRef.current.close?.()
    }
  }, [])

  const detectionTick = useCallback(async () => {
    const video = videoRef.current
    const landmarker = landmarkerRef.current
    if (!video || !landmarker || video.readyState < 2) return

    // Real values for the debug panel
    setLastDetectionTime(new Date().toLocaleTimeString([], { hour12: false }))
    setCameraWidth(video.videoWidth || null)
    setCameraHeight(video.videoHeight || null)
    setVideoTime(video.currentTime)

    let count = 0
    let faceLandmarks: DetectedFace[] | undefined
    try {
      const result = landmarker.detectForVideo(video, performance.now())
      count = result.faceLandmarks?.length ?? 0
      faceLandmarks = result.faceLandmarks?.[0]
    } catch (err) {
      console.warn('[LiveCameraTest] detectForVideo error:', err)
      return
    }

    const now = Date.now()
    setFaceCount(count)

    if (count > 0) {
      // Face present
      missingSinceRef.current = null
      if (!prevVisibleRef.current) {
        // Transition: not visible -> visible
        prevVisibleRef.current = true
        if (statusRef.current === 'FACE_NOT_VISIBLE') {
          // A real return (the face was previously in frame)
          addEvent('Visual evidence restored')
          setShowRestored(true)
          if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current)
          restoreTimerRef.current = setTimeout(() => setShowRestored(false), 3000)
        }
      }
      if (statusRef.current !== 'FACE_VISIBLE') setStatus('FACE_VISIBLE')
      if (faceLandmarks) drawLandmarks(faceLandmarks)
    } else {
      // Face absent
      if (!prevVisibleRef.current) {
        // Never visible yet (or already flagged) — no transition event, but the
        // running detector genuinely sees no face, so the panel shows it.
        if (statusRef.current !== 'FACE_NOT_VISIBLE') setStatus('FACE_NOT_VISIBLE')
        missingSinceRef.current = null
        clearOverlay()
        return
      }
      if (missingSinceRef.current === null) missingSinceRef.current = now
      if (now - missingSinceRef.current >= 1500) {
        prevVisibleRef.current = false
        missingSinceRef.current = null
        setStatus('FACE_NOT_VISIBLE')
        addEvent('Face no longer visible')
        clearOverlay()
      }
    }
  }, [addEvent, clearOverlay, drawLandmarks, setStatus])

  const initialiseLandmarker = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      setDetectorStatus('loading (WASM + model)')
      const vision = await import('@mediapipe/tasks-vision')
      const { FilesetResolver, FaceLandmarker } = vision

      let fileset: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>
      try {
        fileset = await FilesetResolver.forVisionTasks('/wasm')
      } catch (e) {
        console.warn('[LiveCameraTest] Local WASM failed, switching to CDN:', e)
        fileset = await FilesetResolver.forVisionTasks(VISION_CDN_WASM)
      }

      let landmarker: VisionLikeLandmarker
      try {
        landmarker = (await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        })) as VisionLikeLandmarker
        setDetectorStatus('ready (GPU)')
      } catch (e) {
        console.warn('[LiveCameraTest] GPU delegate failed, retrying with CPU:', e)
        landmarker = (await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'CPU' },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        })) as VisionLikeLandmarker
        setDetectorStatus('ready (CPU)')
      }

      landmarkerRef.current = landmarker
      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[LiveCameraTest] MediaPipe init failed:', err)
      return { ok: false, error: message }
    }
  }, [])

  const handleStartCamera = useCallback(async () => {
    setErrorMessage(null)
    setEvents([])
    await stopAll()

    setStatus('LOADING_DETECTOR')
    setDetectorStatus('waiting for camera…')

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStatus('CAMERA_PERMISSION_DENIED')
      setErrorMessage(message)
      setDetectorStatus('not started')
      return
    }

    streamRef.current = stream
    const video = videoRef.current
    if (video) {
      video.srcObject = stream
      await video.play().catch((e) => console.warn('[LiveCameraTest] video.play():', e))
    }
    setCameraStarted(true)

    // Load the MediaPipe Face Landmarker while the camera preview is live
    const init = await initialiseLandmarker()
    if (!init.ok) {
      setStatus('DETECTOR_UNAVAILABLE')
      setErrorMessage(init.error || 'Face detector unavailable')
      setDetectorStatus('unavailable')
      return
    }

    // 300ms detection loop
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(detectionTick, 300)
  }, [detectionTick, initialiseLandmarker, stopAll])

  const handleStopCamera = useCallback(() => {
    stopAll()
    setDetectorStatus('not started')
    setErrorMessage(null)
  }, [stopAll])

  const mainLabel =
    status === 'FACE_VISIBLE'
      ? showRestored
        ? 'Face visible again'
        : 'Face visible'
      : status === 'IDLE'
      ? 'Camera not started'
      : status.replace(/_/g, ' ')

  const accent = STATUS_COLOR[status]

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0B0F17',
        color: '#E8EAF0',
        fontFamily: '"IBM Plex Mono", monospace',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
          paddingBottom: '12px',
        }}
      >
        <div>
          <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '0.5px' }}>
            PRAMAAN · Live Camera Test
          </div>
          <div style={{ fontSize: '12px', color: '#8A8FA0', marginTop: '2px' }}>
            Real browser face detection — no simulated values, no demo data, no backend.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {!cameraStarted ? (
            <button
              type="button"
              onClick={handleStartCamera}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#2ECC71',
                color: '#0B0F17',
                fontWeight: 700,
                border: 'none',
                borderRadius: '8px',
                padding: '10px 18px',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              <Camera size={16} />
              Start Camera
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStopCamera}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#1F2633',
                color: '#E8EAF0',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                padding: '10px 18px',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              <CameraOff size={16} />
              Stop Camera
            </button>
          )}
        </div>
      </header>

      {/* Live status panel — always visible */}
      <section
        style={{
          border: `2px solid ${accent}`,
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          alignItems: 'center',
          gap: '18px',
        }}
      >
        <div
          style={{
            minWidth: '230px',
            textAlign: 'center',
            padding: '14px 10px',
            borderRadius: '10px',
            background: `${accent}1A`,
            border: `1px solid ${accent}`,
          }}
        >
          <div style={{ fontSize: '11px', letterSpacing: '2px', color: '#8A8FA0' }}>
            LIVE STATUS
          </div>
          <div
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: accent,
              marginTop: '8px',
              textTransform: 'uppercase',
              minHeight: '28px',
            }}
          >
            {mainLabel}
          </div>
          {status === 'LOADING_DETECTOR' && (
            <Loader2 size={18} style={{ color: accent, animation: 'live-test-spin 1s linear infinite', marginTop: '8px' }} />
          )}
        </div>
        <div>
          <div
            style={{
              fontSize: status === 'FACE_VISIBLE' ? '15px' : '14px',
              fontWeight: status === 'FACE_VISIBLE' ? 600 : 400,
              color: accent,
              lineHeight: 1.45,
            }}
          >
            {status === 'FACE_VISIBLE' && 'Real browser sensor — live MediaPipe Face Landmarker.'}
            {status === 'FACE_NOT_VISIBLE' && 'Visual evidence unavailable.'}
            {status === 'DETECTOR_UNAVAILABLE' && 'Face detector unavailable.'}
            {status === 'CAMERA_PERMISSION_DENIED' && 'Camera permission denied.'}
            {status === 'LOADING_DETECTOR' && 'Loading detector…'}
          </div>
          <div style={{ fontSize: '13px', color: '#C6CBD6', marginTop: '6px', lineHeight: 1.5 }}>
            {STATUS_MESSAGE[status]}
          </div>
          {status === 'FACE_VISIBLE' && showRestored && (
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#2ECC71', marginTop: '6px' }}>
              Face visible again — landmark overlay restored.
            </div>
          )}
          {status === 'FACE_VISIBLE' && !showRestored && faceCount > 0 && (
            <div style={{ fontSize: '13px', color: '#9FE8BE', marginTop: '6px' }}>
              {faceCount} face(s) detected ·
              {cameraWidth && cameraHeight ? ` camera ${cameraWidth}×${cameraHeight}` : ''}
            </div>
          )}
          {status === 'FACE_NOT_VISIBLE' && (
            <div style={{ fontSize: '13px', color: '#F5A9A0', marginTop: '6px' }}>
              0 faces in frame for over 1.5s — overlay hidden, visual evidence unavailable.
            </div>
          )}
          {errorMessage && (
            <div
              style={{
                marginTop: '10px',
                fontSize: '12px',
                color: '#F5A9A0',
                background: 'rgba(231,76,60,0.12)',
                border: '1px solid rgba(231,76,60,0.4)',
                borderRadius: '8px',
                padding: '10px 12px',
                wordBreak: 'break-word',
              }}
            >
              <AlertTriangle size={13} style={{ display: 'inline', marginRight: '6px' }} />
              {errorMessage}
            </div>
          )}
        </div>
      </section>

      {/* Camera preview + landmark overlay + debug panel */}
      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(280px, 1fr)', gap: '16px' }}>
        <div
          style={{
            position: 'relative',
            background: '#05070C',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.12)',
            minHeight: '420px',
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{ width: '100%', height: '420px', objectFit: 'cover', display: 'block', backgroundColor: '#05070C' }}
          />
          <canvas
            ref={overlayRef}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          />
          {!cameraStarted && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0B0F17',
              }}
            >
              <div style={{ color: '#8A8FA0', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                <Camera size={28} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.5 }} />
                Camera preview will appear here after pressing "Start Camera".
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Debug panel — real values only */}
          <div
            style={{
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: '#05070C',
              padding: '14px',
            }}
          >
            <div style={{ fontSize: '11px', letterSpacing: '2px', color: '#8A8FA0', marginBottom: '10px' }}>
              DEBUG — REAL VALUES
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
              <DebugRow label="Detector status" value={detectorStatus} />
              <DebugRow label="Last detection time" value={lastDetectionTime ?? '—'} />
              <DebugRow label="Detected face count" value={String(faceCount)} />
              <DebugRow label="Camera width" value={cameraWidth ? `${cameraWidth}px` : '—'} />
              <DebugRow label="Camera height" value={cameraHeight ? `${cameraHeight}px` : '—'} />
              <DebugRow label="Current video time" value={`${videoTime.toFixed(2)}s`} />
              <DebugRow label="Model path" value={MODEL_PATH} />
            </div>
          </div>

          {/* Timestamped events */}
          <div
            style={{
              flex: 1,
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: '#05070C',
              padding: '14px',
            }}
          >
            <div style={{ fontSize: '11px', letterSpacing: '2px', color: '#8A8FA0', marginBottom: '10px' }}>
              DETECTION EVENTS ({events.length})
            </div>
            {events.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#8A8FA0' }}>
                No transitions yet. Detection events appear when the face leaves or returns to frame.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {events.map((e, i) => (
                  <div
                    key={i}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      borderLeft: `3px solid ${e.title.includes('longer') ? '#E74C3C' : '#2ECC71'}`,
                      borderRadius: '6px',
                      padding: '8px 10px',
                      fontSize: '12.5px',
                    }}
                  >
                    <span style={{ color: '#8A8FA0', marginRight: '8px' }}>{e.time}</span>
                    {e.title}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <style>{`
        @keyframes live-test-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
      <span style={{ color: '#8A8FA0' }}>{label}</span>
      <span style={{ fontWeight: 600, color: '#E8EAF0', textAlign: 'right' }}>{value}</span>
    </div>
  )
}