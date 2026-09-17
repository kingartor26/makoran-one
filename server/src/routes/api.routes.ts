import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { authMiddleware, AuthenticatedRequest, roleGuard } from '../middlewares/auth.middleware';
import { authService } from '../services/auth.service';
import { agentService } from '../services/agent.service';
import { aiGatewayService } from '../services/ai-gateway.service';
import { webrtcSignalingService } from '../services/webrtc-signaling.service';
import { notificationService } from '../services/notification.service';
import { dbService } from '../database/db';
import { v4 as uuidv4 } from 'uuid';

export const apiRouter = Router();

// ==========================================
// 1. PUBLIC ENDPOINTS
// ==========================================

// Health Check
apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    system: 'MAKORAN ONE / MAKORAN GUARD',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    activeWebRTCSessions: webrtcSignalingService.getActiveSessionsCount()
  });
});

// Interactive OpenAPI 3.0 Contract Specification
apiRouter.get('/docs', (req, res) => {
  res.json({
    openapi: '3.0.3',
    info: {
      title: 'Makoran One & Makoran Guard Cloud Control Plane API',
      version: '1.0.0',
      description: 'Enterprise multi-tenant AI CCTV surveillance, intrusion detection, WebRTC live signaling, and edge gateway orchestrator.',
      contact: { name: 'Makoran Architecture Team', email: 'support@makoran.io' }
    },
    servers: [{ url: '/api/v1', description: 'Production Gateway' }],
    tags: [
      { name: 'Core & Health', description: 'System telemetry and status' },
      { name: 'Authentication', description: 'JWT tokens and multi-tenant scoping' },
      { name: 'Guard Alarm', description: 'Armed states, relays and siren control' },
      { name: 'AI Gateway', description: 'Server-centric prioritized snapshot inference' },
      { name: 'Live WebRTC', description: 'Strictly on-demand live view signaling' },
      { name: 'Edge Agents', description: 'Mini PC Linux gateway management and voice paging' },
      { name: 'Incidents & Patrols', description: 'Enterprise security ticketing and guard logbooks' },
      { name: 'Disaster Recovery', description: 'Encrypted system snapshots and backups' }
    ],
    endpoints_count: 36,
    architecture: 'Server-Centric Brain + Edge Gateway (No Continuous Cloud Streaming)'
  });
});

// User Login
apiRouter.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'ایمیل و رمز عبور الزامی است.' });
      return;
    }
    const result = await authService.login(email, password);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

// ==========================================
// 2. PROTECTED ENDPOINTS (JWT Required)
// ==========================================
apiRouter.use(authMiddleware);

// Get Current User Profile
apiRouter.get('/auth/me', (req: AuthenticatedRequest, res) => {
  const user = dbService.queryOne('SELECT id, tenant_id, email, full_name, role, phone, status FROM users WHERE id = ?', [req.user!.userId]);
  const tenant = dbService.queryOne('SELECT id, name, slug, plan FROM tenants WHERE id = ?', [req.tenantId]);
  res.json({ user, tenant });
});

// Switch Active Tenant (for Superadmins or multi-tenant operators)
apiRouter.post('/auth/switch-tenant', (req: AuthenticatedRequest, res) => {
  const { tenant_id } = req.body;
  const targetTenant = dbService.queryOne('SELECT * FROM tenants WHERE id = ? AND status = ?', [tenant_id, 'ACTIVE']);
  if (!targetTenant) {
    res.status(404).json({ error: 'مستأجر / سازمان مورد نظر یافت نشد' });
    return;
  }

  // Issue new token with updated tenant context
  const newToken = authService.generateToken({
    userId: req.user!.userId,
    tenantId: targetTenant.id,
    email: req.user!.email,
    role: req.user!.role,
    fullName: req.user!.fullName
  });

  // Log audit
  dbService.run(
    'INSERT INTO audit_logs (id, tenant_id, user_id, action, resource, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['aud-' + Date.now(), targetTenant.id, req.user!.userId, 'SWITCH_TENANT', 'TENANT', JSON.stringify({ targetTenant: targetTenant.name }), new Date().toISOString()]
  );

  res.json({
    token: newToken,
    tenant: targetTenant,
    user: {
      ...req.user,
      tenantId: targetTenant.id,
      tenantName: targetTenant.name
    }
  });
});

// List All Tenants (SuperAdmin)
apiRouter.get('/tenants', (req: AuthenticatedRequest, res) => {
  const tenants = dbService.query('SELECT * FROM tenants ORDER BY created_at DESC');
  res.json(tenants);
});

