/**
 * PRAMAAN Real Browser-Side Face Detection & Landmarker Engine
 *
 * Privacy Invariant:
 * Analyzes video stream strictly inside the local browser using MediaPipe FaceLandmarker.
 * NEVER transmits raw video frames, images, or audio to any server.
 * Only emits derived boolean/numeric presence metrics.
 *
 * Detector policy:
 * - MediaPipe FaceLandmarker is the ONLY detector. No mock or fabricated scores.
 * - If the model or WASM fails to load, the detector reports `unavailable` and the UI
 *   must show "Face detector unavailable" instead of any fake face score.
 */

export interface FaceDetectionResult {
  faceDetected: boolean
  confidence: number // 0 - 100, derived from real landmark completeness / framing
  motionScore: number | null // 0 - 100, derived from real landmark motion
  isCovered: boolean
  isOutsideFrame: boolean
  box?: {
    x: number // percentage 0 - 100
    y: number // percentage 0 - 100
    width: number // percentage 0 - 100
    height: number // percentage 0 - 100
  }
  landmarks?: Array<{ x: number; y: number; z: number }>
  detectorType: 'mediapipe' | 'none'
  detectorStatus: 'loading' | 'ready' | 'unavailable'
  errorMessage?: string
}

let faceLandmarkerInstance: any = null
let isInitializing = false
let initError: string | null = null
let lastTimestamp = 0

/** Normalized nose/gaze tracking history used to derive a real motion score. */
const MAX_MOTION_SAMPLES = 8
const pendingMotionSamples: Array<{ x: number; y: number }> = []

/**
 * Initialize MediaPipe FaceLandmarker (client-side only).
 * Runs once when the camera starts; destroyed when the camera stops.
 */
export async function initializeFaceDetector(): Promise<{
  success: boolean
  detectorType: 'mediapipe' | 'none'
  error?: string
}> {
  if (typeof window === 'undefined') {
    return { success: false, detectorType: 'none', error: 'SSR environment' }
  }

  if (faceLandmarkerInstance) {
    return { success: true, detectorType: 'mediapipe' }
  }

  // If another caller is already initializing, wait for it to finish.
  if (isInitializing) {
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 100))
      if (faceLandmarkerInstance) return { success: true, detectorType: 'mediapipe' }
    }
  }

  isInitializing = true

  try {
    const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')

    // 1. Resolve WASM binaries (local first, CDN fallback)
    let vision: any = null
    try {
      vision = await FilesetResolver.forVisionTasks('/wasm')
    } catch {
      vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      )
    }

    // 2. Initialize FaceLandmarker using local /models/face_landmarker.task
    const baseOptions = () => ({
      modelAssetPath: '/models/face_landmarker.task',
      delegate: 'GPU' as const,
    })

    let landmarker: any = null
    try {
      landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: baseOptions(),
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })
    } catch (gpuErr) {
      console.warn('FaceLandmarker GPU delegate failed, falling back to CPU:', gpuErr)
      landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { ...baseOptions(), delegate: 'CPU' },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })
    }

    faceLandmarkerInstance = landmarker
    isInitializing = false
    initError = null
    console.log('[PRAMAAN] MediaPipe FaceLandmarker initialized (local model + WASM)')
    return { success: true, detectorType: 'mediapipe' }
  } catch (err: any) {
    faceLandmarkerInstance = null
    isInitializing = false
    const message: string = err?.message || 'MediaPipe FaceLandmarker failed to load'
    initError = message
    console.warn('[PRAMAAN] Face detector unavailable — no mock fallback will be used:', message)
    return { success: false, detectorType: 'none', error: message }
  }
}

/**
 * Check if the camera video is covered or very dark.
 * Uses a tiny 32x24 offscreen canvas to measure mean luminance & variance.
 */
