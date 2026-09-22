'use client'

import { useState, useEffect, useRef } from 'react'

export interface AudioMeterState {
  isMicAvailable: boolean
  audioLevel: number // 0 to 1
  waveformHeights: number[]
  statusText: string
}

export function useAudioMeter(stream: MediaStream | null): AudioMeterState {
  const [audioLevel, setAudioLevel] = useState<number>(0)
  const [waveformHeights, setWaveformHeights] = useState<number[]>(() =>
    [6, 12, 18, 9, 22, 15, 8, 19, 11, 24, 14, 7, 16, 10, 20, 12]
  )
  const [isMicAvailable, setIsMicAvailable] = useState<boolean>(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!stream) {
      setIsMicAvailable(false)
      setAudioLevel(0)
      return
    }

    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length === 0 || !audioTracks[0].enabled) {
      setIsMicAvailable(false)
      setAudioLevel(0)
      return
    }

    let isCancelled = false

    try {
      const AudioCtxClass =
        window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtxClass) {
        setIsMicAvailable(false)
        return
      }

      const audioCtx = new AudioCtxClass()
      audioCtxRef.current = audioCtx

      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 64
      analyser.smoothingTimeConstant = 0.5
      source.connect(analyser)
      analyserRef.current = analyser

      setIsMicAvailable(true)

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const tick = () => {
        if (isCancelled) return
        analyser.getByteFrequencyData(dataArray)

        // Calculate average amplitude
        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i]
        }
        const avg = sum / bufferLength
        const normalized = Math.min(1, avg / 128)
        setAudioLevel(normalized)

        // Map to 16 waveform bar heights
        const newWaveform: number[] = []
        for (let i = 0; i < 16; i++) {
          const sample = dataArray[i % bufferLength] || 0
          const h = Math.max(3, Math.round((sample / 255) * 24))
          newWaveform.push(h)
        }
        setWaveformHeights(newWaveform)

        animFrameRef.current = requestAnimationFrame(tick)
      }

      tick()
    } catch (err) {
      console.warn('Web Audio Analyser error:', err)
      setIsMicAvailable(false)
    }

    return () => {
      isCancelled = true
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {})
      }
    }
  }, [stream])

  return {
    isMicAvailable,
    audioLevel,
    waveformHeights,
    statusText: isMicAvailable ? 'Microphone active (Browser sensor)' : 'Microphone unavailable',
  }
}
