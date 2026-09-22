'use client'

import React from 'react'
import { Video, Shield } from 'lucide-react'

interface SidebarProps {
  onScenarioChange?: (scenario: string) => void
  currentScenario?: string
}

export function Sidebar({ onScenarioChange, currentScenario = 'normal' }: SidebarProps) {
  return (
    <aside className="institutional-sidebar">
      <div className="sidebar-header-group">
        <div className="flex items-center gap-2">
          <div className="logo-mark">P</div>
          <div>
            <div className="text-sm font-bold tracking-tight text-[var(--ink-black)]">PRAMAAN</div>
            <div className="text-[10px] font-medium text-[var(--cobalt)] uppercase tracking-wider">Interview Integrity Layer</div>
          </div>
        </div>
      </div>

      <div className="sidebar-section-label">Session</div>
      <nav className="sidebar-nav-list">
        <div className="sidebar-nav-item active">
          <Video size={15} className="text-[var(--cobalt)]" />
          <span>Live Interview Room</span>
        </div>
      </nav>

      <div className="sidebar-section-label">Test Scenario</div>
      <div className="px-3 py-2">
        <select
          className="w-full text-xs font-medium bg-[var(--surface-subtle)] border border-[var(--border-hairline)] rounded px-2 py-1.5 text-[var(--ink-black)]"
          value={currentScenario}
          onChange={(e) => onScenarioChange?.(e.target.value)}
        >
          <option value="normal">Normal</option>
          <option value="proxy">Proxy</option>
          <option value="low-bandwidth">Low Bandwidth</option>
        </select>
      </div>

      <div className="sidebar-footer">
        <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
          <Shield size={12} className="text-[var(--verified-green)]" />
          <span>Zero raw biometric data leaves device</span>
        </div>
      </div>
    </aside>
  )
}