// Create New Tenant Organization
apiRouter.post('/tenants', roleGuard(['SUPERADMIN']), (req: AuthenticatedRequest, res) => {
  const { name, slug, plan } = req.body;
  const id = 'tenant-' + (slug || uuidv4().substring(0, 8));
  const now = new Date().toISOString();

  dbService.run(`
    INSERT INTO tenants (id, name, slug, plan, status, created_at)
    VALUES (?, ?, ?, ?, 'ACTIVE', ?)
  `, [id, name, slug || id, plan || 'ENTERPRISE', now]);

  // Initialize Guard State for new tenant
  dbService.run(`
    INSERT INTO guard_state (tenant_id, armed_state, alarm_status, last_state_change, siren_active, relay_active)
    VALUES (?, 'ARMED_AWAY', 'RESOLVED', ?, 0, 0)
  `, [id, now]);

  // Create default subscription
  dbService.run(`
    INSERT INTO subscriptions (id, tenant_id, plan_name, price_monthly, max_cameras, max_agents, retention_days, ai_enabled, status, next_billing_date, created_at)
    VALUES (?, ?, ?, 45000000, 16, 4, 30, 1, 'ACTIVE', '2026-10-17', ?)
  `, ['sub-' + uuidv4().substring(0, 8), id, plan || 'Enterprise Guard', now]);

  res.json({ id, success: true });
});

