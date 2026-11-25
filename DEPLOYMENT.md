# DMHA — Smart Learning App · Go-Live Production Deployment Guide

## 1. Architecture Summary
- **Unified Stack:** Next.js 16 + React 19 + TypeScript + Tailwind CSS v4 + Payload CMS
- **Database:** Built-in SQLite 3 (WAL mode, `data/dmhs.sqlite`) for instant single-server deployment, or PostgreSQL (`DATABASE_URL`) for multi-region cloud scale.
- **Security:** Salted `scrypt` password hashing, `HttpOnly; SameSite=Lax` sessions, W3C WebAuthn Guardian Biometrics (Face ID / Fingerprint / Windows Hello), and Server-Enforced School Wi-Fi IP Check-In.
- **Realtime:** Native Server-Sent Events (`/dmhs-api/stream`) interconnecting Office Desktops & Mobile Phones live.

## 2. Recommended Hosting Options
### Option A — Single-Campus Cloud VPS / Railway / Render (Fastest — Keeps SQLite + SSE Live!)
1. Deploy on **Railway**, **Render**, or a **Ubuntu VPS (DigitalOcean / Hetzner)** with a persistent volume mounted at `/app/data` and `/app/public/uploads`.
2. Attach your custom HTTPS domain (e.g., `https://portal.dmha.edu.bd`) — HTTPS is automatically provisioned via Let's Encrypt / Railway SSL and unlocks:
   - **WebAuthn Face ID & Fingerprint** on iOS Safari & Android Chrome
   - **Phone Camera QR ID Scanner** & **Exam Sheet Camera Capture**
   - **Installable Desktop & Mobile PWA**
3. Set environment variables from `env.example` for live **SSLCommerz (bKash/Nagad/Cards)**, **Twilio WhatsApp/SMS** or **BulkSMS BD**, and **Cloudflare R2**.

### Option B — School Office On-Premise Server + Cloudflare Tunnel
1. Run `pnpm build && pnpm start` on a dedicated DMHA office PC running Node.js 24.
2. Expose safely via **Cloudflare Tunnel** (`cloudflared tunnel`) to get free HTTPS + DDoS protection with zero router port-forwarding!
3. Set your office router's public IP inside **Admin → Teacher HR & Wi-Fi → Official School Wi-Fi Allowlist** so teachers can only check in on campus Wi-Fi.

## 3. Daily Backup Routine
- Open **Admin → Go-Live & Cloud** and click **Download Full SQLite Backup (JSON)**, or schedule a nightly cron job fetching `GET /dmhs-api/backup`.
