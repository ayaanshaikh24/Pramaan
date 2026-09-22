'use client'

import React from 'react'
import { CheckCircle2, AlertTriangle, WifiOff, Download, RotateCcw, ArrowRight, ShieldCheck, X } from 'lucide-react'
import { CANDIDATE_DETAILS } from '@/lib/scenarios'

export interface DemoSummaryModalProps {
  isOpen: boolean
  onExportReport: () => void
  onRunAgain: () => void
  onClose: () => void
}

export function DemoSummaryModal({
  isOpen,
  onExportReport,
  onRunAgain,
  onClose,
}: DemoSummaryModalProps) {
  if (!isOpen) return null

  return (
    <div className="demo-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="summary-title">
      <div className="demo-modal-card">
        {/* Modal Header */}
        <div className="demo-modal-header">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-[#25E0FF]" />
            <div>
              <h2 id="summary-title" className="text-sm font-bold text-white uppercase tracking-wider">
                Session Review Complete
              </h2>
              <span className="text-[11px] text-[#A6AAA7]">
                PRAMAAN Guided Demonstration Summary • {CANDIDATE_DETAILS.id}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="demo-modal-body">
          <p className="text-xs text-[var(--text-primary)] leading-relaxed">
            PRAMAAN evaluated live interaction signals across face motion coherence, voice-lip synchronization,
            active challenge compliance, and network stream context.
          </p>

          {/* 3 Pillars Summary Grid */}
          <div className="review-summary-grid">
            {/* Pillar 1: Normal Interaction */}
            <div className="review-summary-box border-[rgba(25,135,84,0.3)] bg-[rgba(25,135,84,0.06)]">
              <div className="flex items-center justify-center gap-1 text-[var(--verified-green)] mb-1">
                <CheckCircle2 size={15} />
              </div>
              <div className="box-label text-[var(--ink-black)]">Normal interaction</div>
              <div className="box-status text-[var(--verified-green)]">Consistent</div>
              <div className="text-[10px] text-[var(--text-muted)] mt-1">
                Risk 12/100 • High confidence
              </div>
            </div>

            {/* Pillar 2: Proxy Simulation */}
            <div className="review-summary-box border-[rgba(220,53,69,0.3)] bg-[rgba(220,53,69,0.06)]">
              <div className="flex items-center justify-center gap-1 text-[var(--concern-coral)] mb-1">
                <AlertTriangle size={15} />
              </div>
              <div className="box-label text-[var(--ink-black)]">Proxy simulation</div>
              <div className="box-status text-[var(--concern-coral)]">Review recommended</div>
              <div className="text-[10px] text-[var(--text-muted)] mt-1">
                Multimodal divergence anomaly
              </div>
            </div>

            {/* Pillar 3: Low Bandwidth Fairness */}
            <div className="review-summary-box border-[rgba(255,157,77,0.3)] bg-[rgba(255,157,77,0.06)]">
              <div className="flex items-center justify-center gap-1 text-[var(--review-amber)] mb-1">
                <WifiOff size={15} />
              </div>
              <div className="box-label text-[var(--ink-black)]">Low bandwidth</div>
              <div className="box-status text-[var(--review-amber)]">Insufficient evidence</div>
              <div className="text-[10px] text-[var(--text-muted)] mt-1">
                Fairness invariant applied
              </div>
            </div>
          </div>

          {/* Final Principle Callout */}
          <div className="principle-callout">
            <span className="text-xs uppercase font-mono tracking-wider text-[var(--cobalt)] font-bold block mb-1">
              Core Algorithmic Fairness Principle
            </span>
            <div className="text-sm font-semibold text-[var(--ink-black)]">
              “Poor internet is not proof of dishonesty.”
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              Degraded network conditions lower decision confidence without falsely accusing candidates of fraud.
            </div>
          </div>
        </div>

        {/* Modal Footer with Actions */}
        <div className="demo-modal-footer">
          <button
            type="button"
            className="btn-doc btn-doc-sm flex items-center gap-1.5"
            onClick={onRunAgain}
            title="Restart automated demo"
          >
            <RotateCcw size={12} />
            <span>Run demo again</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-doc btn-subtle-cobalt btn-doc-sm flex items-center gap-1.5 font-semibold"
              onClick={onExportReport}
              title="Download official forensic JSON evidence log"
            >
              <Download size={12} />
              <span>Export evidence report</span>
            </button>

            <button
              type="button"
              className="btn-doc btn-doc-sm bg-[#0B1224] text-white hover:bg-[#101A35] flex items-center gap-1.5"
              onClick={onClose}
              title="Return to the live recruiter console"
            >
              <span>Return to live session</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