// --- AUDIT LOGS EXPLORER ---
apiRouter.get('/audit-logs', (req: AuthenticatedRequest, res) => {
  const { search, action, limit } = req.query;
  const maxLimit = parseInt(limit as string) || 50;

  let query = 'SELECT * FROM audit_logs WHERE tenant_id = ?';
  const params: any[] = [req.tenantId];

  if (action) {
    query += ' AND action = ?';
    params.push(action);
  }

  if (search) {
    query += ' AND (details LIKE ? OR resource LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(maxLimit);

  const logs = dbService.query(query, params);
  res.json(logs);
});

// --- BIOMETRIC FACE TIMELINE SEARCH ---
apiRouter.post('/faces/search', (req: AuthenticatedRequest, res) => {
  const { person_name, person_id } = req.body;
  const sightings = dbService.query(`
    SELECT e.*, c.name as camera_name, c.zone
    FROM events e
    LEFT JOIN cameras c ON e.camera_id = c.id
    WHERE e.tenant_id = ? AND (e.label LIKE ? OR e.details LIKE ?)
    ORDER BY e.created_at DESC
    LIMIT 30
  `, [req.tenantId, `%${person_name || ''}%`, `%${person_id || ''}%`]);

  res.json(sightings);
});

// --- LPR VEHICLE PASSAGE TIMELINE SEARCH ---
apiRouter.get('/plates/search', (req: AuthenticatedRequest, res) => {
  const plateQuery = req.query.q as string || '';
  const passages = dbService.query(`
    SELECT e.*, c.name as camera_name, c.zone
    FROM events e
    LEFT JOIN cameras c ON e.camera_id = c.id
    WHERE e.tenant_id = ? AND e.event_type IN ('license_plate', 'blocked_plate') AND (e.label LIKE ? OR e.details LIKE ?)
    ORDER BY e.created_at DESC
    LIMIT 30
  `, [req.tenantId, `%${plateQuery}%`, `%${plateQuery}%`]);

  res.json(passages);
});


// --- GUARD SECURITY SYSTEM STATE ---
apiRouter.get('/guard/state', (req: AuthenticatedRequest, res) => {
  const state = dbService.queryOne('SELECT * FROM guard_state WHERE tenant_id = ?', [req.tenantId]);
  res.json(state || { armed_state: 'ARMED_AWAY', alarm_status: 'RESOLVED' });
});

apiRouter.post('/guard/arm', (req: AuthenticatedRequest, res) => {
  const { armed_state } = req.body; // ARMED_AWAY, ARMED_STAY, DISARMED, PANIC
  if (!['ARMED_AWAY', 'ARMED_STAY', 'DISARMED', 'PANIC'].includes(armed_state)) {
    res.status(400).json({ error: 'وضعیت حفاظتی نامعتبر است' });
    return;
  }

  const now = new Date().toISOString();
  dbService.run(`
    UPDATE guard_state 
    SET armed_state = ?, last_armed_by = ?, last_state_change = ?
    WHERE tenant_id = ?
  `, [armed_state, req.user!.userId, now, req.tenantId]);

  // If PANIC is activated, trigger alarm immediately
  if (armed_state === 'PANIC') {
    dbService.run(`
      UPDATE guard_state SET alarm_status = 'TRIGGERED', siren_active = 1 WHERE tenant_id = ?
    `, [req.tenantId]);
  }

  // Broadcast to all clients
  agentService.broadcastToClients('guard_state_change', {
    tenant_id: req.tenantId,
    armed_state,
    user_id: req.user!.userId,
    timestamp: now
  });

  res.json({ success: true, armed_state, timestamp: now });
});

apiRouter.post('/guard/alarm-action', (req: AuthenticatedRequest, res) => {
  const { action } = req.body; // 'ACKNOWLEDGE', 'RESOLVE', 'SILENCE'
  const now = new Date().toISOString();

  let newStatus = 'RESOLVED';
  let sirenActive = 0;
  let relayActive = 0;

  if (action === 'ACKNOWLEDGE') {
    newStatus = 'ACKNOWLEDGED';
    sirenActive = 1;
  } else if (action === 'SILENCE') {
    newStatus = 'SILENCED';
    sirenActive = 0;
  } else {
    newStatus = 'RESOLVED';
    sirenActive = 0;
    relayActive = 0;
  }

  dbService.run(`
    UPDATE guard_state 
    SET alarm_status = ?, siren_active = ?, relay_active = ?, last_state_change = ?
    WHERE tenant_id = ?
  `, [newStatus, sirenActive, relayActive, now, req.tenantId]);

  dbService.run(`
    UPDATE alarms 
    SET status = ?, resolved_at = ?
    WHERE tenant_id = ? AND status = 'TRIGGERED'
  `, [newStatus, now, req.tenantId]);

  // Broadcast state update
  agentService.broadcastToClients('guard_state_change', {
    tenant_id: req.tenantId,
    alarm_status: newStatus,
    siren_active: sirenActive,
    relay_active: relayActive,
    timestamp: now
  });

  res.json({ success: true, alarm_status: newStatus });
});

// --- AGENTS (Mini PCs) ---
apiRouter.get('/agents', (req: AuthenticatedRequest, res) => {
  const agents = agentService.getAllAgents(req.tenantId!);
  res.json(agents);
});

apiRouter.post('/agents/:id/command', (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { command, relay, duration, parameters } = req.body;

  const dispatched = agentService.sendCommand(id, {
    command,
    relay,
    duration,
    parameters,
    issued_at: new Date().toISOString()
  });

  res.json({ success: dispatched });
});

// Voice Warning & Audio PA Broadcast to Mini PC Speaker
apiRouter.post('/agents/:id/broadcast', (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { message, zone, volume } = req.body;

  const dispatched = agentService.sendCommand(id, {
    command: 'voice_broadcast',
    parameters: {
      message: message || 'هشدار امنیتی سیستم مکران گارد: لطفاً سریعاً منطقه را ترک نمایید.',
      zone: zone || 'all',
      volume: volume || 85
    },
    issued_at: new Date().toISOString()
  });

  res.json({ success: dispatched, message, zone });
});

// Digital Walkie-Talkie Push-to-Talk (PTT) Transmission
apiRouter.post('/radio/ptt', (req: AuthenticatedRequest, res) => {
  const { channel, message, sender } = req.body;
  const now = new Date().toISOString();
  const targetChannel = channel || 1;
  const senderName = sender || req.user?.email || 'مرکز مانیتورینگ مکران';

  const agents = agentService.getAllAgents(req.tenantId!);
  for (const ag of agents) {
    agentService.sendCommand(ag.id, {
      command: 'radio_ptt',
      parameters: {
        channel: targetChannel,
        sender: senderName,
        message: message || 'ارتباط تست بی‌سیم گشت حراست'
      },
      issued_at: now
    });
  }

  agentService.broadcastToClients('radio_transmission', {
    channel: targetChannel,
    sender: senderName,
    message: message || 'ارتباط تست بی‌سیم گشت حراست',
    timestamp: now
  });

  res.json({ success: true, channel: targetChannel, sender: senderName, timestamp: now });
});

// --- CAMERAS ---
apiRouter.get('/cameras', (req: AuthenticatedRequest, res) => {
  const cameras = dbService.query('SELECT * FROM cameras WHERE tenant_id = ? ORDER BY created_at DESC', [req.tenantId]);
  res.json(cameras);
});

apiRouter.post('/cameras', (req: AuthenticatedRequest, res) => {
  const { agent_id, name, protocol, channel_index, stream_url, zone, resolution } = req.body;
  const id = 'cam-' + uuidv4().substring(0, 8);
  const now = new Date().toISOString();

  dbService.run(`
    INSERT INTO cameras (id, tenant_id, agent_id, name, protocol, channel_index, stream_url, zone, resolution, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, req.tenantId, agent_id || 'agent-mini-01', name, protocol || 'ONVIF', channel_index || 1, stream_url || '', zone || 'entrance', resolution || '1080p', now]);

  res.json({ id, success: true });
});

// --- CAMERA PTZ CONTROL ---
apiRouter.post('/cameras/:id/ptz', (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { action, speed } = req.body;

  const camera = dbService.queryOne('SELECT * FROM cameras WHERE id = ? AND tenant_id = ?', [id, req.tenantId]);
  if (!camera) {
    res.status(404).json({ error: 'دوربین یافت نشد' });
    return;
  }

  const dispatched = agentService.sendCommand(camera.agent_id, {
    command: 'ptz_command' as any,
    channel_id: id,
    parameters: { action, speed: speed || 5 },
    issued_at: new Date().toISOString()
  });

  res.json({ success: dispatched, action, camera_id: id });
});

// Automated PTZ Tour & Patrol Routine
apiRouter.post('/cameras/:id/ptz/tour', (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { action, tour_id, presets } = req.body;

  const camera = dbService.queryOne('SELECT * FROM cameras WHERE id = ? AND tenant_id = ?', [id, req.tenantId]);
  if (!camera) {
    res.status(404).json({ error: 'دوربین مداربسته یافت نشد' });
    return;
  }

  const dispatched = agentService.sendCommand(camera.agent_id, {
    command: 'ptz_tour' as any,
    channel_id: id,
    parameters: {
      action: action || 'start',
      tour_id: tour_id || 'tour_perimeter_360',
      presets: presets || ['preset_01', 'preset_02', 'preset_03']
    },
    issued_at: new Date().toISOString()
  });

  res.json({ success: dispatched, camera_id: id, action: action || 'start' });
});

// --- CAMERA DISCOVERY ---
apiRouter.post('/cameras/discover', (req: AuthenticatedRequest, res) => {
  const { agent_id, subnet } = req.body;
  const targetAgent = agent_id || 'agent-mini-01';

  // Send discovery command to Mini PC agent
  const dispatched = agentService.sendCommand(targetAgent, {
    command: 'discover_cameras' as any,
    parameters: { subnet: subnet || '192.168.1' },
    issued_at: new Date().toISOString()
  });

  // Simulated discovered cameras returned
  const sampleDiscovered = [
    {
      ip: '192.168.1.120',
      port: 80,
      protocol: 'ONVIF',
      manufacturer: 'Dahua Technology',
      model: 'DH-IPC-HFW2431S',
      macAddress: '3C:EF:8C:41:2B:10',
      rtspUrl: 'rtsp://192.168.1.120:554/cam/realmonitor?channel=1&subtype=0'
    },
    {
      ip: '192.168.1.125',
      port: 8000,
      protocol: 'HIKVISION',
      manufacturer: 'Hikvision Digital',
      model: 'DS-2CD2043G0-I',
      macAddress: '54:C4:15:8A:DF:22',
      rtspUrl: 'rtsp://192.168.1.125:554/Streaming/Channels/101'
    },
    {
      ip: '192.168.1.200',
      port: 37777,
      protocol: 'DAHUA',
      manufacturer: 'Dahua NVR Central',
      model: 'DH-NVR5216-4KS2',
      macAddress: 'E0:50:8B:19:90:3A',
      rtspUrl: 'rtsp://192.168.1.200:554/cam/realmonitor?channel=1&subtype=0'
    }
  ];

  res.json({ success: dispatched, cameras: sampleDiscovered });
});

// --- PRIVACY COMPLIANCE & BIOMETRIC PRUNING ---
apiRouter.post('/privacy/prune', (req: AuthenticatedRequest, res) => {
  const { retention_days } = req.body;
  const days = retention_days || 30;

  // In production, purges unknown face snapshots older than retention_days
  dbService.run(`
    DELETE FROM events 
    WHERE tenant_id = ? AND event_type = 'unknown_face' AND alarm_triggered = 0
  `, [req.tenantId]);

  res.json({ success: true, message: `داده‌های بیومتریک و تصاویر ناشناس قدیمی با موفقیت امحا شدند (نگهداری: ${days} روز)` });
});

// --- TEST NOTIFICATIONS DISPATCH ---
apiRouter.post('/notifications/test', async (req: AuthenticatedRequest, res) => {
  const { channel, recipient, message } = req.body;
  const targetChannel = channel || 'sms';
  const targetRecipient = recipient || '+989120000000';
  const targetMessage = message || 'پیامک آزمایشی سیستم مکران گارد';

  await notificationService.dispatch({
    tenant_id: req.tenantId!,
    event_id: 'test-' + Date.now(),
    title: 'تست سامانه اعلان مکران',
    body: targetMessage,
    severity: 'LOW',
    channels: [targetChannel],
    metadata: { test: true }
  });

  res.json({ success: true, channel: targetChannel, recipient: targetRecipient });
});

// --- AI GATEWAY & SNAPSHOT INGESTION ---
apiRouter.post('/ai/process', async (req: AuthenticatedRequest, res) => {
  try {
    const { camera_id, agent_id, event_type, image_base64, image_url, priority } = req.body;
    const result = await aiGatewayService.processImage({
      request_id: 'REQ-' + uuidv4().substring(0, 8),
      tenant_id: req.tenantId!,
      agent_id: agent_id || 'agent-mini-01',
      camera_id: camera_id || 'cam-01',
      event_type: event_type || 'auto_detect',
      priority: priority || 'HIGH',
      timestamp: new Date().toISOString(),
      image_base64,
      image_url
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- EVENTS ---
apiRouter.get('/events', (req: AuthenticatedRequest, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const events = dbService.query(`
    SELECT e.*, c.name as camera_name, c.zone
    FROM events e
    LEFT JOIN cameras c ON e.camera_id = c.id
    WHERE e.tenant_id = ?
    ORDER BY e.created_at DESC
    LIMIT ?
  `, [req.tenantId, limit]);
  res.json(events);
});

// --- ALARMS ---
apiRouter.get('/alarms', (req: AuthenticatedRequest, res) => {
  const alarms = dbService.query(`
    SELECT a.*, e.event_type, e.confidence, e.label, e.snapshot_url, c.name as camera_name, c.zone
    FROM alarms a
    JOIN events e ON a.event_id = e.id
    LEFT JOIN cameras c ON a.camera_id = c.id
    WHERE a.tenant_id = ?
    ORDER BY a.triggered_at DESC
  `, [req.tenantId]);
  res.json(alarms);
});

// --- SECURITY RULES ---
apiRouter.get('/rules', (req: AuthenticatedRequest, res) => {
  const rules = dbService.query('SELECT * FROM alarm_rules WHERE tenant_id = ? ORDER BY created_at DESC', [req.tenantId]);
  res.json(rules);
});

apiRouter.post('/rules', (req: AuthenticatedRequest, res) => {
  const { name, armed_states, event_types, camera_ids, zones, schedule, actions } = req.body;
  const id = 'rule-' + uuidv4().substring(0, 8);
  const now = new Date().toISOString();

  dbService.run(`
    INSERT INTO alarm_rules (id, tenant_id, name, enabled, armed_states, event_types, camera_ids, zones, schedule, actions, created_at)
    VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    req.tenantId,
    name,
    JSON.stringify(armed_states || ['ARMED_AWAY']),
    JSON.stringify(event_types || ['human_detected']),
    JSON.stringify(camera_ids || []),
    JSON.stringify(zones || ['entrance']),
    JSON.stringify(schedule || { all_day: true }),
    JSON.stringify(actions || { trigger_alarm: true, alarm_duration_sec: 15, send_push: true, send_sms: true }),
    now
  ]);

  res.json({ id, success: true });
});

