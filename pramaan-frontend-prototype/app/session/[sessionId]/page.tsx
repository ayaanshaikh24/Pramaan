'use client'

import React, { use } from 'react'
import { SharedSessionRoom } from '@/components/SharedSessionRoom'
import { Sidebar, ActiveView } from '@/components/Sidebar'
import Link from 'next/link'
import { ArrowLeft, Shield } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface SessionPageProps {
  params: Promise<{
    sessionId: string
  }>
}

export default function SessionPage({ params }: SessionPageProps) {
  const { sessionId } = use(params)
  const decodedSessionId = decodeURIComponent(sessionId)
  const router = useRouter()

  const handleViewChange = (view: ActiveView) => {
    if (view === 'live') return
    router.push(`/?view=${view}`)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--surface-canvas)] font-sans antialiased text-[var(--ink-black)]">
      <Sidebar
        currentView="live"
        onViewChange={handleViewChange}
        currentScenario="normal"
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="institutional-header">
          <div className="header-meta-group">
            <span className="header-title-badge">
              PRAMAAN / Live shared session
            </span>

            <span className="meta-dot-divider">•</span>

            <span>
              Session <strong className="font-mono text-[var(--ink-black)]">{decodedSessionId}</strong>
            </span>

            <span className="meta-dot-divider">•</span>

            <span className="text-[var(--text-muted)]">
              Candidate <strong className="text-[var(--ink-black)]">#CX0104</strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--verified-bg)] border border-[rgba(25,135,84,0.2)] text-[11px] text-[var(--verified-green)] font-medium">
              <span className="w-2 h-2 rounded-full bg-[var(--verified-green)] animate-pulse" />
              <span>Single shared state</span>
            </div>

            <Link
              href="/"
              className="btn-doc btn-doc-sm"
              title="Return to Main Overview"
            >
              <ArrowLeft size={12} />
              <span>Console overview</span>
            </Link>
          </div>
        </header>

        <main className="workspace-content overflow-y-auto p-4">
          <div className="max-w-7xl mx-auto flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-hairline)]">
              <div className="flex items-center gap-2">
                <Link
                  href="/"
                  className="btn-doc btn-doc-sm text-[var(--text-muted)] hover:text-[var(--ink-black)]"
                  title="Return to Main Console"
                >
                  <ArrowLeft size={12} />
                  <span>Main console</span>
                </Link>
                <span className="text-[var(--border-strong)]">/</span>
                <span className="font-mono text-xs font-semibold text-[var(--cobalt)]">
                  {decodedSessionId}
                </span>
                <span className="scenario-badge normal text-[10px]">
                  Shared Interview Room
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <Shield size={12} className="text-[var(--verified-green)]" />
                <span>Single Shared State · Candidate (Left) & Recruiter (Right)</span>
              </div>
            </div>

            <SharedSessionRoom sessionId={decodedSessionId} />
          </div>
        </main>
      </div>
    </div>
  )
}
