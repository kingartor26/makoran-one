# PROJECT AUDIT — MAKORAN ONE & MAKORAN GUARD

**Date:** 2026-09-17  
**Auditor:** Lead Software Architect & Systems Engineer  
**Project:** Makoran One / Makoran Guard  
**Repository:** `kingartor26/makoran-one`  
**Current Branch:** `arena/01a0adaf-makoran-one` (Branched from commit `4066b5e8fac3b4c0c2252c379ffc6e961445b3dd`)

---

## Executive Summary

The repository was initialized as a greenfield project with a single initial commit containing an empty `README.md` (`# makoran-one`). No prior backend, frontend, agent, or database code exists in the repository.

This audit provides a comprehensive baseline analysis across the 17 specified engineering dimensions, establishes the structural gap analysis, and defines the roadmap to build the enterprise-grade, server-centric SaaS platform **Makoran One** and its flagship security product **Makoran Guard**.

---

## 17-Point Detailed Technical Audit

### 1. Current Backend Architecture
* **Status:** Non-existent (Greenfield).
* **Finding:** No backend services, framework, or HTTP/WebSocket servers are configured.
* **Requirement:** Server-centric modular architecture serving as the "Brain" of the platform (`AI + Decision + Rules + Events + Notifications + Data + SaaS`). Needs unified REST API (`/api/v1/`), Agent Control Plane WebSocket, and WebRTC Signaling Gateway.

### 2. Current Frontend Architecture
* **Status:** Non-existent (Greenfield).
* **Finding:** No UI framework or web assets exist.
* **Requirement:** High-performance, responsive Single Page Application (SPA) supporting both Desktop Operations Center and Mobile viewports. Must integrate the official Makoran Service gold emblem branding, Live View grid with on-demand WebRTC, Guard arming controls, AI detection feeds, Rule Engine designer, CCTV manager, Agent health metrics, Face/Plate databases, and Tenant administration.

### 3. Current Mobile Architecture
* **Status:** Non-existent.
* **Requirement:** Responsive mobile PWA / web-app interface with touch-friendly controls, quick arm/disarm toggle, push notifications, and on-demand Live View with automatic idle timeout.

### 4. Current Database
* **Status:** Non-existent.
* **Requirement:** Multi-tenant relational data model with strict tenant isolation. Entities: `Tenant`, `Organization`, `User`, `Role`, `Customer`, `Agent`, `Device`, `Camera`, `Event`, `Alarm`, `AlarmRule`, `Face`, `Person`, `Vehicle`, `LicensePlate`, `Notification`, `Subscription`, `Invoice`, `Attendance`, and `AuditLog`.

### 5. Current Agent Implementation
* **Status:** Non-existent.
* **Requirement:** Lightweight Linux Agent/Gateway designed for low-power Mini PCs (Intel N100/N95, 8GB RAM, Gigabit Ethernet). **Absolute Rule: NO heavy AI on the Agent**. Responsibilities: Secure outbound connection to Cloud, camera discovery, snapshot capture, event upload, command receipt & execution (relay/siren), on-demand WebRTC live streaming, offline queue buffer, and secure OTA updates.

### 6. Current CCTV Integrations
* **Status:** Non-existent.
* **Requirement:** Modular adapter architecture (`CameraAdapter` interface) supporting standard protocols and major vendors:
  - `ONVIFAdapter` (Standard IP camera discovery and control)
  - `RTSPAdapter` (Universal H.264/H.265 stream and snapshot ingestion)
  - `XMEyeAdapter` (Xiongmai / NetSurveillance protocol)
  - `DahuaAdapter` (Dahua DVR/NVR/IPC integration)
  - `HikvisionAdapter` (Hikvision ISAPI / DVR integration)
  - `VirtualCameraAdapter` (Simulated camera for automated testing and sandbox demonstration)

### 7. Current APIs
* **Status:** Non-existent.
* **Requirement:** Versioned RESTful API (`/api/v1/`):
  - `/api/v1/auth` (Login, Refresh, 2FA, Profile)
  - `/api/v1/tenants` (Tenant management, quotas)
  - `/api/v1/agents` (Registration, status, command dispatch, heartbeat, metrics)
  - `/api/v1/cameras` (CRUD, discovery, channels, zones)
  - `/api/v1/ai` (Snapshot ingestion, human/face/vehicle/plate detection gateway)
  - `/api/v1/events` (Event stream, search, filtering)
  - `/api/v1/alarms` (Alarm state, acknowledgment, resolution)
  - `/api/v1/rules` (Rule engine CRUD, arming state)
  - `/api/v1/faces` & `/api/v1/plates` (Whitelist/Blacklist registry)
  - `/api/v1/notifications` (Channels, history, test dispatch)
  - `/api/v1/webrtc` (Live view signaling sessions)
  - `/api/v1/billing` & `/api/v1/crm` (Commercial SaaS features)

