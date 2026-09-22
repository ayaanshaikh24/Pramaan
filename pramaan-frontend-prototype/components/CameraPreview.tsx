'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  Wifi,
  Activity,
  Scan,
  RefreshCw,
  Sparkles,
  AlertCircle,
} from 'lucide-react'
import { FacePresenceState } from '@/types/pramaan'

interface CameraPreviewProps {
  stream: MediaStream | null
  quality: 'Good' | 'Poor' | 'Degraded' | 'Not available'
  isLowQualityMode: boolean
  cameraError?: string | null
  faceState?: FacePresenceState
  onStartCamera: () => void
  onStopCamera: () => void
  onToggleLowQuality?: (val: boolean) => void
  showControls?: boolean
}

export function CameraPreview({
  stream,
  quality,
  isLowQualityMode,
  cameraError,
  faceState,
  onStartCamera,
  onStopCamera,
  onToggleLowQuality,
  showControls = true,
}: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasMicSignal, setHasMicSignal] = useState(true)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => {
        // Autoplay may need muted
      })
    }
  }, [stream])

  const effectiveQuality = isLowQualityMode || quality === 'Poor' ? 'Poor' : quality
  const isPoor = effectiveQuality === 'Poor' || effectiveQuality === 'Degraded'

  // Dynamic waveform bars
  const waveformHeights = [6, 12, 18, 9, 22, 15, 8, 19, 11, 24, 14, 7, 16, 10, 20, 12, 5, 14, 8, 17]

  return (
    <div className="camera-wrap">
      <div className={`camera-container ${isPoor ? 'camera-poor' : ''}`}>
        {/* Real video if stream active */}
        {stream ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="camera-video"
          />
        ) : (
          /* Graceful Fallback */
          <div className="camera-fallback">
            <div className="fallback-grid" />
            <div className="fallback-orb">
              <Camera size={32} />
            </div>
            <p className="fallback-title">
              {cameraError ? 'Camera Permission Denied' : 'Camera Preview Inactive'}
            </p>
            <span className="fallback-subtitle">
              {cameraError
                ? 'Graceful fallback mode active • Simulated biometric vector feed'
                : 'Click "Start Camera" to connect real webcam, or use simulated feed'}
            </span>

            {cameraError && (
              <div className="fallback-notice">
                <AlertCircle size={13} className="text-[#FF9D4D]" />
                <span>Simulated deterministic signals maintain full prototype functionality</span>
              </div>
            )}
          </div>
        )}

        {/* Biometric Face Overlay (hidden if face is not visible) */}
        {(!stream || faceState?.faceVisible !== false) && (
          <div className="face-overlay-box">
            <div className="face-scan-line" />
            <div className="face-corner tl" />
            <div className="face-corner tr" />
            <div className="face-corner bl" />
            <div className="face-corner br" />

            {/* Facial Landmark Nodes */}
            <div className="landmark-node lm-eye-left" title="Left Ocular Marker" />
            <div className="landmark-node lm-eye-right" title="Right Ocular Marker" />
            <div className="landmark-node lm-nose" title="Nasal Landmark" />
            <div className="landmark-node lm-mouth-left" />
            <div className="landmark-node lm-mouth-right" />
            <div className="landmark-node lm-chin" title="Gnathion Anchor" />
            <div className="landmark-mesh-ring" />

            <div className="face-mesh-tag">
              <Scan size={10} className="animate-pulse" />
              <span>MESH: 468 LANDMARKS</span>
            </div>
          </div>
        )}

        {/* Viewfinder Corners */}
        <div className="viewfinder-bracket vf-tl" />
        <div className="viewfinder-bracket vf-tr" />
        <div className="viewfinder-bracket vf-bl" />
        <div className="viewfinder-bracket vf-br" />

        {/* Top Badges */}
        <div className="camera-top-bar">
          <div className="flex items-center gap-2">
            <span className="pill pill-green">
              <span className="live-dot" /> Browser camera feed connected
            </span>
            <span className="pill pill-purple text-[10px]">
              <Sparkles size={11} /> 0-Byte Remote Video
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`pill ${isPoor ? 'pill-orange' : 'pill-cyan'}`}>
              <Wifi size={11} />
              Video Quality: {isPoor ? '480p Degraded' : '1080p HD'}
            </span>
          </div>
        </div>

        {/* Bottom Stream Telemetry */}
        <div className="camera-bottom-bar">
          <div className="flex items-center gap-3">
            <span className="telemetry-item">
              <Wifi size={12} className="text-[#25E0FF]" />
              {isPoor ? 'Bitrate: 450 kbps (Loss 8%)' : 'Bitrate: 3,400 kbps (Loss 0%)'}
            </span>
            <span className="telemetry-item">
              <Activity size={12} className="text-[#56E39F]" />
              {isPoor ? '15 FPS (Jitter 42ms)' : '30 FPS (Jitter 4ms)'}
            </span>
          </div>

          <div className="telemetry-badge">
            <span className="live-dot" />
            <span>Demo signal layer active</span>
          </div>
        </div>
      </div>

      {/* Honest Camera Disclaimer */}
      <div className="text-[10px] text-[var(--text-muted)] italic leading-tight px-1 mt-1.5">
        Camera preview is live. Integrity scores are controlled through Demo Lab for this prototype.
      </div>

      {/* Camera Controls & Audio Waveform */}
      {showControls && (
        <div className="camera-controls-bar">
          <div className="flex items-center gap-3">
            <div className="mic-badge">
              <Mic size={16} className="text-[#56E39F]" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white flex items-center gap-2">
                <span>Microphone Waveform</span>
                <span className="text-[10px] text-[#56E39F] font-mono">48kHz PCM</span>
              </div>
              {/* Dynamic waveform */}
              <div className="waveform-strip">
                {waveformHeights.map((h, i) => (
                  <span
                    key={i}
                    className="waveform-bar"
                    style={{
                      height: `${isPoor ? Math.max(3, h * 0.5) : h}px`,
                      animationDelay: `${(i % 5) * 0.12}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {onToggleLowQuality && (
              <label className="toggle-label" title="Simulate low bandwidth conditions">
                <span className="text-xs text-muted">Simulate Low Bandwidth</span>
                <input
                  type="checkbox"
                  checked={isLowQualityMode}
                  onChange={(e) => onToggleLowQuality(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            )}

            {stream ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={onStopCamera}
                title="Disconnect local camera stream"
              >
                <CameraOff size={14} />
                <span>Stop Camera</span>
              </button>
            ) : (
              <button
                type="button"
                id="btn-start-camera"
                className="btn btn-outline btn-sm"
                onClick={onStartCamera}
                title="Connect browser webcam via getUserMedia"
              >
                <Camera size={14} />
                <span>Start Camera</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
