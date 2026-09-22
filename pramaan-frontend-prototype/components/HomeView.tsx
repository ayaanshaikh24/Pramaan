'use client'

import React from 'react'
import {
  Shield,
  ArrowRight,
  Gauge,
  Monitor,
  Radio,
  Eye,
  LockKeyhole,
  CheckCircle2,
  Sparkles,
  Zap,
  Activity,
  UserCheck,
} from 'lucide-react'

interface HomeViewProps {
  onCandidate: () => void
  onRecruiter: () => void
}

export function HomeView({ onCandidate, onRecruiter }: HomeViewProps) {
  const valueProps = [
    {
      title: 'Browser-first',
      description: 'Zero external native plugins or drivers. Runs client-side directly in standard web browsers.',
      icon: Monitor,
      tone: 'cyan',
    },
    {
      title: 'No installation',
      description: 'Zero setup friction for candidates or recruiters. Instant web application session.',
      icon: Radio,
      tone: 'blue',
    },
    {
      title: 'Human review',
      description: 'Provides transparent decision-support signals. Never makes automated rejection decisions.',
      icon: Eye,
      tone: 'green',
    },
    {
      title: 'No raw-video storage',
      description: 'Privacy by design: only ephemeral cryptographic signal hashes are extracted locally.',
      icon: LockKeyhole,
      tone: 'purple',
    },
  ]

  return (
    <div className="home-container">
      {/* Background glow effects */}
      <div className="home-glow" />
      <div className="home-glow-secondary" />

      <div className="home-hero">
        <div className="home-content">
          <div className="home-badge">
            <span className="live-dot" />
            <span>INTERVIEW INTEGRITY PROTOCOL • FRONTEND PROTOTYPE</span>
          </div>

          <div className="home-brand-lockup">
            <div className="hero-shield">
              <Shield size={32} />
            </div>
            <h1 className="hero-title">
              PRAMAAN
            </h1>
          </div>

          <h2 className="hero-tagline">
            “Trust the interaction,<br />
            <span className="text-gradient-cyan">not just the image.”</span>
          </h2>

          <p className="home-copy">
            A desktop-first browser verification layer designed to verify interview authenticity in real time.
            PRAMAAN evaluates multimodal coherence across facial motion, lip-audio synchronicity, live randomized
            challenges, and network stream quality — ensuring fair, human-in-the-loop candidate evaluation.
          </p>

          <div className="home-buttons">
            <button
              type="button"
              id="btn-enter-candidate"
              className="btn btn-primary btn-large"
              onClick={onCandidate}
            >
              <span>Enter Candidate Session</span>
              <ArrowRight size={18} />
            </button>
            <button
              type="button"
              id="btn-open-recruiter"
              className="btn btn-outline btn-large"
              onClick={onRecruiter}
            >
              <Gauge size={18} />
              <span>Open Recruiter Dashboard</span>
            </button>
          </div>

          <div className="flow-badge-strip">
            <div className="flow-step">
              <span className="step-num">1</span>
              <span>Candidate Check</span>
            </div>
            <span className="flow-arrow">→</span>
            <div className="flow-step">
              <span className="step-num">2</span>
              <span>Live Challenge</span>
            </div>
            <span className="flow-arrow">→</span>
            <div className="flow-step">
              <span className="step-num">3</span>
              <span>Recruiter Score</span>
            </div>
            <span className="flow-arrow">→</span>
            <div className="flow-step">
              <span className="step-num">4</span>
              <span>Scenario Test</span>
            </div>
          </div>
        </div>

        {/* Cyber Interactive Graphic */}
        <div className="home-graphic">
          <div className="cyber-radar">
            <div className="radar-ring ring-1" />
            <div className="radar-ring ring-2" />
            <div className="radar-ring ring-3" />
            <div className="radar-sweep" />

            <div className="radar-center">
              <Shield size={40} className="text-[#25E0FF]" />
              <span className="text-xs font-bold tracking-widest text-white mt-2">PRAMAAN</span>
              <span className="text-[9px] text-[#25E0FF] tracking-wider">SECURE ENGINE</span>
            </div>

            <div className="radar-node node-face">
              <Activity size={14} />
              <div>
                <strong>Face + Motion</strong>
                <small>3D mesh alignment</small>
              </div>
            </div>

            <div className="radar-node node-voice">
              <Sparkles size={14} />
              <div>
                <strong>Voice + Lip Sync</strong>
                <small>Phoneme latency</small>
              </div>
            </div>

            <div className="radar-node node-challenge">
              <Zap size={14} />
              <div>
                <strong>Live Challenge</strong>
                <small>Zero-shot prompt</small>
              </div>
            </div>

            <div className="radar-node node-privacy">
              <UserCheck size={14} />
              <div>
                <strong>Human Review</strong>
                <small>Fairness guarantee</small>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Value Pillars */}
      <div className="pillars-grid">
        {valueProps.map((item) => {
          const Icon = item.icon
          return (
            <div key={item.title} className="pillar-card">
              <div className={`pillar-icon pillar-icon-${item.tone}`}>
                <Icon size={20} />
              </div>
              <h3 className="pillar-title">{item.title}</h3>
              <p className="pillar-desc">{item.description}</p>
              <div className="pillar-footer">
                <CheckCircle2 size={13} className="text-[#56E39F]" />
                <span>Verified Client Architecture</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
