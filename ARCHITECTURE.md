# SYSTEM ARCHITECTURE — MAKORAN ONE & MAKORAN GUARD

## 1. Architectural Philosophy

Makoran One is an enterprise, multi-tenant SaaS platform built on the principle of **Server-Centric Intelligence**:

```
┌────────────────────────────────────────────────────────┐
│                   MAKORAN CLOUD                        │
│                   SERVER = BRAIN                       │
│  [AI Gateway] [Rule Engine] [Alarm Decision] [SaaS]    │
│  [WebRTC Signaling] [Notifications] [Multi-Tenancy]    │
└──────────────────────────▲─────────────────────────────┘
                           │
             Outbound TLS WebSocket / HTTPS
             (Zero Inbound Ports on Customer Side)
                           │
┌──────────────────────────▼─────────────────────────────┐
│                   MAKORAN AGENT                        │
│                  MINI PC = GATEWAY                     │
│  (Intel N100/N95 Linux Mini PC - Low Power, 24/7)      │
│  [Connection] [Capture] [Upload] [Execute] [WebRTC]    │
│  * ABSOLUTE RULE: NO HEAVY AI INFERENCE ON AGENT *     │
└────────────┬─────────────┬─────────────┬───────────────┘
             │             │             │
        ┌────▼───┐    ┌────▼───┐    ┌────▼───┐
        │  DVR   │    │  NVR   │    │ IP CAM │
        └────────┘    └────────┘    └────────┘
```

---

## 2. Component Architecture

### A. Makoran Cloud (The Brain)
* **API Gateway & Control Plane:**
  - Route all REST endpoints (`/api/v1/*`).
  - Persistent WebSocket gateway for Agent control, heartbeats, and client real-time updates.
* **Multi-Tenant Data Layer:**
  - Strict tenant isolation: every query scopes to `tenant_id`.
  - Roles: `SUPERADMIN`, `ORG_ADMIN`, `OPERATOR`, `VIEWER`.
* **Server-Side AI Gateway:**
  - Unified processing pipeline accepting snapshot requests.
  - Pluggable AI engines:
    1. **Human Detection** (confidence, bounding box)
    2. **Face Detection & Recognition** (matching against tenant biometric profile DB)
    3. **Vehicle Detection** (car, truck, bus, motorcycle, van)
    4. **License Plate Recognition (LPR)** (plate reading + list checking)
  - Priority Queue: `CRITICAL` (Alarm zones), `HIGH` (Perimeters), `NORMAL` (General), `LOW` (Batch/Audit).
* **Rule & Alarm Engine:**
  - Evaluates system state (`ARMED_AWAY`, `ARMED_STAY`, `DISARMED`), schedule, camera zone, and detection parameters.
  - Server decides whether an alarm is confirmed.
  - Sends immediate commands to Agent (e.g. `trigger_relay`, `siren_on`, `buzzer_pulse`).
* **Multi-Channel Notification Engine:**
  - Push Notifications, SMS, Automated Calls, Webhooks.
* **On-Demand WebRTC Signaling Service:**
  - Negotiates WebRTC peer connections between client browsers and Edge Agents.
  - Monitors session state with automatic idle timeouts.

---

### B. Makoran Agent (The Edge Gateway)
* **Target Hardware:**
  - Intel N100 / N95 Mini PC, 8GB DDR4/DDR5, 128GB+ SSD, Gigabit NIC, Debian/Ubuntu Linux.
* **Strict Lightweight Guarantee:**
  - No CUDA, no PyTorch, no local heavy neural networks.
  - CPU usage stays < 15% during normal operations.
* **Modular CCTV Adapters:**
  - `CameraAdapter` interface:
    - `connect()`
    - `disconnect()`
    - `getChannels()`
    - `getSnapshot(channelId)`
    - `getStream(channelId)`
    - `getEvents()`
    - `getDeviceInfo()`
  - Concrete implementations: `ONVIFAdapter`, `RTSPAdapter`, `DahuaAdapter`, `HikvisionAdapter`, `XMEyeAdapter`, and `VirtualCameraAdapter`.
* **Outbound Connection & Resiliency:**
  - Connects out to Cloud via WSS / HTTPS.
  - Works behind NAT / CGNAT without port forwarding or static IP.
  - Heartbeat watchdog (CPU, RAM, Disk, Network, Camera states).
  - Exponential backoff reconnection.
  - Local SQLite queue to buffer events & snapshots during Internet blackouts; syncs on reconnection.
* **Command Executor:**
  - Executes server directives (GPIO relays, siren activation, camera preset moves, reboot, OTA upgrade).
* **On-Demand WebRTC Streamer:**
  - Spins up RTSP-to-WebRTC pipeline ONLY when signaling indicates an active live viewer.
  - Immediately tears down stream and releases hardware decoding resources when the viewer leaves.

---

## 3. Communication Planes

### 1. Control Plane (Always Active)
* Outbound WebSocket from Agent to Server (`/ws/agent`).
* Heartbeat interval: default 15s.
* Commands, event notifications, health telemetry, and configuration pushes.

### 2. Media Plane (On-Demand Only)
* **Rule:** `NO USER REQUEST = NO LIVE STREAM`.
* Client initiates Live View request via Cloud API.
* Cloud sends `webrtc_start_stream` signal to Agent.
* Agent initiates WebRTC peer connection (using configured STUN/TURN servers) and streams directly to user (or through TURN if direct peer-to-peer fails).
* On client exit or timeout, `webrtc_stop_stream` is triggered, immediately terminating the stream.

### 3. AI Data Plane (Snapshot Driven)
* Agent captures JPEG snapshot triggered by motion, schedule, or external sensor.
* Uploads via secure multipart/JSON to Cloud AI Gateway.
* Cloud processes inference, runs Rule Engine, logs immutable event, and triggers actions.

---

## 4. Security & Compliance
* **Transport:** TLS 1.3 enforced on all external endpoints.
* **Agent Auth:** Unique Device ID + cryptographically signed Hardware Token.
* **User Auth:** JWT with short lifespan + sliding refresh + bcrypt password hashing.
* **Data Isolation:** All database tables enforce `tenant_id` foreign keys with query-level middleware checks.
* **Biometric Privacy:** Configurable retention periods for face embeddings; no unnecessary raw biometric data stored indefinitely.
* **Audit Trail:** Immutable append-only log for all security events, arm/disarm actions, and camera accesses.