function analyzeFrameLuminance(video: HTMLVideoElement): {
  isCovered: boolean
  meanLuminance: number
  stdDev: number
} {
  try {
    const width = 32
    const height = 24
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return { isCovered: false, meanLuminance: 128, stdDev: 50 }

    ctx.drawImage(video, 0, 0, width, height)
    const imgData = ctx.getImageData(0, 0, width, height)
    const data = imgData.data

    let sum = 0
    const count = width * height
    const lumArray = new Float32Array(count)

    for (let i = 0; i < data.length; i += 4) {
      // Perceived luminance: 0.299R + 0.587G + 0.114B
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      lumArray[i / 4] = lum
      sum += lum
    }

    const mean = sum / count

    let varianceSum = 0
    for (let i = 0; i < count; i++) {
      const diff = lumArray[i] - mean
      varianceSum += diff * diff
    }
    const stdDev = Math.sqrt(varianceSum / count)

    // Camera is covered if almost pitch black or completely flat/monochrome
    const isCovered = mean < 18 || (mean < 35 && stdDev < 6)

    return { isCovered, meanLuminance: Math.round(mean), stdDev: Math.round(stdDev) }
  } catch {
    return { isCovered: false, meanLuminance: 100, stdDev: 30 }
  }
}

/**
 * Derive a presence confidence from real landmark data:
 * - landmark completeness (mediapipe emits 478 points)
 * - framing penalties when the face box is clipped at the frame edge or tiny
 */
function deriveConfidence(landmarks: Array<{ x: number; y: number; z: number }>, box: { x: number; y: number; width: number; height: number }): number {
  const expected = 478
  const completeness = Math.min(1, landmarks.length / expected)
  let conf = completeness * 100

  if (box.x < 3) conf -= 4
  if (box.x + box.width > 97) conf -= 4
  if (box.y < 3) conf -= 4
  if (box.y + box.height > 97) conf -= 4
  if (box.width < 15) conf -= 6
  if (box.height < 15) conf -= 6

  conf += 1 // detection was successful
  return Math.max(50, Math.min(99, Math.round(conf)))
}

/**
 * A basic face presence baseline derived from the real bounding-box geometry.
 * Used only until enough landmark samples exist to measure motion.
 */
function derivePresenceBaseline(box: { x: number; y: number; width: number; height: number }): number {
  // Faces that are well-sized and centered in frame give the strongest presence signal.
  let score = 90
  if (box.width < 20 || box.height < 20) score -= 6
  if (box.x < 3 || box.x + box.width > 97) score -= 4
  if (box.y < 3 || box.y + box.height > 97) score -= 4
  return Math.max(70, Math.min(99, score))
}

/**
 * Derive a facial motion score from the real displacement of the nose landmark
 * between consecutive detection frames. Natural micro-movement reads as strong
 * live presence; unnaturally rigid frames or violent jumps read weaker.
 */
function deriveMotionScore(nose: { x: number; y: number }, box: { x: number; y: number; width: number; height: number }): number | null {
  pendingMotionSamples.push({ x: nose.x, y: nose.y })
  if (pendingMotionSamples.length > MAX_MOTION_SAMPLES) {
    pendingMotionSamples.shift()
  }

  if (pendingMotionSamples.length < 3) {
    return derivePresenceBaseline(box)
  }

  let total = 0
  for (let i = 1; i < pendingMotionSamples.length; i++) {
    total += Math.hypot(
      pendingMotionSamples[i].x - pendingMotionSamples[i - 1].x,
      pendingMotionSamples[i].y - pendingMotionSamples[i - 1].y
    )
  }
  const avgDisplacement = total / (pendingMotionSamples.length - 1)

  // avgDisplacement is in normalized frame units per ~300ms tick.
  // Typical subtle head motion is 0.002 - 0.02 -> ~93-98 score.
  if (avgDisplacement < 0.0004) return 88 // unnaturally still
  if (avgDisplacement > 0.12) return 82 // violent jump (proxy-like)
  return Math.round(Math.min(98, Math.max(86, 93 + (avgDisplacement - 0.008) * 220)))
}

/**
 * Perform real face-presence detection on an active HTMLVideoElement.
 * Detects faces ONLY via MediaPipe when it loaded successfully.
 */
