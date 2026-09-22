'use client'

import React from 'react'
import { Play, Pause, SkipForward, SkipBack, X, Sparkles, CheckCircle2, Clock } from 'lucide-react'

export interface GuidedDemoPanelProps {
  currentStep: number // 1 to 5
  isAutoRunning: boolean
  elapsedSeconds: number // 0 to 35
  onSelectStep: (step: number) => void
  onToggleAutoRun: () => void
  onSkipNext: () => void
  onSkipPrev: () => void
  onClose: () => void
}

const STEPS = [
  { id: 1, label: 'Normal candidate' },
  { id: 2, label: 'Random challenge' },
  { id: 3, label: 'Simulated proxy' },
  { id: 4, label: 'Low bandwidth fairness' },
  { id: 5, label: 'Generate evidence report' },
]

export function GuidedDemoPanel({
  currentStep,
  isAutoRunning,
  elapsedSeconds,
  onSelectStep,
  onToggleAutoRun,
  onSkipNext,
  onSkipPrev,
  onClose,
}: GuidedDemoPanelProps) {
  const formatTime = (secs: number) => {
    const s = Math.min(Math.max(secs, 0), 35)
    return `00:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="guided-demo-panel">
      {/* Left: Mode Title & Quick Info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#0B1224] text-white text-[11px] font-mono font-bold tracking-wide">
          <Sparkles size={12} className="text-[#25E0FF]" />
          <span>GUIDED DEMO MODE</span>
        </div>
        <span className="text-xs text-[var(--text-muted)] hidden md:inline">
          90-Second Presentation Flow
        </span>
      </div>

      {/* Center: Step Navigation Buttons */}
      <div className="guided-steps-list">
        {STEPS.map((step) => {
          const isActive = currentStep === step.id
          const isCompleted = currentStep > step.id
          return (
            <button
              key={step.id}
              type="button"
              className={`guided-step-btn ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
              onClick={() => onSelectStep(step.id)}
              title={`Jump to Step ${step.id}: ${step.label}`}
            >
              <span className="guided-step-number">
                {isCompleted ? <CheckCircle2 size={10} /> : step.id}
              </span>
              <span>{step.label}</span>
            </button>
          )
        })}
      </div>

      {/* Right: Automated Flow Controls & Close */}
      <div className="flex items-center gap-2">
        {/* Play / Pause One-Click Demo Button */}
        <button
          type="button"
          className={`btn-doc btn-doc-sm flex items-center gap-1.5 ${
            isAutoRunning ? 'btn-subtle-cobalt font-semibold' : 'bg-[#0B1224] text-white hover:bg-[#101A35]'
          }`}
          onClick={onToggleAutoRun}
          title={isAutoRunning ? 'Pause automated presentation flow' : 'Run 35-second automated sequence'}
        >
          {isAutoRunning ? <Pause size={12} /> : <Play size={12} />}
          <span>{isAutoRunning ? 'Pause demo' : 'Run full demo'}</span>
        </button>

        {/* Step Navigation Controls (Active during presentation) */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="btn-doc btn-doc-sm px-2"
            onClick={onSkipPrev}
            disabled={currentStep <= 1}
            title="Previous step"
          >
            <SkipBack size={12} />
          </button>

          {/* Time Counter during Auto-run */}
          {isAutoRunning && (
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[11px] font-mono text-[var(--ink-black)]">
              <Clock size={11} className="text-[var(--cobalt)]" />
              <span>{formatTime(elapsedSeconds)}</span>
              <span className="text-[var(--text-muted)]">/ 00:35</span>
            </div>
          )}

          <button
            type="button"
            className="btn-doc btn-doc-sm px-2"
            onClick={onSkipNext}
            disabled={currentStep >= 5}
            title="Skip to next step"
          >
            <SkipForward size={12} />
          </button>
        </div>

        {/* Close Guided Mode Button */}
        <button
          type="button"
          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--ink-black)] hover:bg-[var(--surface-subtle)] ml-1"
          onClick={onClose}
          title="Exit Guided Demo Mode"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
