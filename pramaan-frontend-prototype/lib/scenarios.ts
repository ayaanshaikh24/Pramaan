import { Scenario, ScenarioData } from '@/types/pramaan'

export const DEFAULT_LIVE_SESSION_DATA: ScenarioData = {
  name: 'Live Session',
  risk: null,
  status: 'Not evaluated',
  confidence: 'Not available',
  quality: 'Not available',
  challenge: 'pending',
  explanation: 'Waiting for browser camera and microphone sensor signals to begin biometric integrity evaluation.',
  scores: {
    face: null,
    voice: null,
    challenge: null,
    stream: null,
  },
  events: [
    {
      time: '00:00',
      title: 'Waiting for browser signals',
      description: 'Camera and microphone sensors not yet connected. Click "Start camera" to initialize biometric pipeline.',
      type: 'info',
    },
  ],
}

export const scenarios: Record<Scenario, ScenarioData> = {
  normal: {
    name: 'Normal Candidate',
    risk: 12,
    status: 'Low Risk',
    confidence: 'High',
    scores: {
      face: 94,
      voice: 96,
      challenge: 100,
      stream: 92,
    },
    quality: 'Good',
    challenge: 'passed',
    explanation:
      'Signals are consistent across face motion, voice timing, challenge response and stream quality.',
    events: [
      {
        time: '00:00',
        title: 'Candidate joined',
        description: 'Session initialized. Device verification and consent recorded.',
        type: 'info',
      },
      {
        time: '00:10',
        title: 'Baseline created',
        description: 'Local session signals initialized in browser memory.',
        type: 'normal',
      },
      {
        time: '02:15',
        title: 'Natural interaction detected',
        description: 'Natural facial motion and speech timing aligned.',
        type: 'normal',
      },
      {
        time: '04:35',
        title: 'Random challenge issued',
        description: 'Random live presence challenge dispatched to candidate.',
        type: 'info',
      },
      {
        time: '04:41',
        title: 'Challenge passed',
        description: 'Response recorded with verified live interaction.',
        type: 'normal',
      },
      {
        time: '05:00',
        title: 'Integrity status updated',
        description: 'All 4 signal vectors consistent and within normal parameters.',
        type: 'normal',
      },
    ],
  },
  proxy: {
    name: 'Simulated Proxy / Face-Swap',
    risk: 78,
    status: 'Review Recommended',
    confidence: 'Medium',
    scores: {
      face: 54,
      voice: 38,
      challenge: 50,
      stream: 84,
    },
    quality: 'Good',
    challenge: 'partial',
    explanation:
      'Multiple signals require human review: speech timing discrepancy, reduced natural motion, and live challenge only partially completed.',
    events: [
      {
        time: '00:00',
        title: 'Candidate joined',
        description: 'Session initialized. Device verification and consent recorded.',
        type: 'info',
      },
      {
        time: '00:10',
        title: 'Baseline created',
        description: 'Local session signals initialized in browser memory.',
        type: 'normal',
      },
      {
        time: '02:15',
        title: 'Natural interaction detected',
        description: 'Initial interaction started within expected parameters.',
        type: 'normal',
      },
      {
        time: '04:35',
        title: 'Random challenge issued',
        description: 'Random live presence challenge dispatched to candidate.',
        type: 'info',
      },
      {
        time: '04:38',
        title: 'Reduced natural motion',
        description: 'Reduced natural micro-expressions and unnatural facial boundary motion.',
        type: 'warning',
      },
      {
        time: '04:41',
        title: 'Challenge only partially completed',
        description: 'Challenge response was delayed and only partially completed.',
        type: 'critical',
      },
      {
        time: '04:45',
        title: 'Lip-sync timing inconsistency',
        description: 'Mouth motion does not match speech timing and acoustic energy.',
        type: 'critical',
      },
      {
        time: '05:00',
        title: 'Integrity status updated',
        description: 'Human recruiter review recommended due to divergent signals.',
        type: 'warning',
      },
    ],
  },
  'low-bandwidth': {
    name: 'Low Bandwidth',
    risk: 32,
    status: 'Insufficient Evidence',
    confidence: 'Low',
    scores: {
      face: null, // "Low confidence"
      voice: 86,
      challenge: 100,
      stream: 24,
    },
    quality: 'Poor',
    challenge: 'passed',
    explanation:
      'Poor video quality lowers confidence. It does not prove dishonesty. Visual evidence is limited due to frame drops.',
    events: [
      {
        time: '00:00',
        title: 'Candidate joined',
        description: 'Session initialized. Device verification and consent recorded.',
        type: 'info',
      },
      {
        time: '00:10',
        title: 'Baseline created',
        description: 'Local session signals initialized in browser memory.',
        type: 'normal',
      },
      {
        time: '02:15',
        title: 'Stream quality degraded',
        description: 'Frame rate dropped below 15 FPS; visual confidence downgraded.',
        type: 'warning',
      },
      {
        time: '04:35',
        title: 'Random challenge issued',
        description: 'Random live presence challenge dispatched with audio redundancy.',
        type: 'info',
      },
      {
        time: '04:41',
        title: 'Challenge passed',
        description: 'Voice response successfully verified despite low video bitrate.',
        type: 'normal',
      },
      {
        time: '05:00',
        title: 'Integrity status updated',
        description: 'Fairness safeguard applied: poor network condition is not treated as dishonesty.',
        type: 'info',
      },
    ],
  },
}

export const CANDIDATE_DETAILS = {
  id: 'PRM-CX0104',
  name: 'Candidate #CX0104',
  role: 'Junior Frontend Engineer',
  stage: 'Technical Round 1',
  duration: '05:00',
}

export const SAMPLE_CHALLENGES = [
  {
    id: 1,
    prompt: 'Turn your head slightly to the right and say: BLUE 47',
    highlight: 'BLUE 47',
    instruction: 'Evaluates head rotation and live speech synchronization.',
  },
  {
    id: 2,
    prompt: 'Look up toward the ceiling, blink twice, and say: VECTOR 9',
    highlight: 'VECTOR 9',
    instruction: 'Evaluates gaze tracking, eyelid occlusion, and acoustic latency.',
  },
  {
    id: 3,
    prompt: 'Hold 3 fingers in front of the camera and say: CONFIRM PRAMAAN',
    highlight: 'CONFIRM PRAMAAN',
    instruction: 'Verifies hand-face depth occlusion and absence of face warping.',
  },
]
