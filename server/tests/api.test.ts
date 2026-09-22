import test from 'node:test'
import assert from 'node:assert'
import request from 'supertest'
import { app } from '../src/app.js'
import { calculateRiskScore } from '../src/scoring/riskScorer.js'

test('PRAMAAN Backend Test Suite', async (t) => {
  let recruiterToken = ''
  let createdSessionId = ''
  let candidateInviteToken = ''
  let createdChallengeId = ''

  // 1. Health endpoint
  await t.test('GET /health returns 200 and status ok', async () => {
    const res = await request(app).get('/health')
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.body.status, 'ok')
    assert.strictEqual(res.body.product, 'PRAMAAN Integrity Backend')
  })

  // 2. Demo Login
  await t.test('POST /api/auth/demo-login returns token and recruiter user', async () => {
    const res = await request(app)
      .post('/api/auth/demo-login')
      .send({
        email: 'recruiter@pramaan.demo',
        name: 'Demo Recruiter',
      })
    assert.strictEqual(res.status, 200)
    assert.ok(res.body.token)
    assert.strictEqual(res.body.user.email, 'recruiter@pramaan.demo')
    assert.strictEqual(res.body.user.role, 'RECRUITER')
    recruiterToken = res.body.token
  })

  // 3. Recruiter Access Control
  await t.test('GET /api/sessions without auth returns 401', async () => {
    const res = await request(app).get('/api/sessions')
    assert.strictEqual(res.status, 401)
  })

  // 4. Session Creation
  await t.test('POST /api/sessions creates an interview session with candidate token', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({
        candidateName: 'Candidate #CX0104',
        candidateEmail: 'cx0104@example.com',
        candidateRole: 'Junior Frontend Engineer',
        interviewStage: 'Technical Round 1',
      })
    assert.strictEqual(res.status, 201)
    assert.ok(res.body.id)
    assert.ok(res.body.publicId)
    assert.ok(res.body.candidateInviteUrl)
    assert.ok(res.body.token)
    createdSessionId = res.body.id
    candidateInviteToken = res.body.token
  })

  // 5. Session Fetching
  await t.test('GET /api/sessions/:sessionId returns session details', async () => {
    const res = await request(app)
      .get(`/api/sessions/${createdSessionId}`)
      .set('Authorization', `Bearer ${recruiterToken}`)
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.body.session.id, createdSessionId)
    assert.strictEqual(res.body.session.status, 'CREATED')
  })

  // 6. Candidate Access Restrictions (Candidate cannot access recruiter sessions list)
  await t.test('Candidate token cannot access GET /api/sessions list', async () => {
    const res = await request(app)
      .get('/api/sessions')
      .set('Authorization', `Bearer ${candidateInviteToken}`)
    assert.strictEqual(res.status, 401)
  })

  // 7. Start Session
  await t.test('POST /api/sessions/:sessionId/start starts session', async () => {
    const res = await request(app)
      .post(`/api/sessions/${createdSessionId}/start`)
      .set('Authorization', `Bearer ${recruiterToken}`)
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.body.session.status, 'ACTIVE')
  })

  // 8. Consent Recording
  await t.test('POST /api/sessions/:sessionId/consent records candidate consent', async () => {
    const res = await request(app)
      .post(`/api/sessions/${createdSessionId}/consent`)
      .set('Authorization', `Bearer ${candidateInviteToken}`)
      .send({
        cameraConsent: true,
        microphoneConsent: true,
        signalProcessingConsent: true,
        consentVersion: 'v1',
      })
    assert.strictEqual(res.status, 201)
    assert.strictEqual(res.body.consent.cameraConsent, true)
    assert.strictEqual(res.body.consent.signalProcessingConsent, true)
  })

  // 9. Raw Media Rejection Privacy Test
  await t.test('POST /api/sessions/:sessionId/signals rejects raw media uploads', async () => {
    const res = await request(app)
      .post(`/api/sessions/${createdSessionId}/signals`)
      .set('Authorization', `Bearer ${candidateInviteToken}`)
      .send({
        faceMotionScore: 94,
        lipSyncScore: 96,
        video: 'data:video/mp4;base64,AAAA...', // Forbidden raw media
      })
    assert.strictEqual(res.status, 400)
    assert.ok(res.body.error)
    assert.match(res.body.details[0].message, /Privacy policy violation/i)
  })

  // 10. Valid Signal Telemetry Ingestion
  await t.test('POST /api/sessions/:sessionId/signals accepts valid numeric signals', async () => {
    const res = await request(app)
      .post(`/api/sessions/${createdSessionId}/signals`)
      .set('Authorization', `Bearer ${candidateInviteToken}`)
      .send({
        faceMotionScore: 94,
        lipSyncScore: 96,
        challengeScore: 100,
        streamQualityScore: 92,
        visualEvidenceAvailable: true,
        audioEvidenceAvailable: true,
      })
    assert.strictEqual(res.status, 201)
    assert.ok(res.body.signals)
    assert.strictEqual(res.body.riskStatus, 'LOW_RISK')
  })

  // 11. Challenge Creation
  await t.test('POST /api/sessions/:sessionId/challenges creates random challenge', async () => {
    const res = await request(app)
      .post(`/api/sessions/${createdSessionId}/challenges`)
      .set('Authorization', `Bearer ${recruiterToken}`)
    assert.strictEqual(res.status, 201)
    assert.ok(res.body.challenge.id)
    assert.ok(res.body.challenge.prompt)
    createdChallengeId = res.body.challenge.id
  })

  // 12. Challenge Result Submission
  await t.test('POST /api/challenges/:challengeId/result records verification outcome', async () => {
    const res = await request(app)
      .post(`/api/challenges/${createdChallengeId}/result`)
      .set('Authorization', `Bearer ${candidateInviteToken}`)
      .send({
        result: 'PASSED',
        responseDurationMs: 4100,
      })
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.body.challenge.status, 'PASSED')
    assert.strictEqual(res.body.challengeScore, 100)
  })

  // 13. Scenario Switching (Proxy / Face-Swap)
  await t.test('POST /api/sessions/:sessionId/scenario switches to PROXY scenario', async () => {
    const res = await request(app)
      .post(`/api/sessions/${createdSessionId}/scenario`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ scenario: 'PROXY' })
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.body.scenario, 'PROXY')
    assert.strictEqual(res.body.riskStatus, 'REVIEW_RECOMMENDED')
    assert.ok(res.body.riskScore >= 65)
  })

  // 14. Scenario Switching (Low Bandwidth Fairness Check)
  await t.test('POST /api/sessions/:sessionId/scenario switches to LOW_BANDWIDTH with fairness', async () => {
    const res = await request(app)
      .post(`/api/sessions/${createdSessionId}/scenario`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ scenario: 'LOW_BANDWIDTH' })
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.body.scenario, 'LOW_BANDWIDTH')
    assert.strictEqual(res.body.riskStatus, 'INSUFFICIENT_EVIDENCE')
    assert.strictEqual(res.body.confidence, 'LOW')
    assert.match(res.body.explanation, /Poor video quality lowers confidence/i)
  })

  // 15. Evidence Timeline Retrieval & Filtering
  await t.test('GET /api/sessions/:sessionId/events returns timeline events', async () => {
    const res = await request(app)
      .get(`/api/sessions/${createdSessionId}/events?filter=all`)
      .set('Authorization', `Bearer ${recruiterToken}`)
    assert.strictEqual(res.status, 200)
    assert.ok(Array.isArray(res.body.events))
    assert.ok(res.body.events.length > 0)
  })

  // 16. Forensic Evidence Export
  await t.test('GET /api/sessions/:sessionId/events/export returns downloadable audit payload', async () => {
    const res = await request(app)
      .get(`/api/sessions/${createdSessionId}/events/export`)
      .set('Authorization', `Bearer ${recruiterToken}`)
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.body.product, 'PRAMAAN Interview Integrity Layer')
    assert.ok(res.body.privacyGuarantees.browserSideProcessing)
    assert.strictEqual(res.body.privacyGuarantees.rawVideoStored, false)
  })

  // 17. Report Generation & Retrieval
  await t.test('POST /api/sessions/:sessionId/report compiles final report', async () => {
    const res = await request(app)
      .post(`/api/sessions/${createdSessionId}/report`)
      .set('Authorization', `Bearer ${recruiterToken}`)
    assert.strictEqual(res.status, 201)
    assert.ok(res.body.report.id)
    assert.ok(res.body.report.reportData.disclaimer)

    // Retrieve report by ID
    const getRes = await request(app)
      .get(`/api/reports/${res.body.report.id}`)
      .set('Authorization', `Bearer ${recruiterToken}`)
    assert.strictEqual(getRes.status, 200)
    assert.strictEqual(getRes.body.report.id, res.body.report.id)
  })

  // 18. Unit Test: Risk Scorer Pure Logic
  await t.test('Scoring Engine enforces low-bandwidth fairness invariant', () => {
    const normal = calculateRiskScore({
      faceMotionScore: 94,
      lipSyncScore: 96,
      challengeScore: 100,
      streamQualityScore: 92,
    })
    assert.strictEqual(normal.riskStatus, 'LOW_RISK')
    assert.strictEqual(normal.confidence, 'HIGH')

    const lowBw = calculateRiskScore({
      faceMotionScore: null,
      lipSyncScore: 86,
      challengeScore: 100,
      streamQualityScore: 24,
      visualEvidenceAvailable: false,
    })
    assert.strictEqual(lowBw.riskStatus, 'INSUFFICIENT_EVIDENCE')
    assert.strictEqual(lowBw.confidence, 'LOW')
    assert.match(lowBw.explanation, /Poor video quality lowers confidence/i)
  })
})
