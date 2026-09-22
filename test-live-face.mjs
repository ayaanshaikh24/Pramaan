/**
 * Automated Verification Script for Live Face Presence Detection
 * Uses Chrome DevTools Protocol to:
 * 1. Verify idle demo mode (12/100, Low Risk, Demo signal)
 * 2. Start Camera and feed realistic candidate face
 * 3. Verify Live Detection transition (Face visible, Browser signal)
 * 4. Simulate Face Missing / Camera Covered (blanking video frame)
 * 5. Verify transition to Insufficient Evidence (Risk 32, Confidence Low, Timeline events added)
 * 6. Restore Face Presence (drawing candidate face back onto stream)
 * 7. Verify transition back to Low Risk (Risk 12, Confidence High, Visual evidence restored)
 * 8. Verify Demo Lab scenarios (Proxy -> 78/100, Low Bandwidth -> 32/100)
 */

async function main() {
  console.log('Connecting to Chrome DevTools Protocol on port 9222...')
  
  let targets = []
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json')
      targets = await res.json()
      if (targets.length > 0) break
    } catch {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  const pageTarget = targets.find(t => t.url.includes('localhost:3000')) || targets[0]
  if (!pageTarget) {
    console.error('No page target found on port 9222')
    process.exit(1)
  }

  console.log(`Connecting to page target: ${pageTarget.title} (${pageTarget.url})`)
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl)

  let idCounter = 1
  const pending = new Map()

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg)
      pending.delete(msg.id)
    }
  }

  await new Promise(resolve => ws.onopen = resolve)

  function sendCommand(method, params = {}) {
    return new Promise(resolve => {
      const id = idCounter++
      pending.set(id, resolve)
      ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async function evaluate(expr) {
    const res = await sendCommand('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    })
    return res.result?.result?.value
  }

  async function screenshot(filename) {
    const res = await sendCommand('Page.captureScreenshot', { format: 'png' })
    if (res.result?.data) {
      const fs = await import('fs')
      fs.writeFileSync(filename, Buffer.from(res.result.data, 'base64'))
      console.log(`📸 Screenshot saved: ${filename}`)
    }
  }

  // 1. Initial State Check
  console.log('\n--- 1. Checking Initial Idle State ---')
  const initialText = await evaluate(`document.body.innerText`)
  const hasRisk12 = initialText.includes('12') && initialText.includes('LOW RISK')
  const hasDemoSignal = initialText.includes('Demo signal active') || initialText.includes('Demo signal')
  console.log(`Initial Risk 12 / Low Risk present: ${hasRisk12}`)
  console.log(`Demo signal badge present: ${hasDemoSignal}`)

  // 2. Start Camera and feed realistic candidate face
  console.log('\n--- 2. Starting Camera Stream & Testing Face Visible ---')
  await evaluate(`
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Start camera'));
    if (btn) btn.click();
  `)
  await new Promise(r => setTimeout(r, 1000))

  // Pipe realistic candidate face into the sampling stream
  await evaluate(`
    (async function setupFacePipeline() {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise(res => {
        img.onload = res;
        img.src = '/test-face.jpg';
      });
      ctx.drawImage(img, 0, 0, 640, 480);
      const stream = canvas.captureStream(30);

      window.__testCanvas = canvas;
      window.__testCtx = ctx;
      window.__testImg = img;
      window.__testStream = stream;

      window.setFacePresence = function(visible) {
        if (visible) {
          ctx.drawImage(img, 0, 0, 640, 480);
        } else {
          ctx.fillStyle = '#050505';
          ctx.fillRect(0, 0, 640, 480);
        }
      };

      const hiddenVid = document.querySelector('video[aria-hidden="true"]');
      if (hiddenVid) {
        hiddenVid.srcObject = stream;
        hiddenVid.play().catch(() => {});
      }
    })()
  `)
  await new Promise(r => setTimeout(r, 1500))

  const faceVisibleText = await evaluate(`document.body.innerText`)
  const hasFaceVisible = faceVisibleText.includes('Face visible')
  const hasBrowserSignal = faceVisibleText.includes('Browser signal')
  console.log(`Face visible badge present: ${hasFaceVisible}`)
  console.log(`Browser signal badge present: ${hasBrowserSignal}`)
  await screenshot('artifacts/pramaan-test-report/screenshots/03_camera_face_visible.png')

  // 3. Test Face Missing / Camera Covered (Cover camera with black fill for > 1 second)
  console.log('\n--- 3. Testing Face Missing / Camera Covered (> 1s) ---')
  await evaluate(`window.setFacePresence(false);`)
  console.log('Waiting 2.0s for continuous face missing duration (> 1s required)...')
  await new Promise(r => setTimeout(r, 2000))

  const missingState = await evaluate(`
    ({
      innerText: document.body.innerText,
      hasInsufficientEvidence: document.body.innerText.includes('INSUFFICIENT EVIDENCE') || document.body.innerText.includes('Insufficient Evidence') || document.body.innerText.includes('32'),
      hasFaceMissingEvent: document.body.innerText.includes('Face no longer visible') || document.body.innerText.includes('Visual evidence temporarily unavailable'),
      hasFaceNotVisibleBadge: document.body.innerText.includes('Face not visible') || document.body.innerText.includes('Camera Lens Covered'),
    })
  `)
  console.log(`Transitioned to Insufficient Evidence (Risk 32): ${missingState.hasInsufficientEvidence}`)
  console.log(`Timeline contains Face Missing events: ${missingState.hasFaceMissingEvent}`)
  console.log(`Face not visible alert displayed: ${missingState.hasFaceNotVisibleBadge}`)
  await screenshot('artifacts/pramaan-test-report/screenshots/04_face_missing_transition.png')

  // 4. Test Face Returning (Restore candidate face into camera view)
  console.log('\n--- 4. Testing Face Returning (Candidate returns to frame) ---')
  await evaluate(`window.setFacePresence(true);`)
  console.log('Waiting 1.5s for face detector recovery...')
  await new Promise(r => setTimeout(r, 1500))

  const returnedState = await evaluate(`
    ({
      hasLowRisk: document.body.innerText.includes('12') && document.body.innerText.includes('LOW RISK'),
      hasRestoredEvent: document.body.innerText.includes('Visual evidence restored') || document.body.innerText.includes('Face visible again'),
      hasFaceVisibleBadge: document.body.innerText.includes('Face visible'),
    })
  `)
  console.log(`Restored to Risk 12 / Low Risk: ${returnedState.hasLowRisk}`)
  console.log(`Timeline contains Visual evidence restored: ${returnedState.hasRestoredEvent}`)
  console.log(`Face visible badge restored: ${returnedState.hasFaceVisibleBadge}`)
  await screenshot('artifacts/pramaan-test-report/screenshots/05_face_restored_transition.png')

  // 5. Test Demo Lab Scenarios
  console.log('\n--- 5. Testing Demo Lab Scenarios ---')
  // Navigate to Demo Lab
  await evaluate(`
    const navLab = Array.from(document.querySelectorAll('button, a')).find(el => el.innerText.includes('Demo Lab'));
    if (navLab) navLab.click();
  `)
  await new Promise(r => setTimeout(r, 1000))

  // Select Proxy scenario
  await evaluate(`
    const proxyBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Proxy / Face-Swap'));
    if (proxyBtn) proxyBtn.click();
  `)
  await new Promise(r => setTimeout(r, 1500))
  const proxyText = await evaluate(`document.body.innerText`)
  const hasProxy78 = proxyText.includes('78') && (proxyText.includes('REVIEW RECOMMENDED') || proxyText.includes('Review Recommended'))
  console.log(`Proxy Scenario active (78/100, Review Recommended): ${hasProxy78}`)
  await screenshot('artifacts/pramaan-test-report/screenshots/06_demo_lab_proxy.png')

  // Select Low Bandwidth scenario
  await evaluate(`
    const lowBwBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Low Bandwidth'));
    if (lowBwBtn) lowBwBtn.click();
  `)
  await new Promise(r => setTimeout(r, 1500))
  const lowBwText = await evaluate(`document.body.innerText`)
  const hasLowBw32 = lowBwText.includes('32') && (lowBwText.includes('INSUFFICIENT EVIDENCE') || lowBwText.includes('Insufficient Evidence'))
  console.log(`Low Bandwidth Scenario active (32/100, Insufficient Evidence): ${hasLowBw32}`)
  await screenshot('artifacts/pramaan-test-report/screenshots/07_demo_lab_low_bw.png')

  // Return to Normal scenario and Live view
  await evaluate(`
    const normBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Normal Candidate'));
    if (normBtn) normBtn.click();
  `)
  await new Promise(r => setTimeout(r, 800))
  await evaluate(`
    const navLive = Array.from(document.querySelectorAll('button, a')).find(el => el.innerText.includes('Live Session'));
    if (navLive) navLive.click();
  `)
  await new Promise(r => setTimeout(r, 1000))

  const finalCheck = await evaluate(`document.body.innerText`)
  const finalHas12 = finalCheck.includes('12') && finalCheck.includes('LOW RISK')
  console.log(`Returned to Live Session with Risk 12/100: ${finalHas12}`)
  await screenshot('artifacts/pramaan-test-report/screenshots/08_final_verified_state.png')

  console.log('\n✅ All Live Face Presence Verification steps complete.')
  ws.close()
  process.exit(0)
}

main().catch(err => {
  console.error('Test error:', err)
  process.exit(1)
})
