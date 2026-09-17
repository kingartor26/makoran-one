# IMPLEMENTATION PLAN — MAKORAN ONE & MAKORAN GUARD

## Overview & Execution Phasing

This plan details the step-by-step engineering trajectory to construct, verify, and deliver the Makoran One platform and Makoran Guard security system.

---

### Phase 1: Foundation (Core Server & Multi-Tenancy)
1. Initialize unified monorepo structure:
   - `server/` (Node.js/TypeScript Express + WebSocket server)
   - `agent/` (Node.js/TypeScript lightweight Edge Daemon)
   - `client/` (React + TypeScript + Tailwind CSS UI)
   - `shared/` (Common types, contracts, DTOs)
2. Database Schema & Migration Engine:
   - Tenants, Users, Roles, Permissions, Agents, Devices, Cameras, Events, Alarms, Rules, Faces, Plates, Notifications.
   - Seed initial default tenant, superadmin, operator, and sample device configurations.
3. Multi-Tenant Middleware & Authentication:
   - JWT authentication with tenant validation.
   - RBAC permission guards.
   - Audit logging middleware.
4. Agent Authentication & Registry APIs:
   - Device provisioning, pairing tokens, online/offline tracking.

---

### Phase 2: Makoran Agent (Linux Mini PC Daemon)
1. Agent Core Architecture:
   - Secure outbound WebSocket connection (`/ws/agent`).
   - Exponential backoff reconnection & connection watchdog.
   - System telemetry probe (CPU, RAM, Disk, Network, Uptime).
2. Modular CCTV Adapter Layer:
   - `CameraAdapter` base abstraction.
   - `RTSPAdapter` & `ONVIFAdapter` protocols.
   - `DahuaAdapter`, `HikvisionAdapter`, `XMEyeAdapter` wrappers.
   - `VirtualCameraAdapter` for realistic simulation in test environments.
3. Local Resiliency & Offline Buffer:
   - Embedded SQLite queue buffering snapshots/events when Internet drops.
   - Automatic background re-sync upon cloud reconnection.
4. Command Execution Engine:
   - Relay triggering, siren activation, buzzer commands.
   - Secure OTA updater with SHA256 integrity verification.

---

### Phase 3: Live View Plane (WebRTC On-Demand)
1. WebRTC Signaling Server:
   - SDP offer/answer exchange, ICE candidate relay.
   - Session manager tracking viewer presence.
2. Strict "No Request = No Stream" Lifecycle:
   - Client requests stream -> Server notifies Agent -> Agent opens camera feed and starts WebRTC.
   - Client disconnects or idles out -> Agent immediately terminates WebRTC and RTSP feed.
3. Client-Side WebRTC Player:
   - Video container with latency monitoring and automatic reconnection.

---

### Phase 4: Server-Side AI Pipeline & Gateway
1. Standardized AI Contract (`v1`):
   - Request schema: `request_id`, `tenant_id`, `camera_id`, `image_url` or base64.
   - Response schema: `detections`, `confidence`, `decision`, `bounding_boxes`.
2. Unified AI Gateway:
   - Priority queue (`CRITICAL`, `HIGH`, `NORMAL`, `LOW`).
   - Pluggable AI engine modules:
     * **Human Detection:** identifies persons with coordinates and confidence.
     * **Face Detection & Recognition:** extracts face regions, compares embeddings against Tenant Person DB (Known, VIP, Employee, Visitor, Blocked).
     * **Vehicle Detection:** classifies cars, trucks, motorcycles, vans.
     * **License Plate Recognition (LPR):** detects plate bounding box, runs OCR, queries Whitelist/Blacklist.
3. Snapshot Storage Service:
   - Local and S3-compatible file persistence with metadata linkage.

---

### Phase 5: Alarm System & Rule Engine
1. Configurable Security Rule Engine:
   - Conditional evaluation: `IF (Armed State == ARMED_AWAY && Event == human_detected && Zone == "perimeter" && Time In Schedule) THEN ALARM`.
   - Action triggers: `Agent.triggerRelay`, `PushNotification`, `SMS`, `PhoneCall`, `Webhook`.
2. Makoran Guard Security Controller:
   - Arming states: `DISARMED`, `ARMED_AWAY`, `ARMED_STAY`, `PANIC`.
   - Alarm lifecycle: `TRIGGERED`, `ACKNOWLEDGED`, `RESOLVED`, `SILENCED`.
3. Notification Engine:
   - Multi-channel notification dispatcher with pluggable SMS/Call adapters.

---

### Phase 6: Commercial SaaS Operations & Web Admin Console
1. Brand & Visual Identity Integration:
   - Embed official Makoran Service luxury gold emblem in navbar, login, hero, and favicon.
   - Refined dark theme (`#0c0d12`) with metallic gold accents.
2. Web Operations Center:
   - Real-time Dashboard with KPI counters and live event stream.
   - Live View Multi-Camera Grid with 1-click on-demand streaming.
   - Makoran Guard Security Console (Arm/Disarm controls, Alarm panel).
   - Camera & CCTV Manager (discovery, status, adapter selection, zones).
   - Mini PC Agent Manager (telemetry charts: CPU, RAM, Disk, OTA updates, command trigger).
   - Rule Engine Visual Designer.
   - Face Recognition & Person Management Directory.
   - Vehicle & License Plate Management Directory.
   - Event History & Audit Log with snapshot modal.
   - Multi-Tenant & RBAC User Management.
   - SaaS Subscriptions, Billing, and CRM Module.
3. Verification & Live Preview:
   - Automated end-to-end vertical slice tests.
   - Start server on `0.0.0.0:3000` with hot-reloading client for live browser preview.
