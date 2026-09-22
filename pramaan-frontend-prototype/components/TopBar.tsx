'use client'

import React from 'react'
import { Download, Zap, Sparkles } from 'lucide-react'
import { CANDIDATE_DETAILS } from '@/lib/scenarios'
import { Scenario, ScenarioData } from '@/types/pramaan'

interface TopBarProps {
  currentView: 'live' | 'candidate' | 'evidence' | 'lab' | 'privacy'
  scenario: Scenario
  data: ScenarioData
  isLowQualityMode: boolean
  backendConnected?: boolean
  isGuidedDemoOpen?: boolean
  onToggleGuidedDemo?: () => void
  onRequestVerification: () => void
  onExportReport: () => void
}

export function TopBar({
  currentView,
  scenario,
  data,
  isLowQualityMode,
  backendConnected = false,
  isGuidedDemoOpen = false,
  onToggleGuidedDemo,
  onRequestVerification,
  onExportReport,
}: TopBarProps) {
  const getViewTitle = () => {
    switch (currentView) {
      case 'live':
        return 'Live session'
      case 'candidate':
        return 'Candidate view'
      case 'evidence':
        return 'Evidence timeline'
      case 'lab':
        return 'Demo lab'
      case 'privacy':
        return 'Privacy controls'
      default:
        return 'Console'
    }
  }

  const isDegraded = isLowQualityMode || data.quality === 'Poor'

  return (
    <header className="institutional-header">
      <div className="header-meta-group">
        <span className="header-title-badge">
          PRAMAAN / {getViewTitle()}
        </span>

        <span className="meta-dot-divider">•</span>

        <span>
          Session <strong className="font-mono text-[var(--ink-black)]">{CANDIDATE_DETAILS.id}</strong>
        </span>

        <span className="meta-dot-divider">•</span>

        <span>
          <strong className="text-[var(--ink-black)]">{CANDIDATE_DETAILS.name}</strong>
        </span>

        <span className="meta-dot-divider">•</span>

        <span>{CANDIDATE_DETAILS.stage}</span>

        <span className="meta-dot-divider">•</span>

        <span className="font-mono text-[var(--ink-black)]">{CANDIDATE_DETAILS.duration}</span>

        <span className="meta-dot-divider">•</span>

        <span
          style={{
            color: isDegraded ? 'var(--review-amber)' : 'var(--verified-green)',
            fontWeight: 500,
          }}
        >
          {isDegraded ? 'Connection degraded' : 'Connection stable'}
        </span>

        <span
          className="text-[11px] font-mono flex items-center gap-1.5"
          style={{ color: backendConnected ? 'var(--verified-green)' : 'var(--text-muted)' }}
          title={backendConnected ? 'Connected to Node.js / Express backend with Socket.IO' : 'Operating in offline frontend demo mode'}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: backendConnected ? 'var(--verified-green)' : 'var(--border-strong)' }}
          />
          <span>{backendConnected ? 'Backend active' : 'Offline frontend demo mode'}</span>
        </span>

        <span className="meta-dot-divider">•</span>

        {/* Presentation Scenario Badge */}
        <span
          className={`scenario-badge ${scenario}`}
          title="Active Demo Scenario"
        >
          DEMO SCENARIO: {scenario === 'low-bandwidth' ? 'LOW BANDWIDTH' : scenario.toUpperCase()}
        </span>
      </div>

      <div className="header-actions-group">
        {currentView === 'live' && onToggleGuidedDemo && (
          <button
            type="button"
            className={`btn-doc btn-doc-sm flex items-center gap-1.5 ${
              isGuidedDemoOpen ? 'bg-[#0B1224] text-white font-semibold' : 'btn-subtle-cobalt font-semibold'
            }`}
            onClick={onToggleGuidedDemo}
            title="Open 90-second Guided Demo Panel"
          >
            <Sparkles size={12} className={isGuidedDemoOpen ? 'text-[#25E0FF]' : 'text-[var(--cobalt)]'} />
            <span>{isGuidedDemoOpen ? 'Guided demo active' : 'Start guided demo'}</span>
          </button>
        )}

        {currentView === 'live' && (
          <button
            type="button"
            className="btn-doc btn-subtle-cobalt btn-doc-sm"
            onClick={onRequestVerification}
            title="Dispatch immediate live challenge to candidate"
          >
            <Zap size={12} />
            <span>Request challenge</span>
          </button>
        )}

        <button
          type="button"
          className="btn-doc btn-doc-sm"
          onClick={onExportReport}
          title="Download full forensic JSON evidence log"
        >
          <Download size={12} />
          <span>Export report</span>
        </button>
      </div>
    </header>
  )
}
