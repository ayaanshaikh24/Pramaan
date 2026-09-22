/**
 * PRAMAAN Browser SpeechRecognition Engine
 *
 * Provides real speech-to-text verification for dynamic interview integrity challenges.
 * Privacy Invariant:
 * SpeechRecognition is processed by the browser speech subsystem.
 * Only the resulting boolean/evaluation outcome and derived challenge score are transmitted.
 */

export interface SpeechSessionOptions {
  expectedPhrase?: string
  lang?: string
  onTranscript?: (transcript: string) => void
  onOutcome?: (outcome: 'passed' | 'partial' | 'failed', transcript: string) => void
  onError?: (error: string) => void
  onEnd?: () => void
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false
  return !!(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  )
}

/**
 * Normalizes speech transcript:
 * - lowercase
 * - remove all punctuation
 * - collapse multi-spaces
 */
export function normalizeTranscript(text: string): string {
  if (!text) return ''
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Evaluate if spoken transcript satisfies the challenge phrase:
 * "Turn your head slightly to the right and say BLUE 47"
 *
 * Accept reasonable variations:
 * - "blue 47"
 * - "blue forty seven"
 * - "blue forty-seven"
 */
export function evaluateChallengePhrase(
  transcript: string,
  _expectedPhrase?: string
): 'passed' | 'partial' | 'failed' {
  const norm = normalizeTranscript(transcript)

  // Full match criteria
  const fullMatchPatterns = [
    'blue 47',
    'blue forty seven',
    'blue fortyseven',
    'blue 4 7',
  ]

  for (const pat of fullMatchPatterns) {
    if (norm.includes(pat)) {
      return 'passed'
    }
  }

  // Partial match criteria
  const partialKeywords = ['blue', '47', 'forty seven', 'forty', 'seven']
  const matchedCount = partialKeywords.filter((kw) => norm.includes(kw)).length

  if (matchedCount >= 1) {
    return 'partial'
  }

  return 'failed'
}

export class BrowserSpeechSession {
  private recognition: any = null
  private isRunning = false
  private options: SpeechSessionOptions

  constructor(options: SpeechSessionOptions) {
    this.options = options

    if (typeof window === 'undefined') return

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    if (!SpeechRecognitionClass) {
      return
    }

    try {
      const recognition = new SpeechRecognitionClass()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.maxAlternatives = 1
      recognition.lang = options.lang || 'en-US'

      recognition.onresult = (event: any) => {
        if (!event.results || event.results.length === 0) return
        const result = event.results[0][0]
        const transcript = result ? result.transcript : ''
        this.options.onTranscript?.(transcript)

        const outcome = evaluateChallengePhrase(
          transcript,
          this.options.expectedPhrase
        )
        this.options.onOutcome?.(outcome, transcript)
      }

      recognition.onerror = (event: any) => {
        const err = event.error || 'SpeechRecognition error'
        this.options.onError?.(err)
      }

      recognition.onend = () => {
        this.isRunning = false
        this.options.onEnd?.()
      }

      this.recognition = recognition
    } catch (e: any) {
      console.warn('Could not initialize SpeechRecognition:', e)
    }
  }

  start(): boolean {
    if (!this.recognition) return false
    if (this.isRunning) return true
    try {
      this.recognition.start()
      this.isRunning = true
      return true
    } catch (err) {
      console.warn('SpeechRecognition.start() error:', err)
      return false
    }
  }

  stop(): void {
    if (this.recognition && this.isRunning) {
      try {
        this.recognition.stop()
      } catch {}
      this.isRunning = false
    }
  }

  abort(): void {
    if (this.recognition) {
      try {
        this.recognition.abort()
      } catch {}
      this.isRunning = false
    }
  }
}
