'use client'

import React from 'react'
import { Zap, Clock, CheckCircle2, AlertCircle, X } from 'lucide-react'

export interface ChallengeBannerProps {
  isOpen: boolean
  prompt?: string
  status: 'waiting' | 'recorded' | 'passed'
  secondsLeft: number
  onPass: () => void
  onPartial: () => void
  onDismiss: () => void
}

export function ChallengeBanner({
  isOpen,
  prompt = 'Turn your head slightly to the right and say BLUE 47',
  status,
  secondsLeft,
  onPass,
  onPartial,
  onDismiss,
}: ChallengeBannerProps) {
  if (!isOpen) return null

  return (
    <div className="full-challenge-banner" role="region" aria-label="Live Integrity Challenge">
      {/* Left Column: Challenge Identification & Prompt */}
      <div className="flex flex-col gap-1 max-w-2xl">
        <div className="flex items-center gap-2">
          <span className="challenge-badge-live">
            <Zap size={10} className="animate-pulse" />
            LIVE VERIFICATION CHALLENGE
          </span>
          <span className="text-[11px] font-mono text-[#A6AAA7]">Target: Candidate #CX0104</span>
        </div>

        <div className="challenge-prompt-headline">
          Instruction:{' '}
          <span className="challenge-prompt-quote">
            “{prompt}”
          </span>
        </div>
        <div className="text-[11px] text-[#C0C4C1]">
          Evaluating synchronized facial motion, speech formant alignment, and 20-second latency window.
        </div>
      </div>

      {/* Right Column: Timer, Phase Pill, Action Buttons */}
      <div className="challenge-controls-cluster">
        {/* Countdown Timer Chip */}
        <div className="challenge-timer-chip">
          <Clock size={13} className="text-[#FFB020]" />
          <span>{secondsLeft}s left</span>
        </div>

        {/* Phase Pill Status */}
        <div className={`challenge-status-pill ${status}`}>
          {status === 'waiting' && (
            <>
              <span className="w-2 h-2 rounded-full bg-[#FFB020] animate-pulse" />
              <span>Waiting for response</span>
            </>
          )}
          {status === 'recorded' && (
            <>
              <span className="w-2 h-2 rounded-full bg-[#25E0FF]" />
              <span>Response recorded</span>
            </>
          )}
          {status === 'passed' && (
            <>
              <CheckCircle2 size={13} className="text-[#56E39F]" />
              <span>Passed</span>
            </>
          )}
        </div>

        {/* Evaluation Controls */}
        <div className="flex items-center gap-1.5 border-l border-white/10 pl-3">
          <button
            type="button"
            className="btn-doc btn-doc-sm text-[11px] font-semibold bg-[rgba(25,135,84,0.3)] text-[#56E39F] border border-[rgba(86,227,159,0.4)] hover:bg-[rgba(25,135,84,0.5)]"
            onClick={onPass}
            title="Mark challenge verified (Passed)"
          >
            <CheckCircle2 size={11} />
            <span>Pass</span>
          </button>

          <button
            type="button"
            className="btn-doc btn-doc-sm text-[11px] font-semibold bg-[rgba(255,157,77,0.2)] text-[#FFB020] border border-[rgba(255,176,32,0.4)] hover:bg-[rgba(255,157,77,0.3)]"
            onClick={onPartial}
            title="Mark challenge as delayed or incomplete (Partial)"
          >
            <AlertCircle size={11} />
            <span>Partial</span>
          </button>

          <button
            type="button"
            className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10"
            onClick={onDismiss}
            title="Dismiss banner"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
