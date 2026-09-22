'use client'

import React from 'react'
import {
  Activity,
  Clock,
  FlaskConical,
  ShieldCheck,
  FileCheck2,
} from 'lucide-react'

export type ActiveView = 'live' | 'evidence' | 'lab' | 'privacy'

interface SidebarProps {
  currentView: ActiveView
  onViewChange: (view: ActiveView) => void
}

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const navItems = [
    { id: 'live' as const, label: 'Live Interview Room', icon: Activity },
    { id: 'evidence' as const, label: 'Evidence Timeline', icon: Clock },
    { id: 'lab' as const, label: 'Demo Lab', icon: FlaskConical },
    { id: 'privacy' as const, label: 'Privacy Controls', icon: ShieldCheck },
  ]

  return (
    <aside className="navy-sidebar">
      <div className="sidebar-brand-block">
        <div className="evidence-seal">
          <FileCheck2 size={16} />
        </div>
        <div>
          <div className="brand-label">PRAMAAN</div>
          <div className="brand-subtext">The Evidence Room</div>
        </div>
      </div>

      <nav className="navy-nav">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = currentView === item.id
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-link-btn ${isActive ? 'active' : ''}`}
              onClick={() => onViewChange(item.id)}
            >
              <Icon size={15} className={isActive ? 'nav-icon-active' : 'nav-icon-inactive'} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="navy-footer">
        <div className="scenario-indicator-card">
          <span className="status-dot-sm" style={{ background: '#198754' }} />
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wider font-semibold scenario-label-kicker">
              Session mode
            </span>
            <span className="text-xs font-medium text-[#F1F5F9] truncate max-w-[140px]">
              Live Interview
            </span>
          </div>
        </div>
      </div>
    </aside>
  )
}