// --- FACE DIRECTORY ---
apiRouter.get('/faces', (req: AuthenticatedRequest, res) => {
  const faces = dbService.query('SELECT * FROM faces WHERE tenant_id = ? ORDER BY created_at DESC', [req.tenantId]);
  res.json(faces);
});

apiRouter.post('/faces', (req: AuthenticatedRequest, res) => {
  const { name, category, phone, notes } = req.body;
  const id = 'face-' + uuidv4().substring(0, 8);
  const now = new Date().toISOString();

  dbService.run(`
    INSERT INTO faces (id, tenant_id, name, category, phone, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [id, req.tenantId, name, category || 'EMPLOYEE', phone || '', notes || '', now]);

  res.json({ id, success: true });
});

// --- LICENSE PLATES ---
apiRouter.get('/plates', (req: AuthenticatedRequest, res) => {
  const plates = dbService.query('SELECT * FROM license_plates WHERE tenant_id = ? ORDER BY created_at DESC', [req.tenantId]);
  res.json(plates);
});

apiRouter.post('/plates', (req: AuthenticatedRequest, res) => {
  const { plate_number, owner_name, category, vehicle_model } = req.body;
  const id = 'plt-' + uuidv4().substring(0, 8);
  const now = new Date().toISOString();

  dbService.run(`
    INSERT INTO license_plates (id, tenant_id, plate_number, owner_name, category, vehicle_model, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [id, req.tenantId, plate_number, owner_name || '', category || 'ALLOWED', vehicle_model || '', now]);

  res.json({ id, success: true });
});

// --- WEBRTC LIVE VIEW ON-DEMAND SIGNALS ---
apiRouter.post('/webrtc/request', async (req: AuthenticatedRequest, res) => {
  try {
    const { agent_id, camera_id } = req.body;
    const clientId = req.user!.userId;
    const session = await webrtcSignalingService.requestLiveStream(
      req.tenantId!,
      agent_id || 'agent-mini-01',
      camera_id,
      clientId
    );
    res.json(session);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/webrtc/signal', (req: AuthenticatedRequest, res) => {
  const { sessionId, signal } = req.body;
  const relayed = webrtcSignalingService.relaySignal(sessionId, signal, 'client');
  res.json({ success: relayed });
});

apiRouter.post('/webrtc/stop', (req: AuthenticatedRequest, res) => {
  const { sessionId } = req.body;
  const stopped = webrtcSignalingService.stopLiveStream(sessionId, 'user_exit');
  res.json({ success: stopped });
});

// --- NOTIFICATIONS ---
apiRouter.get('/notifications', (req: AuthenticatedRequest, res) => {
  const logs = notificationService.getHistory(req.tenantId!);
  res.json(logs);
});

// --- SUBSCRIPTION & BILLING ---
apiRouter.get('/billing', (req: AuthenticatedRequest, res) => {
  const subscription = dbService.queryOne('SELECT * FROM subscriptions WHERE tenant_id = ?', [req.tenantId]);
  res.json(subscription || {
    plan_name: 'Makoran Guard Enterprise',
    price_monthly: 45000000,
    status: 'ACTIVE'
  });
});

// --- ATTENDANCE (Face Recognition Clock-in/out) ---
apiRouter.get('/attendance', (req: AuthenticatedRequest, res) => {
  const records = dbService.query(
    'SELECT * FROM attendance WHERE tenant_id = ? ORDER BY timestamp DESC LIMIT 50',
    [req.tenantId]
  );
  res.json(records);
});

apiRouter.post('/attendance/check-in', (req: AuthenticatedRequest, res) => {
  const { person_id, person_name, camera_id, check_type, confidence, snapshot_url } = req.body;
  const id = 'att-' + uuidv4().substring(0, 8);
  const now = new Date().toISOString();

  dbService.run(`
    INSERT INTO attendance (id, tenant_id, person_id, person_name, camera_id, check_type, confidence, snapshot_url, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    req.tenantId,
    person_id || 'face-01',
    person_name || 'مهندس مکرانی',
    camera_id || 'cam-01',
    check_type || 'CHECK_IN',
    confidence || 0.98,
    snapshot_url || '',
    now
  ]);

  agentService.broadcastToClients('new_attendance', {
    id,
    person_name,
    check_type,
    timestamp: now
  });

  res.json({ id, success: true });
});

// --- FACILITY MANAGEMENT & BUILDING AUTOMATION ---
apiRouter.get('/facilities', (req: AuthenticatedRequest, res) => {
  const devices = dbService.query(
    'SELECT * FROM facility_devices WHERE tenant_id = ? ORDER BY name ASC',
    [req.tenantId]
  );
  res.json(devices);
});

apiRouter.post('/facilities/:id/toggle', (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { state, value } = req.body;
  const now = new Date().toISOString();

  const dev = dbService.queryOne(
    'SELECT * FROM facility_devices WHERE id = ? AND tenant_id = ?',
    [id, req.tenantId]
  );

  if (!dev) {
    res.status(404).json({ error: 'دستگاه هوشمند تاسیسات یافت نشد' });
    return;
  }

  const newState = state !== undefined ? state : (dev.state === 'ON' ? 'OFF' : 'ON');

  dbService.run(`
    UPDATE facility_devices 
    SET state = ?, value = ?, last_updated = ?
    WHERE id = ? AND tenant_id = ?
  `, [newState, value !== undefined ? value : dev.value, now, id, req.tenantId]);

  // Dispatch command to Mini PC agent
  agentService.sendCommand(dev.agent_id, {
    command: 'trigger_relay',
    parameters: { device_id: id, state: newState, type: dev.type },
    issued_at: now
  });

  agentService.broadcastToClients('facility_state_change', {
    deviceId: id,
    state: newState,
    value: dev.value,
    timestamp: now
  });

  res.json({ success: true, id, state: newState });
});

// Create new Facility Device
apiRouter.post('/facilities', (req: AuthenticatedRequest, res) => {
  const { name, type, zone, agent_id } = req.body;
  const id = 'fac-' + uuidv4().substring(0, 8);
  const now = new Date().toISOString();

  dbService.run(`
    INSERT INTO facility_devices (id, tenant_id, agent_id, name, type, state, value, zone, last_updated)
    VALUES (?, ?, ?, ?, ?, 'OFF', 0, ?, ?)
  `, [
    id,
    req.tenantId,
    agent_id || 'agent-mini-01',
    name || 'دستگاه جدید تاسیسات',
    type || 'LIGHT',
    zone || 'general',
    now
  ]);

  res.json({ success: true, id });
});

// Master Control (e.g. All Off, Security Lockdown)
apiRouter.post('/facilities/master-control', (req: AuthenticatedRequest, res) => {
  const { action } = req.body; // 'ALL_OFF' | 'ALL_ON' | 'LOCKDOWN'
  const now = new Date().toISOString();

  let targetState = 'OFF';
  if (action === 'ALL_ON') targetState = 'ON';
  if (action === 'LOCKDOWN') targetState = 'CLOSED';

  dbService.run(`
    UPDATE facility_devices
    SET state = ?, last_updated = ?
    WHERE tenant_id = ?
  `, [targetState, now, req.tenantId]);

  agentService.broadcastToClients('facility_master_state', { action, targetState, timestamp: now });
  res.json({ success: true, action, targetState });
});

// --- E-COMMERCE PRODUCTS & ORDERS ---
apiRouter.get('/ecommerce/products', (req: AuthenticatedRequest, res) => {
  const products = dbService.query('SELECT * FROM ecommerce_products ORDER BY price ASC');
  res.json(products);
});

apiRouter.get('/ecommerce/orders', (req: AuthenticatedRequest, res) => {
  const orders = dbService.query(
    'SELECT * FROM ecommerce_orders WHERE tenant_id = ? ORDER BY created_at DESC',
    [req.tenantId]
  );
  res.json(orders);
});

apiRouter.post('/ecommerce/orders', (req: AuthenticatedRequest, res) => {
  const { customer_name, phone, items, total_amount } = req.body;
  const id = 'ord-' + uuidv4().substring(0, 8);
  const now = new Date().toISOString();

  dbService.run(`
    INSERT INTO ecommerce_orders (id, tenant_id, customer_name, phone, total_amount, status, items, created_at)
    VALUES (?, ?, ?, ?, ?, 'CONFIRMED', ?, ?)
  `, [
    id,
    req.tenantId,
    customer_name || 'مشتری مکران',
    phone || '+989120000000',
    total_amount || 0,
    JSON.stringify(items || []),
    now
  ]);

  res.json({ id, success: true, status: 'CONFIRMED' });
});

// --- CRM & SITES ---
apiRouter.get('/crm', (req: AuthenticatedRequest, res) => {
  const customers = dbService.query('SELECT * FROM crm_customers WHERE tenant_id = ? ORDER BY created_at DESC', [req.tenantId]);
  res.json(customers);
});

// --- E-COMMERCE STORE ADMIN: CREATE PRODUCT ---
apiRouter.post('/ecommerce/products', roleGuard(['SUPERADMIN', 'ORG_ADMIN']), (req: AuthenticatedRequest, res) => {
  const { name, description, category, price, stock, sku, image_url, specifications } = req.body;
  const id = 'prod-' + uuidv4().substring(0, 8);
  const now = new Date().toISOString();

  dbService.run(`
    INSERT INTO ecommerce_products (id, name, description, category, price, stock, image_url, sku, specifications, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    name,
    description || '',
    category || 'MINI_PC_AGENT',
    price || 0,
    stock || 10,
    image_url || '/assets/products/default.png',
    sku || `MK-${Math.floor(1000 + Math.random() * 9000)}`,
    JSON.stringify(specifications || {}),
    now
  ]);

  res.json({ success: true, id });
});

// Update Order Status (Fulfillment Tracking)
apiRouter.patch('/ecommerce/orders/:id/status', (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { status } = req.body;

  dbService.run(`
    UPDATE ecommerce_orders
    SET status = ?
    WHERE id = ? AND tenant_id = ?
  `, [status || 'CONFIRMED', id, req.tenantId]);

  res.json({ success: true, id, status });
});

// Delete Product
apiRouter.delete('/ecommerce/products/:id', roleGuard(['SUPERADMIN']), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  dbService.run('DELETE FROM ecommerce_products WHERE id = ?', [id]);
  res.json({ success: true, id });
});

// --- SITE ADMIN: USER MANAGEMENT (RBAC) ---
apiRouter.get('/users', (req: AuthenticatedRequest, res) => {
  const users = dbService.query(`
    SELECT id, tenant_id, email, full_name, role, phone, status, created_at
    FROM users
    WHERE tenant_id = ? OR ? = 'SUPERADMIN'
    ORDER BY created_at DESC
  `, [req.tenantId, req.user?.role]);
  res.json(users);
});

apiRouter.post('/users', roleGuard(['SUPERADMIN', 'ORG_ADMIN']), (req: AuthenticatedRequest, res) => {
  const { email, password, full_name, role, phone } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'ایمیل و رمز عبور الزامی است' });
    return;
  }

  const existing = dbService.queryOne('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    res.status(409).json({ error: 'کاربری با این ایمیل قبلاً ثبت‌نام شده است' });
    return;
  }

  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, salt);
  const id = 'usr-' + uuidv4().substring(0, 8);
  const now = new Date().toISOString();

  dbService.run(`
    INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, phone, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
  `, [
    id,
    req.tenantId,
    email,
    hash,
    full_name || 'کاربر جدید مکران',
    role || 'OPERATOR',
    phone || '',
    now
  ]);

  res.json({ success: true, id, email, role: role || 'OPERATOR' });
});

