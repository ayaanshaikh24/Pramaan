/**
 * Real Stream Information Extractor
 *
 * Inspects active MediaStreamTrack settings to report true resolution and framerate.
 * Avoids hardcoding fake network statistics.
 */

export interface RealStreamInfo {
  resolution: string
  fps: string
  bandwidth: string
  hasVideo: boolean
  hasAudio: boolean
  /** Numeric values for deriving honest stream-quality scores. */
  fpsValue: number | null
  widthValue: number | null
  heightValue: number | null
}

export function getRealStreamInfo(stream: MediaStream | null): RealStreamInfo {
  if (!stream) {
    return {
      resolution: 'Video inactive',
      fps: 'FPS inactive',
      bandwidth: 'Quality estimate unavailable',
      hasVideo: false,
      hasAudio: false,
      fpsValue: null,
      widthValue: null,
      heightValue: null,
    }
  }

  const videoTrack = stream.getVideoTracks()[0]
  const audioTrack = stream.getAudioTracks()[0]

  if (!videoTrack) {
    return {
      resolution: 'Video unavailable',
      fps: 'FPS unavailable',
      bandwidth: 'Quality estimate unavailable',
      hasVideo: false,
      hasAudio: !!audioTrack,
      fpsValue: null,
      widthValue: null,
      heightValue: null,
    }
  }

  const settings = videoTrack.getSettings?.() || {}
  const h = settings.height || null
  const w = settings.width || null
  const fps = settings.frameRate ? Math.round(settings.frameRate) : null

  const resolution = h ? `${h}p` : w ? `${w}w` : 'Live video'
  const fpsText = fps ? `${fps} FPS` : 'FPS unavailable'

  return {
    resolution,
    fps: fpsText,
    bandwidth: 'Quality estimate unavailable',
    hasVideo: true,
    hasAudio: !!audioTrack,
    fpsValue: fps,
    widthValue: w,
    heightValue: h,
  }
}

/**
 * Derive an honest stream-quality score from real track settings.
 * Resolution and frame-rate are read directly from the active MediaStreamTrack.
 */
export function deriveStreamScore(stream: MediaStream | null): number | null {
  if (!stream) return null
  const info = getRealStreamInfo(stream)
  if (!info.hasVideo) return null

  let score = 92
  if (info.fpsValue == null) {
    score -= 8
  } else if (info.fpsValue >= 30) {
    score = 94
  } else if (info.fpsValue >= 24) {
    score = 90
  } else if (info.fpsValue >= 15) {
    score = 78
  } else {
    score = 62
  }

  const h = info.heightValue || 0
  if (h < 360) score -= 8
  else if (h >= 720) score += 2

  return Math.max(40, Math.min(98, score))
}