// Comprehensive Verification for PRAMAAN Real Browser Camera Sensor Pipeline
import { spawn } from 'child_process'
import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const DEBUG_PORT = 9229
const SCREENSHOT_DIR = path.resolve(process.cwd(), 'artifacts/camera-pipeline-test')

try {
  mkdirSync(SCREENSHOT_DIR, { recursive: true })
} catch {}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl)
    this.msgId = 0
    this.pending = new Map()

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.id && this.pending.has(data.id)) {
        const { resolve, reject } = this.pending.get(data.id)
        this.pending.delete(data.id)
        if (data.error) reject(data.error)
        else resolve(data.result)
      }
    }
  }

  async waitForOpen() {
    if (this.ws.readyState === WebSocket.OPEN) return
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve()
      this.ws.onerror = (e) => reject(e)
    })
  }

  send(method, params = {}) {
    const id = ++this.msgId
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    return res.result?.value
  }

  async captureScreenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' })
    const buf = Buffer.from(res.data, 'base64')
    writeFileSync(path.join(SCREENSHOT_DIR, filename), buf)
    console.log(`📸 Screenshot: artifacts/camera-pipeline-test/${filename}`)
  }

  close() {
    this.ws.close()
  }
}

async function runTest() {
  console.log('====================================================================')
  console.log('PRAMAAN CRITICAL LIVE CAMERA SENSOR PIPELINE VERIFICATION SUITE')
  console.log('====================================================================')

  const chromeProcess = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      `--remote-debugging-port=${DEBUG_PORT}`,
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1360,940',
    ],
    { stdio: 'ignore' }
  )

  await sleep(1500)

  try {
    const versionRes = await fetch(`http://localhost:${DEBUG_PORT}/json/list`)
    const targets = await versionRes.json()
    const pageTarget = targets.find((t) => t.type === 'page') || targets[0]
    if (!pageTarget) throw new Error('No Chrome target found')

    const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl)
    await cdp.waitForOpen()

    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')

    // 1. Navigate to localhost:3000
    console.log('\n[Step 1] Navigating to http://localhost:3000...')
    await cdp.send('Page.navigate', { url: 'http://localhost:3000' })
    await sleep(2500)
    await cdp.captureScreenshot('step01_dashboard_landing.png')

    // Setup getUserMedia mock with dynamic frame generator (renders test-face.jpg, outside, covered)
    console.log('[Setup] Injecting dynamic camera stream mock for deterministic sensor validation...')
    await cdp.evaluate(`
      (() => {
        const img = new Image();
        img.src = '/test-face.jpg';

        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');

        window.__feedMode = 'face'; // 'face' | 'outside' | 'covered'
        window.__animRunning = true;

        let frameTick = 0;
        function renderLoop() {
          if (!window.__animRunning) return;
          frameTick++;
          if (window.__feedMode === 'face') {
            // Natural slight micro-variation to trigger motion scoring
            const microDx = Math.sin(frameTick * 0.1) * 1.5;
            ctx.drawImage(img, microDx, 0, 640, 480);
          } else if (window.__feedMode === 'outside') {
            ctx.fillStyle = '#6e7a7d';
            ctx.fillRect(0, 0, 640, 480);
          } else if (window.__feedMode === 'covered') {
            ctx.fillStyle = '#050505';
            ctx.fillRect(0, 0, 640, 480);
          }
          requestAnimationFrame(renderLoop);
        }
        renderLoop();

        const canvasStream = canvas.captureStream(30);

        // Add dummy audio track for Web Audio Analyser
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const dst = audioCtx.createMediaStreamDestination();
        osc.connect(dst);
        osc.start();
        const audioTrack = dst.stream.getAudioTracks()[0];
        canvasStream.addTrack(audioTrack);

        // Override getUserMedia to return this dynamic stream
        navigator.mediaDevices.getUserMedia = async (constraints) => {
          return canvasStream;
        };
      })()
    `)

    // 2. Open Candidate View
    console.log('\n[Step 2] Opening Candidate View...')
    await cdp.evaluate(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Candidate View'));
      if (btn) btn.click();
    `)
    await sleep(800)
    await cdp.captureScreenshot('step02_candidate_view.png')

    // 3. Grant camera permission & Click Start Camera
    console.log('\n[Step 3] Granting camera & Clicking "Start camera"...')
    await cdp.evaluate(`
      const startBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Start camera'));
      if (startBtn) startBtn.click();
    `)
    // Allow detector 1.5s to run on face feed
    await sleep(1800)
    await cdp.captureScreenshot('step03_candidate_face_visible.png')

    // 4 & 5. Verify "Face visible" and face overlay bounding box
    console.log('\n[Step 4 & 5] Verifying "Face visible" & Landmark Bounding Box Overlay...')
    const candidateFaceCheck = await cdp.evaluate(`
      (() => {
        const text = document.body.innerText;
        const box = document.querySelector('.face-detected-bounding-box');
        const label = document.querySelector('.face-box-label');
        return {
          hasFaceVisible: text.includes('Face visible'),
          hasSensorActive: text.includes('Browser sensor active'),
          hasBoundingBox: !!box,
          boxLabel: label ? label.innerText : null,
          boxStyle: box ? {
            left: box.style.left,
            top: box.style.top,
            width: box.style.width,
            height: box.style.height
          } : null,
          micActive: text.includes('Microphone ready')
        };
      })()
    `)
    console.log('Candidate View Check:', candidateFaceCheck)

    // 6 & 7. Candidate moves OUTSIDE frame for at least 2 seconds
    console.log('\n[Step 6 & 7] Candidate moving outside frame for 2.2 seconds...')
    await cdp.evaluate(`window.__feedMode = 'outside';`)
    await sleep(2200)
    await cdp.captureScreenshot('step04_candidate_outside_frame.png')

    const candidateOutsideCheck = await cdp.evaluate(`
      (() => {
        const text = document.body.innerText;
        const box = document.querySelector('.face-detected-bounding-box');
        return {
          hasFaceNotVisible: text.includes('Face not visible') || text.includes('Face Not In Frame'),
          boxHidden: !box,
          hasOutsideAlert: text.includes('Candidate face moved outside camera frame')
        };
      })()
    `)
    console.log('Candidate Outside Frame Check:', candidateOutsideCheck)

    // 8, 9 & 10. Switch to Recruiter Dashboard (Live Session View)
    console.log('\n[Step 8, 9 & 10] Switching to Recruiter Dashboard & verifying changes...')
    await cdp.evaluate(`
      const liveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Live Session'));
      if (liveBtn) liveBtn.click();
    `)
    await sleep(1000)
    await cdp.captureScreenshot('step05_recruiter_dashboard_insufficient_evidence.png')

    const recruiterMissingCheck = await cdp.evaluate(`
      (() => {
        const text = document.body.innerText;
        const events = Array.from(document.querySelectorAll('.incident-headline')).map(e => e.innerText);
        const riskScore = document.querySelector('.score-prominent')?.innerText;
        return {
          riskScore,
          isInsufficientEvidence: text.includes('Insufficient Evidence') || text.includes('INSUFFICIENT EVIDENCE'),
          isConfidenceLow: text.includes('Low'),
          isVisualSignalNotAvailable: text.includes('NOT AVAILABLE'),
          explanation: text.includes('Visual evidence is temporarily unavailable. This does not prove dishonesty.'),
          timelineEvents: events.slice(0, 4),
          hasMissingEvent: events.includes('Face no longer visible')
        };
      })()
    `)
    console.log('Recruiter Dashboard Insufficient Evidence Check:', recruiterMissingCheck)

    // 11 & 12. Cover camera for at least 2 seconds
    console.log('\n[Step 11 & 12] Simulating camera covered for 2.2 seconds...')
    await cdp.evaluate(`window.__feedMode = 'covered';`)
    await sleep(2200)
    await cdp.captureScreenshot('step06_recruiter_dashboard_camera_covered.png')

    const cameraCoveredCheck = await cdp.evaluate(`
      (() => {
        const text = document.body.innerText;
        const riskScore = document.querySelector('.score-prominent')?.innerText;
        return {
          riskScore,
          isInsufficientEvidence: text.includes('Insufficient Evidence') || text.includes('INSUFFICIENT EVIDENCE'),
          isConfidenceLow: text.includes('Low'),
          isVisualSignalNotAvailable: text.includes('NOT AVAILABLE')
        };
      })()
    `)
    console.log('Camera Covered Check:', cameraCoveredCheck)

    // 13, 14, 15 & 16. Candidate returns to the camera frame!
    console.log('\n[Step 13, 14, 15 & 16] Candidate returns to camera frame...')
    await cdp.evaluate(`window.__feedMode = 'face';`)
    await sleep(2000)
    await cdp.captureScreenshot('step07_recruiter_dashboard_evidence_restored.png')

    const recruiterRestoredCheck = await cdp.evaluate(`
      (() => {
        const text = document.body.innerText;
        const events = Array.from(document.querySelectorAll('.incident-headline')).map(e => e.innerText);
        const riskScore = document.querySelector('.score-prominent')?.innerText;
        const statusTag = document.querySelector('.spectrum-label-tag')?.innerText;
        const faceRow = Array.from(document.querySelectorAll('.signal-data-row'))[0]?.innerText;
        return {
          riskScore,
          statusTag,
          isLowRisk: statusTag ? statusTag.toLowerCase().includes('low risk') : false,
          confidenceHigh: text.includes('High'),
          hasRestoredEvent: events.includes('Visual evidence restored'),
          timelineEvents: events.slice(0, 4),
          faceSignalNotRestored: text.includes('NOT AVAILABLE'),
          faceRowText: faceRow ? faceRow.replace(/\\n/g, ' · ') : null
        };
      })()
    `)
    console.log('Evidence Restored Check:', recruiterRestoredCheck)

    await cdp.evaluate(`window.__animRunning = false;`)
    cdp.close()
    chromeProcess.kill()

    // Assertions
    const passed =
      candidateFaceCheck.hasFaceVisible &&
      candidateFaceCheck.hasBoundingBox &&
      candidateOutsideCheck.hasFaceNotVisible &&
      candidateOutsideCheck.boxHidden &&
      recruiterMissingCheck.riskScore === '32' &&
      recruiterMissingCheck.isInsufficientEvidence &&
      recruiterMissingCheck.isConfidenceLow &&
      recruiterMissingCheck.isVisualSignalNotAvailable &&
      recruiterMissingCheck.hasMissingEvent &&
      cameraCoveredCheck.riskScore === '32' &&
      cameraCoveredCheck.isInsufficientEvidence &&
      Number(recruiterRestoredCheck.riskScore) <= 16 &&
      recruiterRestoredCheck.isLowRisk &&
      recruiterRestoredCheck.confidenceHigh &&
      recruiterRestoredCheck.hasRestoredEvent &&
      !recruiterRestoredCheck.faceSignalNotRestored

    if (passed) {
      console.log('\n====================================================================')
      console.log('✅ ALL 16 REQUIREMENTS OF THE CRITICAL LIVE SENSOR PIPELINE PASSED!')
      console.log('====================================================================')
      process.exit(0)
    } else {
      console.error('\n❌ Some checks failed! Details:', {
        candidateFaceCheck,
        candidateOutsideCheck,
        recruiterMissingCheck,
        cameraCoveredCheck,
        recruiterRestoredCheck,
      })
      process.exit(1)
    }
  } catch (err) {
    console.error('❌ Test failed with exception:', err)
    chromeProcess.kill()
    process.exit(1)
  }
}

runTest()
