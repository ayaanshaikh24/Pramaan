'use client'

import React, { use, useState } from 'react'
import { SharedSessionRoom } from '@/components/SharedSessionRoom'
import { Sidebar } from '@/components/Sidebar'
import { Shield } from 'lucide-react'

interface SessionPageProps {
  params: Promise<{
    sessionId: string
  }>
}

export default function SessionPage({ params }: SessionPageProps) {
  const { sessionId } = use(params)
  const decodedSessionId = decodeURIComponent(sessionId)
  const [scenario, setScenario] = useState('normal')

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--surface-canvas)] font-sans antialiased text-[var(--ink-black)]">
      <Sidebar currentScenario={scenario} onScenarioChange={setScenario} />

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

          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Shield size={12} className="text-[var(--verified-green)]" />
            <span>Single shared state</span>
          </div>
        </header>

        <main className="workspace-content overflow-y-auto p-4">
          <div className="max-w-7xl mx-auto">
            <SharedSessionRoom sessionId={decodedSessionId} />
          </div>
        </main>
      </div>
    </div>
  )
}
