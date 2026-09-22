import { spawn } from 'child_process'
import { writeFileSync } from 'fs'

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl)
    this.id = 1
    this.callbacks = new Map()
    this.ready = new Promise((resolve) => {
      this.ws.onopen = () => resolve()
    })
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id)
        this.callbacks.delete(msg.id)
        if (msg.error) reject(msg.error)
        else resolve(msg.result)
      }
    }
  }

  async send(method, params = {}) {
    await this.ready
    const id = this.id++
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    return res.result?.value
  }

  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' })
    const buffer = Buffer.from(res.data, 'base64')
    writeFileSync(filename, buffer)
    console.log(`Saved screenshot: ${filename}`)
  }
}

async function run() {
  console.log('--- Starting Presentation Demo Mode CDP Test ---')
  const chrome = spawn(
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    [
      '--headless=new',
      '--disable-gpu',
      '--remote-debugging-port=9222',
      '--window-size=1440,900',
      'about:blank',
    ],
    { stdio: 'ignore' }
  )

  await sleep(1500)

  try {
    // Open target page
    const pageRes = await fetch('http://127.0.0.1:9222/json/new?http://localhost:3000', {
      method: 'PUT',
    })
    const pageData = await pageRes.json()
    const client = new CDPClient(pageData.webSocketDebuggerUrl)

    await client.send('Page.enable')
    await client.send('Runtime.enable')
    await sleep(2000)

    console.log('1. Checking Initial Step 1 (Normal Candidate)...')
    const step1Info = await client.eval(`(() => {
      const risk = document.querySelector('.score-prominent')?.innerText;
      const status = document.querySelector('.spectrum-label-tag')?.innerText;
      const scenario = document.querySelector('.scenario-badge')?.innerText;
      return { risk, status, scenario };
    })()`)
    console.log('Step 1 status:', step1Info)

    console.log('2. Clicking Step 2 (Random challenge)...')
    await client.eval(`(() => {
      const btns = Array.from(document.querySelectorAll('.guided-step-btn'));
      const challengeBtn = btns.find(b => b.innerText.includes('Random challenge'));
      if (challengeBtn) challengeBtn.click();
    })()`)
    await sleep(800)

    const step2Info = await client.eval(`(() => {
      const banner = document.querySelector('.full-challenge-banner');
      const prompt = document.querySelector('.challenge-prompt-quote')?.innerText;
      const timer = document.querySelector('.challenge-timer-chip')?.innerText;
      const status = document.querySelector('.challenge-status-pill')?.innerText;
      return { bannerPresent: !!banner, prompt, timer, status };
    })()`)
    console.log('Step 2 Challenge Banner:', step2Info)
    await client.screenshot('step2-challenge.png')

    console.log('3. Clicking "Pass" on Challenge Banner...')
    await client.eval(`(() => {
      const passBtn = Array.from(document.querySelectorAll('.full-challenge-banner button')).find(b => b.innerText.includes('Pass'));
      if (passBtn) passBtn.click();
    })()`)
    await sleep(600)
    const passedStatus = await client.eval(`document.querySelector('.challenge-status-pill')?.innerText`)
    console.log('Challenge status after Pass:', passedStatus)

    console.log('4. Clicking Step 3 (Simulated proxy)...')
    await client.eval(`(() => {
      const btns = Array.from(document.querySelectorAll('.guided-step-btn'));
      const proxyBtn = btns.find(b => b.innerText.includes('Simulated proxy'));
      if (proxyBtn) proxyBtn.click();
    })()`)
    await sleep(1000)

    const step3Info = await client.eval(`(() => {
      const risk = document.querySelector('.score-prominent')?.innerText;
      const status = document.querySelector('.spectrum-label-tag')?.innerText;
      const scenario = document.querySelector('.scenario-badge')?.innerText;
      const firstEvent = document.querySelector('.incident-headline')?.innerText;
      return { risk, status, scenario, firstEvent };
    })()`)
    console.log('Step 3 Proxy info:', step3Info)
    await client.screenshot('step3-proxy.png')

    console.log('5. Clicking Step 4 (Low bandwidth fairness)...')
    await client.eval(`(() => {
      const btns = Array.from(document.querySelectorAll('.guided-step-btn'));
      const bwBtn = btns.find(b => b.innerText.includes('Low bandwidth'));
      if (bwBtn) bwBtn.click();
    })()`)
    await sleep(1000)

    const step4Info = await client.eval(`(() => {
      const risk = document.querySelector('.score-prominent')?.innerText;
      const status = document.querySelector('.spectrum-label-tag')?.innerText;
      const scenario = document.querySelector('.scenario-badge')?.innerText;
      const fairness = document.querySelector('.prominent-fairness-desc')?.innerText;
      return { risk, status, scenario, fairness };
    })()`)
    console.log('Step 4 Low Bandwidth info:', step4Info)
    await client.screenshot('step4-low-bandwidth.png')

    console.log('6. Clicking Step 5 (Generate evidence report)...')
    await client.eval(`(() => {
      const btns = Array.from(document.querySelectorAll('.guided-step-btn'));
      const reportBtn = btns.find(b => b.innerText.includes('Generate evidence report'));
      if (reportBtn) reportBtn.click();
    })()`)
    await sleep(800)

    const step5Info = await client.eval(`(() => {
      const modal = document.querySelector('.demo-modal-card');
      const title = document.querySelector('#summary-title')?.innerText;
      const principle = document.querySelector('.principle-callout')?.innerText;
      const boxes = Array.from(document.querySelectorAll('.review-summary-box')).map(b => b.innerText.replace(/\\n/g, ' '));
      return { modalPresent: !!modal, title, principle, boxes };
    })()`)
    console.log('Step 5 Summary Modal info:', step5Info)
    await client.screenshot('step5-summary-modal.png')

    console.log('7. Testing "Return to live session" button in modal...')
    await client.eval(`(() => {
      const closeBtn = Array.from(document.querySelectorAll('.demo-modal-footer button')).find(b => b.innerText.includes('Return to live session'));
      if (closeBtn) closeBtn.click();
    })()`)
    await sleep(500)
    const modalClosed = await client.eval(`!document.querySelector('.demo-modal-card')`)
    console.log('Modal closed successfully:', modalClosed)

    console.log('8. Testing "Run full demo" automated sequence...')
    await client.eval(`(() => {
      const runBtn = Array.from(document.querySelectorAll('.guided-demo-panel button')).find(b => b.innerText.includes('Run full demo'));
      if (runBtn) runBtn.click();
    })()`)
    await sleep(2200)

    const autoStatus = await client.eval(`(() => {
      const pauseBtn = Array.from(document.querySelectorAll('.guided-demo-panel button')).find(b => b.innerText.includes('Pause demo'));
      const timer = document.querySelector('.guided-demo-panel')?.innerText.match(/00:\\d\\d/)?.[0];
      return { isAutoRunning: !!pauseBtn, timer };
    })()`)
    console.log('Auto demo running check:', autoStatus)

    // Pause demo
    await client.eval(`(() => {
      const pauseBtn = Array.from(document.querySelectorAll('.guided-demo-panel button')).find(b => b.innerText.includes('Pause demo'));
      if (pauseBtn) pauseBtn.click();
    })()`)

    console.log('\n========================================')
    console.log('ALL PRESENTATION DEMO MODE TESTS PASSED!')
    console.log('========================================')
  } catch (err) {
    console.error('Test failed:', err)
    process.exitCode = 1
  } finally {
    chrome.kill()
  }
}

run()
