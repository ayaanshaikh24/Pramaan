'use client'

import React from 'react'
import { Shield, UserRound, Monitor, Home as HomeIcon } from 'lucide-react'

interface NavbarProps {
  currentView: 'home' | 'candidate' | 'recruiter'
  onViewChange: (view: 'home' | 'candidate' | 'recruiter') => void
}

export function Navbar({ currentView, onViewChange }: NavbarProps) {
  return (
    <header className="top-nav">
      <button
        type="button"
        className="brand-button"
        onClick={() => onViewChange('home')}
        title="Return to Home"
      >
        <div className="flex items-center gap-3">
          <div className="logo-mark">
            <Shield size={18} fill="currentColor" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[17px] font-bold tracking-[.24em] text-white">PRAMAAN</span>
            <span className="text-[10px] text-[#25E0FF] tracking-wide hidden sm:inline">
              Trust the interaction, not just the image.
            </span>
          </div>
        </div>
      </button>

      <div className="nav-center">
        <span className="nav-kicker">BROWSER INTERVIEW INTEGRITY</span>
        {currentView === 'home' && (
          <span className="nav-title">Candidate & Recruiter Evaluation Console</span>
        )}
        {currentView === 'candidate' && (
          <span className="nav-title">Candidate Session • Candidate #CX0104 (Technical Round 1)</span>
        )}
        {currentView === 'recruiter' && (
          <span className="nav-title">Recruiter Dashboard • Real-time Decision Support</span>
        )}
      </div>

      <div className="nav-actions">
        <span className="pill pill-purple">
          <span className="live-dot" /> Frontend Demo Mode
        </span>

        <div className="view-switch">
          <button
            type="button"
            className={currentView === 'home' ? 'active' : ''}
            onClick={() => onViewChange('home')}
            title="Overview Screen"
          >
            <HomeIcon size={13} />
            <span>Home</span>
          </button>
          <button
            type="button"
            className={currentView === 'candidate' ? 'active' : ''}
            onClick={() => onViewChange('candidate')}
            title="Candidate View"
          >
            <UserRound size={13} />
            <span>Candidate Session</span>
          </button>
          <button
            type="button"
            className={currentView === 'recruiter' ? 'active' : ''}
            onClick={() => onViewChange('recruiter')}
            title="Recruiter View"
          >
            <Monitor size={13} />
            <span>Recruiter Dashboard</span>
          </button>
        </div>
      </div>
    </header>
  )
}
