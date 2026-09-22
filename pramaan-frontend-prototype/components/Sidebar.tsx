'use client'

import React from 'react'
import {
  Activity,
  User,
  Clock,
  FlaskConical,
  ShieldCheck,
  FileCheck2,
} from 'lucide-react'
import { Scenario } from '@/types/pramaan'

export type ActiveView = 'live' | 'candidate' | 'evidence' | 'lab' | 'privacy'

interface SidebarProps {
  currentView: ActiveView
  onViewChange: (view: ActiveView) => void
  currentScenario: Scenario
}

export function Sidebar({ currentView, onViewChange, currentScenario }: SidebarProps) {
  const navItems = [
    { id: 'live', label: 'Live Session', icon: Activity },
    { id: 'candidate', label: 'Candidate View', icon: User },
    { id: 'evidence', label: 'Evidence Timeline', icon: Clock },
    { id: 'lab', label: 'Demo Lab', icon: FlaskConical },
    { id: 'privacy', label: 'Privacy Controls', icon: ShieldCheck },
  ] as const

  const getScenarioBadge = () => {
    switch (currentScenario) {
      case 'normal':
        return { label: 'Normal Session', color: '#198754' }
      case 'proxy':
        return { label: 'Simulated Proxy', color: '#D9534F' }
      case 'low-bandwidth':
        return { label: 'Low Bandwidth', color: '#D98B21' }
    }
  }

  const scenarioMeta = getScenarioBadge()

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
          <span
            className="status-dot-sm"
            style={{ background: scenarioMeta.color }}
          />
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wider font-semibold scenario-label-kicker">
              Active scenario
            </span>
            <span className="text-xs font-medium text-[#F1F5F9] truncate max-w-[140px]">
              {scenarioMeta.label}
            </span>
          </div>
        </div>
      </div>
    </aside>
  )
}
