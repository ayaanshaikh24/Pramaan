'use client'

import React from 'react'
import { IntegrityStatus } from '@/types/pramaan'
import { ShieldAlert, CheckCircle2, HelpCircle, AlertCircle } from 'lucide-react'

interface RiskGaugeProps {
  risk: number | null
  status: IntegrityStatus
  confidence: 'High' | 'Medium' | 'Low' | 'Not available'
}

export function RiskGauge({ risk, status, confidence }: RiskGaugeProps) {
  const safeRisk = risk ?? 0

  // Determine color theme based on score and status
  let color = '#56E39F' // Green for Low Risk
  if (status === 'Review Recommended' || safeRisk >= 70) {
    color = '#FF6F91' // Pink
  } else if (status === 'Insufficient Evidence' || (safeRisk >= 25 && safeRisk < 70)) {
    color = '#FF9D4D' // Orange / Gold
  } else if (status === 'High Concern') {
    color = '#FF6F91'
  }

  // Calculate degrees for radial gauge (0 to 100 -> 0 to 240 deg)
  const degrees = Math.min(Math.max((safeRisk / 100) * 240, 5), 240)

  return (
    <div className="risk-gauge-container">
      <div className="gauge-meter-wrapper">
        <svg className="gauge-svg" viewBox="0 0 200 200">
          {/* Background Track Arc */}
          <circle
            cx="100"
            cy="100"
            r="80"
            className="gauge-track"
            strokeDasharray="360 120"
            strokeDashoffset="-60"
          />
          {/* Active Value Arc */}
          <circle
            cx="100"
            cy="100"
            r="80"
            className="gauge-value-arc"
            style={{
              stroke: color,
              strokeDasharray: `${(safeRisk / 100) * 360} 500`,
              strokeDashoffset: '-60',
              filter: `drop-shadow(0 0 8px ${color})`,
            }}
          />
        </svg>

        {/* Inner Gauge Metric */}
        <div className="gauge-inner-data">
          <span className="gauge-number" style={{ color: '#FFFFFF' }}>
            {risk === null ? '--' : safeRisk}
          </span>
          <span className="gauge-scale">/ 100</span>
          <span className="gauge-label">RISK SCORE</span>
        </div>
      </div>

      {/* Status Badge */}
      <div className="gauge-status-block">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span
            className="status-beacon-dot"
            style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}` }}
          />
          <span className="gauge-status-text" style={{ color }}>
            {status}
          </span>
        </div>

        <div className="confidence-pill-wrapper">
          <span className="text-xs text-muted">
            Confidence Level:{' '}
            <strong
              style={{
                color:
                  confidence === 'High'
                    ? '#56E39F'
                    : confidence === 'Medium'
                    ? '#FFD45E'
                    : confidence === 'Low'
                    ? '#FF9D4D'
                    : '#8A8FA0',
              }}
            >
              {confidence}
            </strong>
          </span>
        </div>
      </div>
    </div>
  )
}
