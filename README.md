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

| Role | Login Code | Email | Portal Highlights |
|---|---|---|---|
| **Principal / Admin** | `DEV-001` or `ADM-001` | `dev@dmha.edu` | Executive Overview, Admissions, Double-Entry Accounting, Payroll, Task Delegation, Promotion |
| **Teacher** | `TCH-001` | `nadia@dmha.edu` | Course Materials ↔ Homework Bridge, Attendance, Marks, Assigned Tasks, Faculty Finance |
| **Office Staff (Accounts)** | `STF-ACC` | `rafiqul@dmha.edu` | Fee Collection, Vouchers, Quick Costs, Payroll, Assigned Tasks |
| **Guardian** | `GRD-001` | `tariq@dmha.edu` | Child Attendance, Homework & Attachments, Online Fee Checkout, Leaves, Messaging |
| **Student** | `STU-14` | `araf@dmha.edu` | Subject/Chapter Course Materials, Quizzes, Homework Uploads, Digital ID |

## Free 24/7 Cloud Deployment

### Option A — Hugging Face Spaces (Recommended · 2 vCPU · 16 GB RAM · Free)
1. Create a free Space at <https://huggingface.co/new-space> → choose **Docker → Blank** → set visibility to **Public** (so your boss can open it with zero Hugging Face login).
2. Push this folder (`c:\Users\smtkt\Downloads\DMHS`) to your Space Git repository.
3. Once built (~2 minutes), send your boss the clean direct full-screen link:
   `https://<your-hf-username>-<your-space-name>.hf.space`

### Option B — Render Free Web Service (via GitHub)
1. Push this folder to a GitHub repository.
2. In Render (<https://dashboard.render.com>), click **New → Blueprint** (reads `render.yaml` automatically) or **New → Web Service → Docker**.
3. Once deployed, share `https://<your-service>.onrender.com`.

## Health & API Endpoints
- Healthcheck: `GET /dmhs-api/health`
- Auth & Sessions: `/dmhs-api/auth`
- Live Campus State & SSE Sync: `/dmhs-api/state` & `/dmhs-api/stream`
- Dynamic Uploads: `POST /dmhs-api/uploads` & `GET /dmhs-api/uploads/:folder/:filename`
