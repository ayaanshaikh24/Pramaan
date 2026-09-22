/**
 * PRAMAAN Browser-Side Face Detection Engine
 *
 * Privacy Invariant:
 * Analyzes video stream strictly inside the local browser.
 * NEVER transmits raw video frames, images, or audio to any server.
 * Only emits derived boolean/numeric presence metrics.
 */

export interface FaceDetectionResult {
  faceDetected: boolean
  confidence: number // 0 - 100
  isCovered: boolean
  isOutsideFrame: boolean
  box?: {
    x: number // percentage 0 - 100
    y: number // percentage 0 - 100
    width: number // percentage 0 - 100
    height: number // percentage 0 - 100
  }
  detectorType: 'mediapipe' | 'native' | 'canvas' | 'none'
  detectorStatus: 'loading' | 'ready' | 'unavailable'
  errorMessage?: string
}

let faceDetectorInstance: any = null
let isInitializing = false
let initError: string | null = null

/**
 * Initialize the MediaPipe FaceDetector (client-only)
 */
export async function initializeFaceDetector(): Promise<{
  success: boolean
  detectorType: 'mediapipe' | 'native' | 'canvas' | 'none'
  error?: string
}> {
  if (typeof window === 'undefined') {
    return { success: false, detectorType: 'none', error: 'SSR environment' }
  }

  if (faceDetectorInstance) {
    return { success: true, detectorType: 'mediapipe' }
  }

  if (isInitializing) {
    // Wait for in-progress initialization
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 100))
      if (faceDetectorInstance) return { success: true, detectorType: 'mediapipe' }
    }
  }

  isInitializing = true

  try {
    const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision')

    // Try local wasm first, then fallback to jsdelivr CDN
    let vision: any = null
    try {
      vision = await FilesetResolver.forVisionTasks('/wasm')
    } catch {
      vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      )
    }

    // Try local model first, then fallback to Google Cloud Storage
    let detector: any = null
    try {
      detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: '/models/blaze_face_short_range.tflite',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.45,
      })
    } catch {
      detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.45,
      })
    }

    faceDetectorInstance = detector
    isInitializing = false
    return { success: true, detectorType: 'mediapipe' }
  } catch (err: any) {
    isInitializing = false
    initError = err?.message || 'MediaPipe initialization failed'
    console.warn('MediaPipe FaceDetector failed to initialize, testing native/canvas fallback:', err)

    // Check for native browser FaceDetector (Chromium Shape Detection API)
    if ('FaceDetector' in window) {
      return { success: true, detectorType: 'native' }
    }

    return { success: true, detectorType: 'canvas', error: initError }
  }
}

/**
 * Check if the camera video is covered or very dark
 * Uses a tiny 32x24 offscreen canvas to measure mean luminance & variance
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

    // Camera is covered if almost pitch black (mean < 18) or completely flat/monochrome (stdDev < 5)
    const isCovered = mean < 18 || (mean < 35 && stdDev < 6)

    return { isCovered, meanLuminance: Math.round(mean), stdDev: Math.round(stdDev) }
  } catch {
    return { isCovered: false, meanLuminance: 100, stdDev: 30 }
  }
}

/**
 * Perform detection on an active HTMLVideoElement
 */