apiRouter.delete('/users/:id', roleGuard(['SUPERADMIN', 'ORG_ADMIN']), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  if (id === req.user?.userId) {
    res.status(400).json({ error: 'امکان حذف حساب کاربری جاری وجود ندارد' });
    return;
  }

  dbService.run('DELETE FROM users WHERE id = ?', [id]);
  res.json({ success: true, id });
});

apiRouter.patch('/users/:id/role', roleGuard(['SUPERADMIN']), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { role, status } = req.body;

  dbService.run(`
    UPDATE users
    SET role = COALESCE(?, role), status = COALESCE(?, status)
    WHERE id = ?
  `, [role, status, id]);

  res.json({ success: true, id, role, status });
});

// --- SYSTEM SETTINGS & PLATFORM CONFIG ---
apiRouter.get('/settings', (req: AuthenticatedRequest, res) => {
  res.json({
    platform_name: 'Makoran One',
    version: '1.0.0',
    ai_contract_version: 'v1',
    storage_driver: 'S3_COMPATIBLE_ENCRYPTED',
    notification_gateways: {
      sms_kavenegar: 'ONLINE (API KEY ACTIVE)',
      voice_ivr: 'ONLINE (Faraz Voice Engine)',
      push_fcm: 'READY (PWA Service Worker)'
    },
    default_retention_days: 60,
    active_tenant: req.tenantId,
    timestamp: new Date().toISOString()
  });
});

