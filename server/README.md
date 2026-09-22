# PRAMAAN Backend — Interview Integrity Layer

A production-grade, hackathon-ready Node.js/TypeScript backend powering the **PRAMAAN** browser-first interview integrity system.

## Core Architectural Thesis
> *“A fake face can fool a frame. It is harder to fool an entire live interaction.”*

### Strict Privacy Guarantee
PRAMAAN never ingests, records, or stores raw candidate video or audio. The browser performs all computer vision and acoustic landmark analysis client-side, transmitting **only lightweight derived telemetry** (face motion variance, lip-sync alignment, live challenge outcomes, and network quality).

---

## Tech Stack
- **Runtime**: Node.js v20+ / v24
- **Language**: TypeScript (ES2022 / NodeNext)
- **Framework**: Express.js
- **Database / ORM**: Prisma ORM with SQLite for local development (PostgreSQL-compatible schema)
- **Realtime**: Socket.IO for live session telemetry, challenges, and risk updates
- **Validation**: Zod (strict schema validation with raw media rejection)
- **Security**: Helmet, CORS allowlisting, Rate limiting, JWT bearer authentication

---

## Getting Started

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```
Default `.env` configuration:
```env
PORT=5001
NODE_ENV=development
DATABASE_URL="file:./dev.db"
JWT_SECRET="pramaan-hackathon-super-secret-jwt-key-2026"
CORS_ORIGIN="http://localhost:3000"
FRONTEND_URL="http://localhost:3000"
```

### 3. Initialize & Seed Database
```bash
npm run db:migrate
npm run db:seed
```
This initializes the SQLite database (`dev.db`) and seeds the default recruiter (`recruiter@pramaan.demo`) and active session (`PRM-CX0104`).

### 4. Run Development Server
```bash
npm run dev
```
The server will start on `http://localhost:5001` with Socket.IO enabled.

### 5. Run Automated Tests
```bash
npm test
```
Executes the comprehensive 19-assertion integration test suite covering auth, sessions, consent, signals, risk scoring, fairness invariants, and reports.

---

## API Documentation

### Authentication
- `POST /api/auth/demo-login` — Recruiter demo login. Returns signed JWT.
- `POST /api/auth/logout` — Revokes session.
- `GET /api/auth/me` — Returns authenticated user profile.

### Sessions
- `POST /api/sessions` — Create an interview session (generates candidate invite link).
- `GET /api/sessions` — List recruiter-managed sessions.
- `GET /api/sessions/:sessionId` — Fetch session state, latest signals, and recent events.
- `PATCH /api/sessions/:sessionId/status` — Update session status (`ACTIVE`, `PAUSED`, `ENDED`).
- `POST /api/sessions/:sessionId/start` — Start the interview and emit baseline events.
- `POST /api/sessions/:sessionId/end` — Conclude session and auto-generate final report.
- `POST /api/sessions/:sessionId/consent` — Record candidate biometric consent.
- `POST /api/sessions/:sessionId/scenario` — Switch demo scenario (`NORMAL`, `PROXY`, `LOW_BANDWIDTH`).

### Signal Telemetry
- `POST /api/sessions/:sessionId/signals` — Ingest numeric signal snapshot (0-100 scores).
  - *Strictly rejects any request containing raw media fields (`video`, `audio`, `frame`, `blob`, `base64`).*
  - Automatically runs the server-side scoring engine and broadcasts `signal:update` and `risk:update`.

### Challenges
- `POST /api/sessions/:sessionId/challenges` — Dispatch a randomized live presence prompt.
- `POST /api/challenges/:challengeId/result` — Submit candidate evaluation (`PASSED`, `PARTIAL`, `FAILED`).

### Evidence & Reports
- `GET /api/sessions/:sessionId/events` — Fetch timeline events with filtering (`all`, `warning`, `verified`, `system`).
- `POST /api/sessions/:sessionId/events` — Append an approved timeline event.
- `GET /api/sessions/:sessionId/events/export` — Download full JSON evidence log.
- `POST /api/sessions/:sessionId/report` — Generate forensic audit report.
- `GET /api/reports/:reportId` — Retrieve generated report by ID.

---

## Realtime Socket.IO Events

Clients connect and join rooms scoped by session: `session:${sessionId}`.

| Event Name | Direction | Payload |
|---|---|---|
| `session:joined` | Server → Room | `{ socketId, role, timestamp }` |
| `session:status` | Server → Room | `{ status, startedAt }` |
| `consent:recorded`| Server → Room | `{ consentRecord }` |
| `signal:update` | Server → Room | `{ signals, riskScore, riskStatus }` |
| `challenge:issued`| Server → Room | `{ id, prompt, expiresAt }` |
| `challenge:result`| Server → Room | `{ challenge, challengeScore, riskScore }`|
| `integrity:event` | Server → Room | `{ event }` |
| `risk:update` | Server → Room | `{ riskScore, riskStatus, confidence }` |
| `scenario:changed`| Server → Room | `{ scenario, riskScore, signals }` |
| `session:ended` | Server → Room | `{ reportId }` |
