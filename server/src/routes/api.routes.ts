import { Router, Response } from 'express';
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