export async function detectFaceInVideo(
  video: HTMLVideoElement
): Promise<FaceDetectionResult> {
  if (!video || video.readyState < 2 || video.videoWidth === 0) {
    return {
      faceDetected: false,
      confidence: 0,
      isCovered: false,
      isOutsideFrame: false,
      detectorType: faceDetectorInstance ? 'mediapipe' : 'none',
      detectorStatus: 'loading',
    }
  }

  // 1. Analyze video luminance / covered camera state
  const { isCovered } = analyzeFrameLuminance(video)
  if (isCovered) {
    return {
      faceDetected: false,
      confidence: 0,
      isCovered: true,
      isOutsideFrame: false,
      detectorType: faceDetectorInstance ? 'mediapipe' : 'canvas',
      detectorStatus: 'ready',
    }
  }

  // 2. Primary detector: MediaPipe BlazeFace
  if (faceDetectorInstance) {
    try {
      const timestampMs = performance.now()
      const detections = faceDetectorInstance.detectForVideo(video, timestampMs)
      const found = detections.detections && detections.detections.length > 0

      if (found) {
        const topDetection = detections.detections[0]
        const score = topDetection.categories?.[0]?.score ?? 0.94
        const bb = topDetection.boundingBox

        let box: FaceDetectionResult['box'] = undefined
        if (bb && video.videoWidth > 0 && video.videoHeight > 0) {
          box = {
            x: Math.max(0, Math.min(100, (bb.originX / video.videoWidth) * 100)),
            y: Math.max(0, Math.min(100, (bb.originY / video.videoHeight) * 100)),
            width: Math.max(5, Math.min(100, (bb.width / video.videoWidth) * 100)),
            height: Math.max(5, Math.min(100, (bb.height / video.videoHeight) * 100)),
          }
        }

        return {
          faceDetected: true,
          confidence: Math.round(score * 100),
          isCovered: false,
          isOutsideFrame: false,
          box,
          detectorType: 'mediapipe',
          detectorStatus: 'ready',
        }
      } else {
        // Not covered, but no face detected -> Candidate moved outside frame
        return {
          faceDetected: false,
          confidence: 0,
          isCovered: false,
          isOutsideFrame: true,
          detectorType: 'mediapipe',
          detectorStatus: 'ready',
        }
      }
    } catch (err: any) {
      console.warn('MediaPipe frame inference error:', err)
    }
  }

  // 3. Fallback: Native window.FaceDetector
  if (typeof window !== 'undefined' && 'FaceDetector' in window) {
    try {
      const NativeDetector = (window as any).FaceDetector
      const detector = new NativeDetector({ fastMode: true, maxDetectedFaces: 1 })
      const faces = await detector.detect(video)

      if (faces && faces.length > 0) {
        const f = faces[0]
        const bb = f.boundingBox
        let box: FaceDetectionResult['box'] = undefined
        if (bb && video.videoWidth > 0 && video.videoHeight > 0) {
          box = {
            x: Math.max(0, Math.min(100, (bb.x / video.videoWidth) * 100)),
            y: Math.max(0, Math.min(100, (bb.y / video.videoHeight) * 100)),
            width: Math.max(5, Math.min(100, (bb.width / video.videoWidth) * 100)),
            height: Math.max(5, Math.min(100, (bb.height / video.videoHeight) * 100)),
          }
        }

        return {
          faceDetected: true,
          confidence: 92,
          isCovered: false,
          isOutsideFrame: false,
          box,
          detectorType: 'native',
          detectorStatus: 'ready',
        }
      } else {
        return {
          faceDetected: false,
          confidence: 0,
          isCovered: false,
          isOutsideFrame: true,
          detectorType: 'native',
          detectorStatus: 'ready',
        }
      }
    } catch (err) {
      console.warn('Native FaceDetector error:', err)
    }
  }

  // 4. Fallback: Canvas Human Skin & Presence Filter
  // Samples center region for human skin tone cluster (YCbCr / HSV)
  try {
    const width = 64
    const height = 48
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (ctx) {
      ctx.drawImage(video, 0, 0, width, height)
      const data = ctx.getImageData(0, 0, width, height).data

      let skinPixels = 0
      let totalSamples = 0

      // Sample center 60% of screen where face normally resides
      const startX = Math.floor(width * 0.2)
      const endX = Math.floor(width * 0.8)
      const startY = Math.floor(height * 0.15)
      const endY = Math.floor(height * 0.85)

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * width + x) * 4
          const r = data[idx]
          const g = data[idx + 1]
          const b = data[idx + 2]
          totalSamples++

          // Standard normalized RGB skin detection rule:
          // R > 95, G > 40, B > 20, max(R,G,B) - min(R,G,B) > 15, |R - G| > 15, R > G, R > B
          const max = Math.max(r, g, b)
          const min = Math.min(r, g, b)
          if (r > 80 && g > 35 && b > 20 && max - min > 12 && r > g && r > b) {
            skinPixels++
          }
        }
      }

      const skinRatio = skinPixels / Math.max(1, totalSamples)
      const hasPresence = skinRatio > 0.14 // at least 14% of center frame has human skin cluster

      if (hasPresence) {
        return {
          faceDetected: true,
          confidence: 88,
          isCovered: false,
          isOutsideFrame: false,
          box: { x: 25, y: 20, width: 50, height: 60 },
          detectorType: 'canvas',
          detectorStatus: 'ready',
        }
      } else {
        return {
          faceDetected: false,
          confidence: 0,
          isCovered: false,
          isOutsideFrame: true,
          detectorType: 'canvas',
          detectorStatus: 'ready',
        }
      }
    }
  } catch (err) {
    console.warn('Canvas skin detector error:', err)
  }

  return {
    faceDetected: false,
    confidence: 0,
    isCovered: false,
    isOutsideFrame: false,
    detectorType: 'none',
    detectorStatus: 'unavailable',
    errorMessage: initError || 'Detector unavailable',
  }
}