### 8. Current Authentication
* **Status:** Non-existent.
* **Requirement:** Secure JWT-based authentication with bcrypt password hashing, tenant context enforcement on every request, Role-Based Access Control (RBAC: `SuperAdmin`, `TenantAdmin`, `Operator`, `Viewer`), and mutual token authentication for Edge Agents.

### 9. Current WebRTC Implementation
* **Status:** Non-existent.
* **Requirement:** Strict "No Request = No Stream" on-demand architecture. Signaling server exchanges SDP offers/answers and ICE candidates over WebSocket/REST. Session tracking with automatic teardown on client disconnect or idle timeout.

### 10. Current AI Implementation
* **Status:** Non-existent.
* **Requirement:** Server-side unified AI Gateway with prioritized inference pipeline (`CRITICAL`, `HIGH`, `NORMAL`, `LOW`). Standard JSON contracts for:
  - Human Detection (confidence, bounding box)
  - Face Detection & Recognition (embedding comparison against Tenant Face DB)
  - Vehicle Detection (type classification: car, truck, motorcycle, van)
  - License Plate Recognition (OCR + whitelist/blacklist match)

### 11. Current Notification Implementation
* **Status:** Non-existent.
* **Requirement:** Multi-channel notification engine abstracting providers:
  - Push Notifications (Web Push / Mobile)
  - SMS (Pluggable provider interface: Kavenegar, Twilio, Generic HTTP Webhook)
  - Automated Phone Calls (TTS / Alarm alert)
  - Webhooks (Integrations with external systems)

### 12. Deployment Architecture
* **Status:** Non-existent.
* **Requirement:** Docker and Docker Compose configuration for multi-service deployment (`makoran-cloud`, `makoran-agent`, `postgres`, `redis`, `minio/storage`). Support for standalone Linux deployment via systemd service units for the Edge Agent.

### 13. Security Weaknesses
* **Identified Risks to Prevent:**
  - Insecure Agent-to-Server communication (must enforce TLS + device auth tokens).
  - Cross-tenant data leaks (must enforce strict server-side tenant filtering).
  - Open inbound ports on customer Mini PC (Agent must initiate all connections outbound; no port forwarding).
  - Heavy local processing crashing the Mini PC (strict ban on local AI models).
  - Unverified OTA firmware updates (must mandate checksum and signature verification).

### 14. Missing Components
* **Entire stack needs creation:** Cloud Backend, Database Schema, Agent Daemon, CCTV Adapters, AI Gateway, Rule Engine, Notification Service, WebRTC Signaling, Web Admin UI, and Test Suite.

### 15. Duplicate Components
* **Status:** None (Clean slate).

### 16. Broken Components
* **Status:** None (Clean slate).

### 17. Technical Debt
* **Status:** Zero legacy debt. Full freedom to implement clean, modern, type-safe, production-ready code with TypeScript, robust validation (Zod/Joi), automated tests, and modular architecture.

---

## Prioritized Implementation Roadmap

1. **Phase 1 — Foundation:** Multi-tenant core, DB schema, JWT auth, RBAC, Agent registration, and Camera registry.
2. **Phase 2 — Makoran Agent:** Linux daemon with outbound WebSocket, camera adapters, snapshot capture, command executor, and offline queue.
3. **Phase 3 — Live View Plane:** WebRTC signaling engine with strict on-demand lifecycle ("No User Request = No Stream").
4. **Phase 4 — AI Ingestion Pipeline:** Server-side AI Gateway (Human, Face, Vehicle, LPR) with priority queue and standard v1 contracts.
5. **Phase 5 — Alarm & Rule Engine:** Server-side rule evaluator, armed state management, relay/siren dispatch to Agent, and multi-channel notifications.
6. **Phase 6 — Commercial SaaS & Admin Operations:** Full Web UI with Makoran luxury gold emblem, real-time dashboards, billing, CRM, audit logs, and live preview.
