---
title: DMHA Smart Learning App
emoji: 🏫
colorFrom: slate
colorTo: green
sdk: docker
app_port: 7860
pinned: false
short_description: Full-stack School ERP, LMS, Finance & Campus Portal
---

# DMHA — Smart Learning App & Campus OS

Full-stack School ERP, Learning Management System, Double-Entry Accounting, Admissions, Attendance, Course Materials, Task Management, and Multi-Role Portal built with **Next.js 16 + React 19 + Node 24 `node:sqlite` + Tailwind CSS v4**.

## Demo Login Accounts (Password: `dmha2026`)

You can use the **1-Click Role Switch / Demo Login** on the sign-in screen or enter any of these credentials directly:


## Free 24/7 Cloud Deployment

### Option A — Cloudflare Workers + Durable Object SQLite (Free · 5 GB SQLite + Uploads · Global Edge)
1. Build the lean standalone Cloudflare OpenNext + Durable Object bundle:
   ```bash
   node scripts/cloudflare-build.mjs
   ```
2. Sign in to your Cloudflare account and deploy:
   ```bash
   cd .cf-build
   npx wrangler login
   npx wrangler deploy
   ```
3. Share your live HTTPS URL: `https://dmha-campus.<your-subdomain>.workers.dev`

### Option B — Hugging Face Spaces (Recommended · 2 vCPU · 16 GB RAM · Free)
1. Create a free Space at <https://huggingface.co/new-space> → choose **Docker → Blank** → set visibility to **Public** (so your boss can open it with zero Hugging Face login).
2. Push this folder (`c:\Users\smtkt\Downloads\DMHS`) to your Space Git repository.
3. Once built (~2 minutes), send your boss the clean direct full-screen link:
   `https://<your-hf-username>-<your-space-name>.hf.space`

### Option C — Render Free Web Service (via GitHub)
1. Push this folder to a GitHub repository.
2. In Render (<https://dashboard.render.com>), click **New → Blueprint** (reads `render.yaml` automatically) or **New → Web Service → Docker**.
3. Once deployed, share `https://<your-service>.onrender.com`.

## Health & API Endpoints
- Healthcheck: `GET /dmhs-api/health`
- Auth & Sessions: `/dmhs-api/auth`
- Live Campus State & SSE Sync: `/dmhs-api/state` & `/dmhs-api/stream`
- Dynamic Uploads: `POST /dmhs-api/uploads` & `GET /dmhs-api/uploads/:folder/:filename`
