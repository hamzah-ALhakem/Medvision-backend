# MedVision Backend API 

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

> **Live API URL:** [https://medvision-backend.vercel.app](https://medvision-backend.vercel.app)

##  About The Project
This repository contains the backend infrastructure for **MedVision**, an intelligent bilingual breast cancer screening and patient management system. 

Built with a strict **Decoupled Architecture**, this backend operates as a **Stateless RESTful API**. It is designed to handle user authentication, role-based access control (RBAC), appointment state machines, real-time telemedicine chat, and a highly secure "Zero-Trust" data synchronization protocol.

##  Core Features
* **Stateless RESTful Architecture:** Built with Node.js and Express.js, utilizing JWTs for session management to ensure horizontal scalability.
* **Controlled Appointment State Machine:** Manages consultations seamlessly from `PENDING` to `CONFIRMED` or `CANCELLED`.
* **Zero-Trust Data Sync:** A privacy-by-default workflow where doctors are cryptographically blocked from viewing patient AI screening results unless a `CONFIRMED` appointment exists between them.
* **Real-Time Telemedicine:** Full-duplex WebSocket communication via **Pusher** for instant, low-latency messaging between patients and doctors.
* **Dynamic Role-Based Provisioning:** Asymmetric onboarding where patients activate immediately via email verification, while doctors default to a restricted `PENDING` state requiring Administrator approval.

##  Security Arsenal
Security was a primary engineering objective. The API is fortified with 15 distinct security controls, achieving a 100% pass rate across 271 automated backend tests:
- **JWT Authentication** & **Bcrypt** Password Hashing (10 salt rounds).
- **Helmet.js** for HTTP header security & strict **CORS** whitelisting.
- **IP-Based Rate Limiting** & **Per-Account Login Lockout** (after 5 failed attempts).
- **Session Invalidation:** Automatically invalidates all active JWTs upon password change via a `tokenVersion` mechanism.
- **Injection Defense:** 100% parameterized queries enforced by **Prisma ORM**.

##  Tech Stack
* **Runtime:** Node.js
* **Framework:** Express.js
* **Database:** PostgreSQL (Hosted on Supabase)
* **ORM:** Prisma
* **Real-Time WebSockets:** Pusher SDK
* **Testing:** Jest, Supertest
* **Deployment:** Vercel (Serverless Functions)

##  Local Setup & Installation

To run this API locally for development or testing, follow these steps:

**1. Clone the repository:**
```bash
git clone [https://github.com/YOUR_GITHUB_USERNAME/medvision-backend.git](https://github.com/YOUR_GITHUB_USERNAME/medvision-backend.git)
cd medvision-backend
