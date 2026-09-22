'use client'

import React from 'react'
import { Video, Shield } from 'lucide-react'

interface SidebarProps {
  onScenarioChange?: (scenario: string) => void
  currentScenario?: string
}

export function Sidebar({ onScenarioChange, currentScenario = 'normal' }: SidebarProps) {
  return (
    <aside className="w-56 flex-shrink-0 bg-[var(--navy-sidebar)] border-r border-[var(--navy-sidebar-border)] flex flex-col h-screen">
      {/* Logo */}
      <div className="p-4 border-b border-[var(--navy-sidebar-border)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--cobalt)] flex items-center justify-center text-white font-bold text-sm">P</div>
          <div>
            <div className="text-sm font-bold tracking-tight text-white">PRAMAAN</div>
            <div className="text-[10px] font-medium text-[var(--cobalt)] uppercase tracking-wider">Interview Integrity Layer</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 py-3">
        <div className="px-4 mb-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Session</div>
        <div className="px-2">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[var(--navy-sidebar-active)] text-white text-sm font-medium">
            <Video size={15} className="text-[var(--cobalt)]" />
            <span>Live Interview Room</span>
          </div>
        </div>

        <div className="px-4 mt-4 mb-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Test Scenario</div>
        <div className="px-4">
          <select
            className="w-full text-xs font-medium bg-[var(--navy-sidebar-hover)] border border-[var(--navy-sidebar-border)] rounded px-2 py-1.5 text-white"
            value={currentScenario}
            onChange={(e) => onScenarioChange?.(e.target.value)}
          >
            <option value="normal">Normal</option>
            <option value="proxy">Proxy</option>
            <option value="low-bandwidth">Low Bandwidth</option>
          </select>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--navy-sidebar-border)]">
        <div className="flex items-center gap-2 text-[11px] text-gray-400">
          <Shield size={12} className="text-[var(--verified-green)]" />
          <span>Zero raw biometric data leaves device</span>
        </div>
      </div>
    </aside>
  )
}
