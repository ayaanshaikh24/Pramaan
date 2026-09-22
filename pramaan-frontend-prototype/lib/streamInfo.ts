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
}

export function getRealStreamInfo(stream: MediaStream | null): RealStreamInfo {
  if (!stream) {
    return {
      resolution: 'Video inactive',
      fps: 'FPS inactive',
      bandwidth: 'Quality estimate unavailable',
      hasVideo: false,
      hasAudio: false,
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
    }
  }

  const settings = videoTrack.getSettings?.() || {}
  const h = settings.height
  const w = settings.width
  const fps = settings.frameRate ? Math.round(settings.frameRate) : null

  const resolution = h ? `${h}p` : w ? `${w}w` : 'Live video'
  const fpsText = fps ? `${fps} FPS` : 'FPS unavailable'

  return {
    resolution,
    fps: fpsText,
    bandwidth: 'Quality estimate unavailable',
    hasVideo: true,
    hasAudio: !!audioTrack,
  }
}