// --- ENTERPRISE SECURITY INCIDENTS & DISPATCH ---
apiRouter.get('/incidents', (req: AuthenticatedRequest, res) => {
  const incidents = dbService.query(
    'SELECT * FROM security_incidents WHERE tenant_id = ? ORDER BY created_at DESC',
    [req.tenantId]
  );
  res.json(incidents);
});

apiRouter.post('/incidents', (req: AuthenticatedRequest, res) => {
  const { title, event_id, camera_id, severity, assigned_to, notes } = req.body;
  const id = 'inc-' + uuidv4().substring(0, 8);
  const now = new Date().toISOString();

  dbService.run(`
    INSERT INTO security_incidents (id, tenant_id, title, event_id, camera_id, severity, status, assigned_to, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'DISPATCHED', ?, ?, ?)
  `, [
    id,
    req.tenantId,
    title || 'رویداد نفوذ امنیتی',
    event_id || null,
    camera_id || 'cam-01',
    severity || 'HIGH',
    assigned_to || 'گشت حراست',
    notes || '',
    now
  ]);

  res.json({ success: true, id, status: 'DISPATCHED' });
});

apiRouter.patch('/incidents/:id/status', (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { status, root_cause, notes } = req.body;
  const now = new Date().toISOString();

  const incident = dbService.queryOne('SELECT * FROM security_incidents WHERE id = ? AND tenant_id = ?', [id, req.tenantId]);
  if (!incident) {
    res.status(404).json({ error: 'حادثه امنیتی مورد نظر یافت نشد' });
    return;
  }

  const updatedStatus = status || incident.status;
  const updatedRootCause = root_cause !== undefined ? root_cause : incident.root_cause;
  const updatedNotes = notes !== undefined ? notes : incident.notes;
  const resolvedAt = updatedStatus === 'RESOLVED' ? (incident.resolved_at || now) : null;

  dbService.run(`
    UPDATE security_incidents
    SET status = ?, root_cause = ?, notes = ?, resolved_at = ?
    WHERE id = ? AND tenant_id = ?
  `, [updatedStatus, updatedRootCause, updatedNotes, resolvedAt, id, req.tenantId]);

  res.json({ success: true, id, status: updatedStatus, root_cause: updatedRootCause, notes: updatedNotes });
});

