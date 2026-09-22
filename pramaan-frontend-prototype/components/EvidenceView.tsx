'use client'

import React, { useState } from 'react'
import {
  Download,
  Filter,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Info,
  FileSpreadsheet,
} from 'lucide-react'
import { TimelineEvent, EventType, ScenarioData } from '@/types/pramaan'
import { CANDIDATE_DETAILS } from '@/lib/scenarios'

interface EvidenceViewProps {
  events: TimelineEvent[]
  data: ScenarioData
  onExportReport: () => void
}

export function EvidenceView({ events, data, onExportReport }: EvidenceViewProps) {
  const [filterType, setFilterType] = useState<'all' | 'warning' | 'normal' | 'info'>('all')

  const filteredEvents = events.filter((evt) => {
    if (filterType === 'all') return true
    if (filterType === 'warning') return evt.type === 'warning' || evt.type === 'critical'
    return evt.type === filterType
  })

  const getSeverityBadge = (type: EventType) => {
    switch (type) {
      case 'critical':
        return (
          <span className="text-[10px] font-mono text-[var(--concern-coral)] bg-[var(--concern-bg)] px-2 py-0.5 rounded border border-[rgba(217,83,79,0.3)]">
            CRITICAL
          </span>
        )
      case 'warning':
        return (
          <span className="text-[10px] font-mono text-[var(--review-amber)] bg-[var(--review-bg)] px-2 py-0.5 rounded border border-[rgba(217,139,33,0.3)]">
            WARNING
          </span>
        )
      case 'normal':
        return (
          <span className="text-[10px] font-mono text-[var(--verified-green)] bg-[var(--verified-bg)] px-2 py-0.5 rounded border border-[rgba(25,135,84,0.3)]">
            VERIFIED
          </span>
        )
      case 'info':
        return (
          <span className="text-[10px] font-mono text-[var(--cobalt)] bg-[var(--cobalt-subtle)] px-2 py-0.5 rounded border border-[rgba(49,91,255,0.25)]">
            SYSTEM
          </span>
        )
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-5xl mx-auto">
      {/* Evidence Overview Header */}
      <div className="paper-card p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--ink-black)]">
            <FileSpreadsheet size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-[var(--ink-black)]">Forensic evidence timeline</h1>
              <span className="text-xs font-mono text-[var(--text-muted)] bg-[var(--surface-subtle)] border border-[var(--border-hairline)] px-2 py-0.5 rounded">
                Session {CANDIDATE_DETAILS.id}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Incident review log generated from client-side multimodal integrity checks.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn-doc btn-subtle-cobalt btn-doc-sm"
          onClick={onExportReport}
        >
          <Download size={12} />
          <span>Export report (JSON)</span>
        </button>
      </div>

      {/* Summary KPI Ribbon */}
      <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
        <div className="paper-card p-3 flex flex-col gap-1">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
            Logged events
          </span>
          <span className="text-lg font-bold font-mono text-[var(--ink-black)]">{events.length}</span>
        </div>

        <div className="paper-card p-3 flex flex-col gap-1">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
            Integrity status
          </span>
          <span className="text-lg font-bold text-[var(--ink-black)]">{data.status}</span>
        </div>

        <div className="paper-card p-3 flex flex-col gap-1">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
            Confidence
          </span>
          <span className="text-lg font-bold text-[var(--ink-black)]">{data.confidence}</span>
        </div>

        <div className="paper-card p-3 flex flex-col gap-1">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
            Challenge result
          </span>
          <span className="text-lg font-bold capitalize text-[var(--ink-black)] font-mono">
            {data.challenge}
          </span>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="paper-card overflow-hidden">
        <div className="paper-card-header">
          <div className="flex items-center gap-2">
            <span className="paper-section-title">Incident report</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={`btn-doc btn-doc-sm ${filterType === 'all' ? 'btn-primary-cobalt' : ''}`}
                onClick={() => setFilterType('all')}
              >
                All ({events.length})
              </button>
              <button
                type="button"
                className={`btn-doc btn-doc-sm ${filterType === 'warning' ? 'btn-primary-cobalt' : ''}`}
                onClick={() => setFilterType('warning')}
              >
                Anomalies ({events.filter((e) => e.type === 'warning' || e.type === 'critical').length})
              </button>
              <button
                type="button"
                className={`btn-doc btn-doc-sm ${filterType === 'normal' ? 'btn-primary-cobalt' : ''}`}
                onClick={() => setFilterType('normal')}
              >
                Verified ({events.filter((e) => e.type === 'normal').length})
              </button>
              <button
                type="button"
                className={`btn-doc btn-doc-sm ${filterType === 'info' ? 'btn-primary-cobalt' : ''}`}
                onClick={() => setFilterType('info')}
              >
                System ({events.filter((e) => e.type === 'info').length})
              </button>
            </div>
          </div>

          <span className="text-xs text-[var(--text-muted)] font-mono">
            Showing {filteredEvents.length} items
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="evidence-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>Timestamp</th>
                <th style={{ width: '100px' }}>Severity</th>
                <th style={{ width: '220px' }}>Event title</th>
                <th>Evidence description</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((evt, i) => (
                <tr key={`${evt.time}-${i}`}>
                  <td className="font-mono text-xs text-[var(--text-muted)]">{evt.time}</td>
                  <td>{getSeverityBadge(evt.type)}</td>
                  <td>
                    <div className="font-semibold text-[var(--ink-black)]">
                      {evt.title}
                    </div>
                  </td>
                  <td className="text-xs text-[var(--text-muted)]">{evt.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