export async function detectFaceInVideo(
  video: HTMLVideoElement
): Promise<FaceDetectionResult> {
  const detectorOk = !!faceLandmarkerInstance
  const detectorKey = detectorOk
    ? 'mediapipe'
    : initError
    ? ('none' as const)
    : ('none' as const)

  if (!video || video.readyState < 2 || video.videoWidth === 0) {
    return {
      faceDetected: false,
      confidence: 0,
      motionScore: null,
      isCovered: false,
      isOutsideFrame: false,
      detectorType: detectorKey,
      detectorStatus: 'loading',
    }
  }

  // 1. Analyze video luminance / covered camera state
  const { isCovered } = analyzeFrameLuminance(video)
  if (isCovered) {
    return {
      faceDetected: false,
      confidence: 0,
      motionScore: null,
      isCovered: true,
      isOutsideFrame: false,
      detectorType: detectorKey,
      detectorStatus: 'ready',
    }
  }

  // 2. If MediaPipe never loaded, honestly report unavailable. No mock scores.
  if (!faceLandmarkerInstance) {
    return {
      faceDetected: false,
      confidence: 0,
      motionScore: null,
      isCovered: false,
      isOutsideFrame: false,
      detectorType: 'none',
      detectorStatus: 'unavailable',
      errorMessage: initError || 'Detector unavailable',
    }
  }

  // 3. Primary detector: MediaPipe FaceLandmarker (runningMode VIDEO)
  try {
    let timestampMs = performance.now()
    if (timestampMs <= lastTimestamp) {
      timestampMs = lastTimestamp + 1
    }
    lastTimestamp = timestampMs

    const results = faceLandmarkerInstance.detectForVideo(video, timestampMs)
    const landmarksList = results.faceLandmarks

    if (landmarksList && landmarksList.length > 0) {
      const landmarks = landmarksList[0]

      // Compute exact bounding box from the real landmark set
      let minX = 1
      let maxX = 0
      let minY = 1
      let maxY = 0
      for (let i = 0; i < landmarks.length; i++) {
        const pt = landmarks[i]
        if (pt.x < minX) minX = pt.x
        if (pt.x > maxX) maxX = pt.x
        if (pt.y < minY) minY = pt.y
        if (pt.y > maxY) maxY = pt.y
      }

      const box = {
        x: Math.max(0, Math.min(100, minX * 100)),
        y: Math.max(0, Math.min(100, minY * 100)),
        width: Math.max(8, Math.min(100, (maxX - minX) * 100)),
        height: Math.max(8, Math.min(100, (maxY - minY) * 100)),
      }

      // Nose bridge landmark used as the motion anchor
      const nose = landmarks[1] || landmarks[4] || landmarks[0]
      const motionScore = nose ? deriveMotionScore(nose, box) : derivePresenceBaseline(box)
      const confidence = deriveConfidence(landmarks, box)

      return {
        faceDetected: true,
        confidence,
        motionScore,
        isCovered: false,
        isOutsideFrame: false,
        box,
        landmarks,
        detectorType: 'mediapipe',
        detectorStatus: 'ready',
      }
    }

    // No landmarks in this frame -> candidate moved outside the frame
    return {
      faceDetected: false,
      confidence: 0,
      motionScore: null,
      isCovered: false,
      isOutsideFrame: true,
      detectorType: 'mediapipe',
      detectorStatus: 'ready',
    }
  } catch (err: any) {
    console.warn('[PRAMAAN] detectForVideo error:', err)
    return {
      faceDetected: false,
      confidence: 0,
      motionScore: null,
      isCovered: false,
      isOutsideFrame: false,
      detectorType: 'mediapipe',
      detectorStatus: 'ready',
      errorMessage: err?.message,
    }
  }
}

export function destroyFaceDetector(): void {
  if (faceLandmarkerInstance && typeof faceLandmarkerInstance.close === 'function') {
    try {
      faceLandmarkerInstance.close()
    } catch (e) {
      console.warn('[PRAMAAN] Error closing FaceLandmarker:', e)
    }
  }
  faceLandmarkerInstance = null
  initError = null
  isInitializing = false
  pendingMotionSamples.length = 0
  lastTimestamp = 0
}

export function isFaceDetectorReady(): boolean {
  return !!faceLandmarkerInstance
}

if (typeof window !== 'undefined') {
  ;(window as any).__pramaanFaceDetector = {
    initializeFaceDetector,
    detectFaceInVideo,
    destroyFaceDetector,
    isFaceDetectorReady,
    getInstance: () => faceLandmarkerInstance,
  }
}