'use client'

import React from 'react'
import {
  FlaskConical,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react'
import { Scenario } from '@/types/pramaan'

interface DemoLabViewProps {
  currentScenario: Scenario
  onSelectScenario: (sc: Scenario) => void
  onToggleLowQuality: (val: boolean) => void
  isLowQualityMode: boolean
  onGoToLive: () => void
}

export function DemoLabView({
  currentScenario,
  onSelectScenario,
  onToggleLowQuality,
  isLowQualityMode,
  onGoToLive,
}: DemoLabViewProps) {
  const scenarioList = [
    {
      id: 'normal' as Scenario,
      title: 'Normal Session',
      risk: 12,
      status: 'Low Risk',
      confidence: 'High',
      desc: 'Typical authentic candidate interview with continuous facial micro-motion and synchronized audio.',
      signals: [
        { label: 'Face + Motion', val: '94 / 100', color: 'var(--verified-green)' },
        { label: 'Voice + Lip Sync', val: '96 / 100', color: 'var(--verified-green)' },
        { label: 'Live Challenge', val: 'Passed', color: 'var(--verified-green)' },
        { label: 'Stream Context', val: '92 / 100', color: 'var(--verified-green)' },
      ],
      badgeColor: 'var(--verified-green)',
      badgeBg: 'var(--verified-bg)',
    },
    {
      id: 'proxy' as Scenario,
      title: 'Simulated Proxy / Face-Swap',
      risk: 78,
      status: 'Review Recommended',
      confidence: 'Medium',
      desc: 'Simulates video stream or speech-timing divergence. Flags review with specific evidence observations.',
      signals: [
        { label: 'Face + Motion', val: '54 / 100', color: 'var(--review-amber)' },
        { label: 'Voice + Lip Sync', val: '38 / 100', color: 'var(--concern-coral)' },
        { label: 'Live Challenge', val: 'Partial', color: 'var(--review-amber)' },
        { label: 'Stream Context', val: '84 / 100', color: 'var(--verified-green)' },
      ],
      evidence: [
        'Lip-sync timing inconsistency detected',
        'Reduced natural motion across facial landmarks',
        'Live challenge only partially completed',
      ],
      badgeColor: 'var(--concern-coral)',
      badgeBg: 'var(--concern-bg)',
    },
    {
      id: 'low-bandwidth' as Scenario,
      title: 'Low Bandwidth',
      risk: 32,
      status: 'Insufficient Evidence',
      confidence: 'Low',
      desc: 'Simulates degraded connection (frame drops & 480p). Demonstrates safeguards that prevent network issues from being treated as fraud.',
      signals: [
        { label: 'Face + Motion', val: 'Low confidence', color: 'var(--review-amber)' },
        { label: 'Voice + Lip Sync', val: '86 / 100', color: 'var(--verified-green)' },
        { label: 'Live Challenge', val: 'Passed', color: 'var(--verified-green)' },
        { label: 'Stream Context', val: '24 / 100', color: 'var(--concern-coral)' },
      ],
      fairnessNotice: 'Poor video quality lowers confidence. It does not prove dishonesty.',
      badgeColor: 'var(--review-amber)',
      badgeBg: 'var(--review-bg)',
    },
  ]

  return (
    <div className="flex flex-col gap-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="paper-card p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--ink-black)]">
            <FlaskConical size={16} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[var(--ink-black)]">Scenario lab</h1>
            <p className="text-xs text-[var(--text-muted)]">
              Internal testing tool to evaluate signal behavior and fairness under simulated interview conditions.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn-doc btn-primary-cobalt btn-doc-sm"
          onClick={onGoToLive}
        >
          <span>Return to live session</span>
          <ArrowRight size={12} />
        </button>
      </div>

      {/* 3 Scenario Cards */}
      <div className="lab-cards-grid">
        {scenarioList.map((item) => {
          const isSelected = currentScenario === item.id
          return (
            <div
              key={item.id}
              className={`scenario-tab-card ${isSelected ? 'active' : ''}`}
              onClick={() => onSelectScenario(item.id)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-bold text-[var(--ink-black)]">{item.title}</h2>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold font-mono" style={{ color: item.badgeColor }}>
                      {item.risk}
                    </span>
                    <span className="text-xs font-mono text-[var(--text-muted)]">/ 100</span>
                  </div>
                </div>

                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                  style={{
                    color: item.badgeColor,
                    background: item.badgeBg,
                    border: `1px solid ${item.badgeColor}`,
                  }}
                >
                  {item.status}
                </span>
              </div>

              <p className="text-xs text-[var(--text-muted)] leading-relaxed">{item.desc}</p>

              {/* Signals Preview */}
              <div className="flex flex-col gap-1.5 p-2.5 bg-[var(--surface-subtle)] rounded border border-[var(--border-hairline)]">
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                  Local session signals:
                </span>
                {item.signals.map((sig) => (
                  <div key={sig.label} className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-muted)]">{sig.label}</span>
                    <span className="font-mono text-[11px]" style={{ color: sig.color }}>
                      {sig.val}
                    </span>
                  </div>
                ))}
              </div>

              {/* Anomaly list if present */}
              {item.evidence && (
                <div className="p-2.5 bg-[var(--concern-bg)] border border-[rgba(217,83,79,0.25)] rounded text-[11px] text-[var(--concern-coral)] flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase">
                    Observed discrepancies:
                  </span>
                  {item.evidence.map((ev, i) => (
                    <span key={i} className="flex items-center gap-1.5 text-[var(--ink-black)]">
                      <span className="w-1 h-1 rounded-full bg-[var(--concern-coral)]" />
                      {ev}
                    </span>
                  ))}
                </div>
              )}

              {/* Fairness message if present */}
              {item.fairnessNotice && (
                <div className="p-2.5 bg-[var(--review-bg)] border border-[rgba(217,139,33,0.35)] rounded text-[11px] text-[#945B0A] flex items-center gap-2">
                  <AlertTriangle size={13} className="flex-shrink-0 text-[var(--review-amber)]" />
                  <span>{item.fairnessNotice}</span>
                </div>
              )}

              <button
                type="button"
                className={`btn-doc btn-doc-sm w-full mt-auto ${isSelected ? 'btn-primary-cobalt' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectScenario(item.id)
                }}
              >
                {isSelected ? 'Currently active' : 'Activate scenario'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Interactive Controls & Stress Testing Panel */}
      <div className="paper-card p-4 flex flex-col gap-3">
        <span className="paper-section-title">Testing environment controls</span>
        <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
          <div className="p-3 bg-[var(--surface-subtle)] rounded border border-[var(--border-hairline)] flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-[var(--ink-black)]">
                Bandwidth degradation filter
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">
                Drops resolution to 480p and introduces artificial frame jitter
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer">
              <input
                type="checkbox"
                checked={isLowQualityMode}
                onChange={(e) => onToggleLowQuality(e.target.checked)}
                className="cursor-pointer"
              />
              <span className="font-mono text-[var(--ink-black)]">
                {isLowQualityMode ? 'ACTIVE' : 'OFF'}
              </span>
            </label>
          </div>

          <div className="p-3 bg-[var(--surface-subtle)] rounded border border-[var(--border-hairline)] flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-[var(--ink-black)]">
                Signal analysis runtime
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">
                Deterministic local session simulation
              </div>
            </div>
            <span className="text-xs font-mono text-[var(--verified-green)] bg-[var(--verified-bg)] px-2 py-0.5 rounded border border-[rgba(25,135,84,0.2)]">
              ONLINE
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
