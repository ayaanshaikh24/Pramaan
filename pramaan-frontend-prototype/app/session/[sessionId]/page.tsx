'use client'

import React, { use, useState } from 'react'
import { SharedSessionRoom } from '@/components/SharedSessionRoom'
import { Sidebar, ActiveView } from '@/components/Sidebar'
import Link from 'next/link'
import { Shield, Clock, FlaskConical, ShieldCheck } from 'lucide-react'

interface SessionPageProps {
  params: Promise<{
    sessionId: string
  }>
}

function EvidencePlaceholder({ sessionId }: { sessionId: string }) {
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-3 pb-4 border-b border-[var(--border-hairline)]">
        <Clock size={20} className="text-[var(--cobalt)]" />
        <div>
          <h2 className="text-lg font-semibold text-[var(--ink-black)]">Evidence Timeline</h2>
          <p className="text-sm text-[var(--text-muted)]">Session {sessionId} — audit trail and event log</p>
        </div>
      </div>
      <div className="paper-card p-8 text-center">
        <Clock size={32} className="text-[var(--text-muted)] mx-auto mb-3" />
        <p className="text-sm text-[var(--text-muted)]">Evidence timeline is part of the Live Interview Room.</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">Switch to Split View in the Live Interview Room to see the timeline alongside the candidate panel.</p>
        <Link href={`/session/${sessionId}`} className="btn-doc btn-doc-sm btn-subtle-cobalt mt-4 inline-flex">
          <span>Back to Live Interview Room</span>
        </Link>
      </div>
    </div>
  )
}

function DemoLabPlaceholder({ sessionId }: { sessionId: string }) {
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-3 pb-4 border-b border-[var(--border-hairline)]">
        <FlaskConical size={20} className="text-[var(--cobalt)]" />
        <div>
          <h2 className="text-lg font-semibold text-[var(--ink-black)]">Demo Lab</h2>
          <p className="text-sm text-[var(--text-muted)]">Simulated scenario testing</p>
        </div>
      </div>
      <div className="paper-card p-8 text-center">
        <FlaskConical size={32} className="text-[var(--text-muted)] mx-auto mb-3" />
        <p className="text-sm text-[var(--text-muted)]">Demo Lab scenarios are separate from the live session.</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">Demo Lab values do not overwrite the Live Interview Room state.</p>
      </div>
    </div>
  )
}

function PrivacyPlaceholder() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-3 pb-4 border-b border-[var(--border-hairline)]">
        <ShieldCheck size={20} className="text-[var(--cobalt)]" />
        <div>
          <h2 className="text-lg font-semibold text-[var(--ink-black)]">Privacy Controls</h2>
          <p className="text-sm text-[var(--text-muted)]">Data processing transparency</p>
        </div>
      </div>
      <div className="paper-card p-6">
        <div className="flex flex-col gap-3 text-sm text-[var(--text-primary)]">
          <p>All biometric analysis happens locally in the browser. No raw video, audio, or images are uploaded to any server.</p>
          <p>Only derived metadata (scores, boolean flags, event timestamps) is transmitted to the backend for integrity evaluation.</p>
          <div className="flex items-center gap-2 text-[11px] text-[var(--verified-green)] mt-2">
            <Shield size={12} />
            <span>Zero raw biometric data leaves your device.</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SessionPage({ params }: SessionPageProps) {
  const { sessionId } = use(params)
  const decodedSessionId = decodeURIComponent(sessionId)
  const [view, setView] = useState<ActiveView>('live')

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--surface-canvas)] font-sans antialiased text-[var(--ink-black)]">
      <Sidebar currentView={view} onViewChange={setView} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="institutional-header">
          <div className="header-meta-group">
            <span className="header-title-badge">
              PRAMAAN / Live Interview Room
            </span>

            <span className="meta-dot-divider">•</span>

            <span>
              Session <strong className="font-mono text-[var(--ink-black)]">{decodedSessionId}</strong>
            </span>

            <span className="meta-dot-divider">•</span>

            <span className="text-[var(--text-muted)]">
              Candidate <strong className="text-[var(--ink-black)]">#CX0104</strong> · Junior Frontend Engineer
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--verified-bg)] border border-[rgba(25,135,84,0.2)] text-[11px] text-[var(--verified-green)] font-medium">
              <span className="w-2 h-2 rounded-full bg-[var(--verified-green)] animate-pulse" />
              <span>Single shared state</span>
            </div>

            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <Shield size={12} className="text-[var(--verified-green)]" />
              <span>Candidate & Recruiter — one room</span>
            </div>
          </div>
        </header>

        <main className="workspace-content overflow-y-auto p-4">
          {view === 'live' && (
            <div className="max-w-7xl mx-auto flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border-hairline)]">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-[var(--cobalt)]">
                    {decodedSessionId}
                  </span>
                  <span className="scenario-badge normal text-[10px]">
                    Live Interview Room
                  </span>
                </div>
              </div>
              <SharedSessionRoom sessionId={decodedSessionId} />
            </div>
          )}

          {view === 'evidence' && <EvidencePlaceholder sessionId={decodedSessionId} />}
          {view === 'lab' && <DemoLabPlaceholder sessionId={decodedSessionId} />}
          {view === 'privacy' && <PrivacyPlaceholder />}
        </main>
      </div>
    </div>
  )
}