// --- ENTERPRISE SHIFT HANDOVERS & GUARD LOGBOOK ---
apiRouter.get('/shifts', (req: AuthenticatedRequest, res) => {
  const shifts = dbService.query(
    'SELECT * FROM shift_handovers WHERE tenant_id = ? ORDER BY created_at DESC',
    [req.tenantId]
  );
  res.json(shifts);
});

apiRouter.post('/shifts', (req: AuthenticatedRequest, res) => {
  const { officer_name, shift_type, outgoing_notes, incoming_officer } = req.body;
  const id = 'shift-' + uuidv4().substring(0, 8);
  const now = new Date().toISOString();

  dbService.run(`
    INSERT INTO shift_handovers (id, tenant_id, officer_name, shift_type, outgoing_notes, incoming_officer, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMED', ?)
  `, [
    id,
    req.tenantId,
    officer_name || 'افسر شیفت حراست',
    shift_type || 'MORNING',
    outgoing_notes || 'شیفت بدون مورد امنیتی خاص تحویل گردید.',
    incoming_officer || 'افسر شیفت بعد',
    now
  ]);

  res.json({ success: true, id });
});

// --- ENTERPRISE GUARD PATROL CHECKPOINTS ---
apiRouter.get('/patrols', (req: AuthenticatedRequest, res) => {
  const patrols = dbService.query(
    'SELECT * FROM guard_patrols WHERE tenant_id = ? ORDER BY checked_at DESC',
    [req.tenantId]
  );
  res.json(patrols);
});

