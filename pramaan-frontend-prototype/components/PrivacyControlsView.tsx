'use client'

import React from 'react'
import {
  Shield,
  ServerOff,
  Cpu,
  UserCheck,
  Lock,
} from 'lucide-react'

export function PrivacyControlsView() {
  const privacySpecs = [
    {
      title: 'Browser-side processing',
      status: 'ACTIVE',
      statusColor: 'var(--verified-green)',
      statusBg: 'var(--verified-bg)',
      icon: Cpu,
      desc: 'All signal feature extraction and temporal alignment checks execute locally inside the candidate’s browser.',
    },
    {
      title: 'Raw video storage',
      status: 'NONE',
      statusColor: 'var(--verified-green)',
      statusBg: 'var(--verified-bg)',
      icon: ServerOff,
      desc: 'Zero video or audio frames are recorded or transmitted to centralized cloud servers. Only in-memory signal hashes exist during the session.',
    },
    {
      title: 'Human review',
      status: 'REQUIRED',
      statusColor: 'var(--cobalt)',
      statusBg: 'var(--cobalt-subtle)',
      icon: UserCheck,
      desc: 'PRAMAAN never automates hiring or rejection decisions. The system provides explainable decision-support signals for human recruiters.',
    },
    {
      title: 'Local session signals',
      status: 'ACTIVE',
      statusColor: 'var(--verified-green)',
      statusBg: 'var(--verified-bg)',
      icon: Lock,
      desc: 'Temporary in-memory biometric landmark vectors are discarded immediately when the session ends or the browser tab is closed.',
    },
  ]

  return (
    <div className="flex flex-col gap-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="paper-card p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--ink-black)]">
            <Shield size={16} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[var(--ink-black)]">Privacy controls & policy</h1>
            <p className="text-xs text-[var(--text-muted)]">
              Privacy controls configured • Local client-side processing boundaries.
            </p>
          </div>
        </div>

        <span className="text-[11px] font-mono font-medium text-[var(--verified-green)] bg-[var(--verified-bg)] border border-[rgba(25,135,84,0.3)] px-2.5 py-0.5 rounded">
          Local boundaries active
        </span>
      </div>

      {/* Clean policy rows */}
      <div className="flex flex-col gap-2.5">
        {privacySpecs.map((spec) => {
          const Icon = spec.icon
          return (
            <div key={spec.title} className="policy-row-card">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--text-muted)] mt-0.5">
                  <Icon size={14} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--ink-black)]">{spec.title}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5 max-w-xl leading-relaxed">
                    {spec.desc}
                  </div>
                </div>
              </div>

              <span
                className="text-xs font-mono font-bold px-2.5 py-1 rounded"
                style={{
                  color: spec.statusColor,
                  background: spec.statusBg,
                  border: `1px solid ${spec.statusColor}`,
                }}
              >
                {spec.status}
              </span>
            </div>
          )
        })}
      </div>

      {/* Policy Explanation Note */}
      <div className="paper-card p-4 bg-[var(--surface-subtle)] flex flex-col gap-2">
        <span className="paper-section-title">Candidate privacy note</span>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Interview integrity tooling must preserve candidate dignity. PRAMAAN isolates all signal processing to the local browser session, ensuring candidates are never added to external biometric databases or evaluated by black-box algorithms.
        </p>
      </div>
    </div>
  )
}
