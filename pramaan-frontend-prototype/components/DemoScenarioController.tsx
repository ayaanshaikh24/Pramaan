'use client'

import React from 'react'
import { Scenario } from '@/types/pramaan'
import { RotateCcw, ShieldCheck, AlertTriangle, Wifi, CheckCircle2 } from 'lucide-react'

interface DemoScenarioControllerProps {
  currentScenario: Scenario
  onSelectScenario: (scenario: Scenario) => void
}

export function DemoScenarioController({
  currentScenario,
  onSelectScenario,
}: DemoScenarioControllerProps) {
  return (
    <div className="panel scenario-panel" id="demo-scenario-panel">
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="eyebrow">DETERMINISTIC EVALUATION</span>
          <h2 className="panel-title">Demo Scenario</h2>
        </div>
        <span className="pill pill-cyan text-[10px]">
          <RotateCcw size={10} className="animate-spin-slow" /> Instant Update
        </span>
      </div>

      <p className="text-xs leading-relaxed text-muted mb-4">
        Toggle instantly between deterministic simulated interview states. Immediately synchronizes
        risk gauge, 4 signal cards, live challenge state, explanation, and timeline.
      </p>

      <div className="scenario-buttons-stack">
        {/* NORMAL SCENARIO */}
        <button
          type="button"
          id="btn-scenario-normal"
          className={`scenario-btn ${currentScenario === 'normal' ? 'selected' : ''}`}
          onClick={() => onSelectScenario('normal')}
        >
          <span className="scenario-dot green" />
          <div className="scenario-btn-text">
            <div className="flex items-center gap-2">
              <strong className="scenario-title">NORMAL</strong>
              <span className="text-[10px] text-[#56E39F] font-mono font-medium">Low Risk</span>
            </div>
            <p className="scenario-desc">
              Face: 94 • Voice: 96 • Challenge: Passed • Stream: 92
            </p>
          </div>
          <div className="scenario-score-badge text-[#56E39F]">
            12
          </div>
        </button>

        {/* PROXY / FACE-SWAP SCENARIO */}
        <button
          type="button"
          id="btn-scenario-proxy"
          className={`scenario-btn ${currentScenario === 'proxy' ? 'selected' : ''}`}
          onClick={() => onSelectScenario('proxy')}
        >
          <span className="scenario-dot pink" />
          <div className="scenario-btn-text">
            <div className="flex items-center gap-2">
              <strong className="scenario-title">PROXY / FACE-SWAP</strong>
              <span className="text-[10px] text-[#FF6F91] font-mono font-medium">Review Recommended</span>
            </div>
            <p className="scenario-desc">
              Face: 54 • Voice: 38 • Challenge: Partial • Stream: 84
            </p>
          </div>
          <div className="scenario-score-badge text-[#FF6F91]">
            78
          </div>
        </button>

        {/* LOW BANDWIDTH SCENARIO */}
        <button
          type="button"
          id="btn-scenario-low-bandwidth"
          className={`scenario-btn ${currentScenario === 'low-bandwidth' ? 'selected' : ''}`}
          onClick={() => onSelectScenario('low-bandwidth')}
        >
          <span className="scenario-dot orange" />
          <div className="scenario-btn-text">
            <div className="flex items-center gap-2">
              <strong className="scenario-title">LOW BANDWIDTH</strong>
              <span className="text-[10px] text-[#FF9D4D] font-mono font-medium">Insufficient Evidence</span>
            </div>
            <p className="scenario-desc">
              Face: Low conf • Voice: 86 • Challenge: Passed • Stream: 24
            </p>
          </div>
          <div className="scenario-score-badge text-[#FF9D4D]">
            32
          </div>
        </button>
      </div>

      {/* Fairness & Ethics Guarantee Callout */}
      <div className="fairness-callout mt-4">
        <Wifi size={16} className="text-[#FFD45E] flex-shrink-0" />
        <span className="text-[11px] text-[#FFD45E] leading-tight">
          <strong>Ethical Fallback:</strong> Visual evidence degradation lowers algorithmic confidence. It does not generate fraud accusations or automated rejection.
        </span>
      </div>
    </div>
  )
}