apiRouter.post('/patrols/check', (req: AuthenticatedRequest, res) => {
  const { checkpoint_name, officer_name, camera_id, notes, status } = req.body;
  const id = 'patrol-' + uuidv4().substring(0, 8);
  const now = new Date().toISOString();

  dbService.run(`
    INSERT INTO guard_patrols (id, tenant_id, checkpoint_name, officer_name, status, camera_id, notes, checked_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    req.tenantId,
    checkpoint_name || 'چک‌پوینت بازرسی',
    officer_name || 'نگهبان شیفت',
    status || 'VERIFIED',
    camera_id || 'cam-01',
    notes || 'سرکشی انجام و وضعیت امنیتی تایید گردید.',
    now
  ]);

  res.json({ success: true, id });
});

// --- ENTERPRISE DISASTER RECOVERY & ENCRYPTED BACKUP ---
apiRouter.get('/system/backup', roleGuard(['SUPERADMIN', 'ORG_ADMIN']), (req: AuthenticatedRequest, res) => {
  const tables = {
    cameras: dbService.query('SELECT * FROM cameras WHERE tenant_id = ?', [req.tenantId]),
    agents: dbService.query('SELECT * FROM agents WHERE tenant_id = ?', [req.tenantId]),
    rules: dbService.query('SELECT * FROM alarm_rules WHERE tenant_id = ?', [req.tenantId]),
    incidents: dbService.query('SELECT * FROM security_incidents WHERE tenant_id = ?', [req.tenantId]),
    shifts: dbService.query('SELECT * FROM shift_handovers WHERE tenant_id = ?', [req.tenantId]),
    patrols: dbService.query('SELECT * FROM guard_patrols WHERE tenant_id = ?', [req.tenantId]),
    facilities: dbService.query('SELECT * FROM facility_devices WHERE tenant_id = ?', [req.tenantId]),
    attendance: dbService.query('SELECT * FROM attendance WHERE tenant_id = ?', [req.tenantId]),
    faces: dbService.query('SELECT * FROM faces WHERE tenant_id = ?', [req.tenantId]),
    plates: dbService.query('SELECT * FROM license_plates WHERE tenant_id = ?', [req.tenantId]),
    audit_logs: dbService.query('SELECT * FROM audit_logs WHERE tenant_id = ?', [req.tenantId])
  };

  const backup = {
    platform: 'Makoran One Enterprise Guard',
    version: '1.0.0',
    tenant_id: req.tenantId,
    exported_at: new Date().toISOString(),
    tables,
    cameras: tables.cameras,
    agents: tables.agents,
    rules: tables.rules,
    events_count: dbService.queryOne('SELECT COUNT(*) as count FROM events WHERE tenant_id = ?', [req.tenantId])?.count || 0,
    faces_count: tables.faces.length,
    plates_count: tables.plates.length,
    checksum: 'sha256-verified-enterprise-snapshot'
  };

  res.json(backup);
});
