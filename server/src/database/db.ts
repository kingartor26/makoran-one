import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_PATH = path.resolve(__dirname, '../../data/makoran.db');

export class DatabaseService {
  private db: Database | null = null;
  private saveTimeout: NodeJS.Timeout | null = null;

  async init(): Promise<void> {
    const SQL = await initSqlJs();
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }

    this.initSchema();
    this.seedDefaultData();
    this.persist();
  }

  private persist(): void {
    if (!this.db) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
    } catch (err) {
      console.error('[DB] Persist error:', err);
    }
  }

  private schedulePersist(): void {
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(() => {
      this.persist();
      this.saveTimeout = null;
    }, 200);
  }

  public run(sql: string, params: any[] = []): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run(sql, params);
    this.schedulePersist();
  }

  public query<T = any>(sql: string, params: any[] = []): T[] {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
  }

  public queryOne<T = any>(sql: string, params: any[] = []): T | null {
    const rows = this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  private initSchema(): void {
    if (!this.db) return;

    this.db.run(`
      -- Tenants
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        plan TEXT DEFAULT 'ENTERPRISE',
        status TEXT DEFAULT 'ACTIVE',
        created_at TEXT NOT NULL
      );

      -- Organizations / Customers
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        address TEXT,
        contact_phone TEXT,
        contact_email TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );

      -- Users
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'OPERATOR',
        phone TEXT,
        status TEXT DEFAULT 'ACTIVE',
        created_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );

      -- Makoran Agents (Mini PCs at edge)
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'OFFLINE',
        version TEXT DEFAULT '1.0.0',
        ip_address TEXT,
        cpu_usage REAL DEFAULT 0,
        memory_usage_mb REAL DEFAULT 0,
        memory_total_mb REAL DEFAULT 0,
        disk_used_gb REAL DEFAULT 0,
        disk_total_gb REAL DEFAULT 0,
        uptime_seconds INTEGER DEFAULT 0,
        last_heartbeat TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );

      -- Devices (DVR / NVR / Switch)
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL, -- DVR, NVR, IPC, IOT_RELAY
        brand TEXT,         -- Dahua, Hikvision, XMEye, Generic
        ip_address TEXT,
        port INTEGER,
        channels_count INTEGER DEFAULT 4,
        status TEXT DEFAULT 'ONLINE',
        created_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (agent_id) REFERENCES agents(id)
      );

      -- Cameras
      CREATE TABLE IF NOT EXISTS cameras (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        device_id TEXT,
        name TEXT NOT NULL,
        protocol TEXT NOT NULL, -- ONVIF, RTSP, DAHUA, HIKVISION, XMEYE, VIRTUAL
        channel_index INTEGER DEFAULT 1,
        stream_url TEXT,
        zone TEXT DEFAULT 'entrance',
        resolution TEXT DEFAULT '1080p',
        fps INTEGER DEFAULT 25,
        status TEXT DEFAULT 'ONLINE',
        motion_detection INTEGER DEFAULT 1,
        ai_enabled INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (agent_id) REFERENCES agents(id)
      );

      -- Security System State (Makoran Guard armed state per tenant)
      CREATE TABLE IF NOT EXISTS guard_state (
        tenant_id TEXT PRIMARY KEY,
        armed_state TEXT NOT NULL DEFAULT 'ARMED_AWAY', -- DISARMED, ARMED_AWAY, ARMED_STAY, PANIC
        alarm_status TEXT NOT NULL DEFAULT 'RESOLVED',  -- TRIGGERED, ACKNOWLEDGED, RESOLVED, SILENCED
        last_armed_by TEXT,
        last_state_change TEXT NOT NULL,
        siren_active INTEGER DEFAULT 0,
        relay_active INTEGER DEFAULT 0,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );

      -- Security Alarm Rules
      CREATE TABLE IF NOT EXISTS alarm_rules (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        armed_states TEXT NOT NULL, -- JSON array
        event_types TEXT NOT NULL,  -- JSON array
        camera_ids TEXT NOT NULL,   -- JSON array (empty = all)
        zones TEXT NOT NULL,        -- JSON array
        schedule TEXT NOT NULL,     -- JSON object
        actions TEXT NOT NULL,      -- JSON object (trigger_alarm, duration, relays, push, sms, call)
        created_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );

      -- Security Events
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        camera_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        confidence REAL DEFAULT 0,
        label TEXT,
        details TEXT,               -- JSON details/bounding boxes
        snapshot_url TEXT,
        decision TEXT DEFAULT 'info', -- alarm, warning, info, ignore
        alarm_triggered INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );

      -- Alarms Table
      CREATE TABLE IF NOT EXISTS alarms (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        camera_id TEXT NOT NULL,
        rule_id TEXT,
        status TEXT NOT NULL DEFAULT 'TRIGGERED', -- TRIGGERED, ACKNOWLEDGED, RESOLVED, SILENCED
        notes TEXT,
        triggered_at TEXT NOT NULL,
        acknowledged_at TEXT,
        resolved_at TEXT,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (event_id) REFERENCES events(id)
      );

      -- Face Directory
      CREATE TABLE IF NOT EXISTS faces (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'EMPLOYEE', -- VIP, EMPLOYEE, VISITOR, BLOCKED, UNKNOWN
        phone TEXT,
        image_url TEXT,
        embedding_id TEXT,
        active INTEGER DEFAULT 1,
        notes TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );

      -- License Plates Directory
      CREATE TABLE IF NOT EXISTS license_plates (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        plate_number TEXT NOT NULL,
        owner_name TEXT,
        category TEXT NOT NULL DEFAULT 'ALLOWED', -- ALLOWED, BLOCKED, VISITOR, EMPLOYEE
        vehicle_model TEXT,
        active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );

      -- Notifications Dispatch Log
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        event_id TEXT,
        channel TEXT NOT NULL, -- push, sms, phone_call, webhook, email
        recipient TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        status TEXT DEFAULT 'SENT', -- SENT, FAILED, DELIVERED
        created_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );

      -- Subscriptions & Billing
      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        plan_name TEXT NOT NULL,
        price_monthly INTEGER NOT NULL,
        max_cameras INTEGER DEFAULT 16,
        max_agents INTEGER DEFAULT 4,
        retention_days INTEGER DEFAULT 30,
        ai_enabled INTEGER DEFAULT 1,
        status TEXT DEFAULT 'ACTIVE',
        next_billing_date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );

      -- CRM Customers / Sites
      CREATE TABLE IF NOT EXISTS crm_customers (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        company TEXT,
        phone TEXT,
        email TEXT,
        city TEXT DEFAULT 'Chabahar / Makran',
        site_address TEXT,
        status TEXT DEFAULT 'ACTIVE',
        devices_installed INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );

      -- Attendance (Face recognition based check-in/out)
      CREATE TABLE IF NOT EXISTS attendance (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        person_id TEXT NOT NULL,
        person_name TEXT NOT NULL,
        camera_id TEXT NOT NULL,
        check_type TEXT NOT NULL, -- CHECK_IN, CHECK_OUT
        confidence REAL DEFAULT 0.95,
        snapshot_url TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );

      -- Facility Management & Building Automation
      CREATE TABLE IF NOT EXISTS facility_devices (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL, -- LIGHT, HVAC, SMART_LOCK, GATE, POWER_METER
        state TEXT NOT NULL DEFAULT 'OFF',
        value REAL DEFAULT 0,
        zone TEXT DEFAULT 'central',
        last_updated TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (agent_id) REFERENCES agents(id)
      );

      -- E-Commerce Shop Products
      CREATE TABLE IF NOT EXISTS ecommerce_products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        price INTEGER NOT NULL,
        stock INTEGER DEFAULT 10,
        image_url TEXT,
        sku TEXT UNIQUE NOT NULL,
        specifications TEXT,
        created_at TEXT NOT NULL
      );

      -- E-Commerce Orders
      CREATE TABLE IF NOT EXISTS ecommerce_orders (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        total_amount INTEGER NOT NULL,
        status TEXT DEFAULT 'CONFIRMED',
        items TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );

      -- Audit Logs
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        user_id TEXT,
        action TEXT NOT NULL,
        resource TEXT NOT NULL,
        details TEXT,
        ip_address TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );
    `);
  }

  private seedDefaultData(): void {
    const existingTenant = this.queryOne('SELECT id FROM tenants WHERE id = ?', ['tenant-makoran-01']);
    if (existingTenant) return;

    console.log('[DB] Seeding default initial data for Makoran One & Makoran Guard...');
    const now = new Date().toISOString();

    // 1. Default Tenants
    this.run(`
      INSERT INTO tenants (id, name, slug, plan, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['tenant-makoran-01', 'مکران گارد سنترال (Makoran Central Guard)', 'makoran-central', 'ENTERPRISE', 'ACTIVE', now]);

    this.run(`
      INSERT INTO tenants (id, name, slug, plan, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['tenant-makoran-02', 'پروژه بنادر و گمرک شهید بهشتی چابهار (Chabahar Port Security)', 'chabahar-port', 'ENTERPRISE', 'ACTIVE', now]);

    // Initialize Guard State for Port Tenant
    this.run(`
      INSERT INTO guard_state (tenant_id, armed_state, alarm_status, last_armed_by, last_state_change, siren_active, relay_active)
      VALUES (?, 'ARMED_AWAY', 'RESOLVED', 'usr-admin-01', ?, 0, 0)
    `, ['tenant-makoran-02', now]);

    // 2. Default SuperAdmin and Operator Users
    const salt = bcrypt.genSaltSync(10);
    const superadminPass = bcrypt.hashSync('MakoranGuard2026!', salt);
    const operatorPass = bcrypt.hashSync('Makoran12345!', salt);

    this.run(`
      INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, phone, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, ['usr-admin-01', 'tenant-makoran-01', 'admin@makoran.io', superadminPass, 'مهندس مکران (Lead Architect)', 'SUPERADMIN', '+989120000001', 'ACTIVE', now]);

    this.run(`
      INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, phone, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, ['usr-op-01', 'tenant-makoran-01', 'operator@makoran.io', operatorPass, 'اپراتور مانیتورینگ مکران', 'OPERATOR', '+989120000002', 'ACTIVE', now]);

    // 3. Default Makoran Guard State
    this.run(`
      INSERT INTO guard_state (tenant_id, armed_state, alarm_status, last_armed_by, last_state_change, siren_active, relay_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, ['tenant-makoran-01', 'ARMED_AWAY', 'RESOLVED', 'usr-admin-01', now, 0, 0]);

    // 4. Default Makoran Agents (Regional Mini PC Fleet)
    this.run(`
      INSERT INTO agents (id, tenant_id, name, token, status, version, ip_address, cpu_usage, memory_usage_mb, memory_total_mb, disk_used_gb, disk_total_gb, uptime_seconds, last_heartbeat, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, ['agent-mini-01', 'tenant-makoran-01', 'گیت‌وی مرکزی چابهار (Chabahar HQ - Intel N100)', 'agt_tok_makoran_secret_01', 'ONLINE', '1.2.4', '192.168.1.105', 8.5, 1420, 8192, 34.2, 256.0, 43200, now, now]);

    this.run(`
      INSERT INTO agents (id, tenant_id, name, token, status, version, ip_address, cpu_usage, memory_usage_mb, memory_total_mb, disk_used_gb, disk_total_gb, uptime_seconds, last_heartbeat, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, ['agent-mini-02', 'tenant-makoran-01', 'گیت‌وی انبار ساحلی کنارک (Konarak Warehouse - Intel N95)', 'agt_tok_makoran_secret_02', 'ONLINE', '1.2.4', '192.168.2.110', 12.1, 1680, 8192, 48.0, 256.0, 86400, now, now]);

    this.run(`
      INSERT INTO agents (id, tenant_id, name, token, status, version, ip_address, cpu_usage, memory_usage_mb, memory_total_mb, disk_used_gb, disk_total_gb, uptime_seconds, last_heartbeat, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, ['agent-mini-03', 'tenant-makoran-01', 'گیت‌وی پایانه دریایی جاسک (Jask Port Terminal - Intel N100)', 'agt_tok_makoran_secret_03', 'ONLINE', '1.2.4', '192.168.3.115', 7.2, 1310, 8192, 28.5, 256.0, 21600, now, now]);

    // 5. Default Devices (NVR and Dahua Switch)
    this.run(`
      INSERT INTO devices (id, tenant_id, agent_id, name, type, brand, ip_address, port, channels_count, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, ['dev-nvr-01', 'tenant-makoran-01', 'agent-mini-01', 'دستگاه ضبط ان‌وی‌آر مرکزی (Central NVR 16CH)', 'NVR', 'Dahua', '192.168.1.200', 37777, 16, 'ONLINE', now]);

    // 6. Cameras across Zones
    const camerasData = [
      ['cam-01', 'tenant-makoran-01', 'agent-mini-01', 'dev-nvr-01', 'دوربین ورودی اصلی (Main Entrance)', 'DAHUA', 1, 'rtsp://192.168.1.200:554/cam/realmonitor?channel=1&subtype=0', 'entrance', '1080p', 25, 'ONLINE', 1, 1],
      ['cam-02', 'tenant-makoran-01', 'agent-mini-01', 'dev-nvr-01', 'دوربین پیرامونی دیوار شرقی (East Perimeter)', 'HIKVISION', 2, 'rtsp://192.168.1.200:554/cam/realmonitor?channel=2&subtype=0', 'perimeter', '1080p', 25, 'ONLINE', 1, 1],
      ['cam-03', 'tenant-makoran-01', 'agent-mini-01', 'dev-nvr-01', 'دوربین گیت خودرو و پلاک‌خوان (Gate LPR)', 'ONVIF', 3, 'rtsp://192.168.1.200:554/cam/realmonitor?channel=3&subtype=0', 'gate_lpr', '1080p', 25, 'ONLINE', 1, 1],
      ['cam-04', 'tenant-makoran-01', 'agent-mini-01', 'dev-nvr-01', 'دوربین محوطه انبار و گاوصندوق (Secure Vault)', 'XMEYE', 4, 'rtsp://192.168.1.200:554/cam/realmonitor?channel=4&subtype=0', 'vault', '1080p', 25, 'ONLINE', 1, 1]
    ];

    for (const cam of camerasData) {
      this.run(`
        INSERT INTO cameras (id, tenant_id, agent_id, device_id, name, protocol, channel_index, stream_url, zone, resolution, fps, status, motion_detection, ai_enabled, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [...cam, now]);
    }

    // 7. Standard Security Alarm Rules (Server-side Rule Engine)
    const rule1 = {
      id: 'rule-01',
      tenant_id: 'tenant-makoran-01',
      name: 'هشدار تردد انسان در حالت فعال (Human Intrusion in Armed State)',
      enabled: 1,
      armed_states: JSON.stringify(['ARMED_AWAY', 'ARMED_STAY']),
      event_types: JSON.stringify(['human_detected', 'unknown_face']),
      camera_ids: JSON.stringify([]), // all cameras
      zones: JSON.stringify(['entrance', 'perimeter', 'vault']),
      schedule: JSON.stringify({ all_day: true }),
      actions: JSON.stringify({
        trigger_alarm: true,
        alarm_duration_sec: 15,
        relay_output: 1,
        send_push: true,
        send_sms: true,
        send_phone_call: true
      }),
      created_at: now
    };

    const rule2 = {
      id: 'rule-02',
      tenant_id: 'tenant-makoran-01',
      name: 'شناسایی پلاک مسدود/مشکوک در گیت ورودی',
      enabled: 1,
      armed_states: JSON.stringify(['ARMED_AWAY', 'ARMED_STAY', 'DISARMED']),
      event_types: JSON.stringify(['blocked_plate']),
      camera_ids: JSON.stringify(['cam-03']),
      zones: JSON.stringify(['gate_lpr']),
      schedule: JSON.stringify({ all_day: true }),
      actions: JSON.stringify({
        trigger_alarm: true,
        alarm_duration_sec: 10,
        relay_output: 2,
        send_push: true,
        send_sms: true,
        send_phone_call: false
      }),
      created_at: now
    };

    this.run(`
      INSERT INTO alarm_rules (id, tenant_id, name, enabled, armed_states, event_types, camera_ids, zones, schedule, actions, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [rule1.id, rule1.tenant_id, rule1.name, rule1.enabled, rule1.armed_states, rule1.event_types, rule1.camera_ids, rule1.zones, rule1.schedule, rule1.actions, rule1.created_at]);

    this.run(`
      INSERT INTO alarm_rules (id, tenant_id, name, enabled, armed_states, event_types, camera_ids, zones, schedule, actions, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [rule2.id, rule2.tenant_id, rule2.name, rule2.enabled, rule2.armed_states, rule2.event_types, rule2.camera_ids, rule2.zones, rule2.schedule, rule2.actions, rule2.created_at]);

    // 8. Faces Directory (VIP, Employee, Blocked)
    const sampleFaces = [
      ['face-01', 'tenant-makoran-01', 'مهندس رضا مکرانی', 'EMPLOYEE', '+989121111111', '/assets/avatars/reza.jpg', 'emb_face_001', 1, 'مدیر فنی سایت چابهار'],
      ['face-02', 'tenant-makoran-01', 'خانم دکتر سارا بلوچ', 'VIP', '+989122222222', '/assets/avatars/sara.jpg', 'emb_face_002', 1, 'عضو هیئت مدیره منطقه ویژه مکران'],
      ['face-03', 'tenant-makoran-01', 'فرد ناشناس سابقه ورود غیرمجاز', 'BLOCKED', '', '', 'emb_face_003', 1, 'لیست سیاه حراست']
    ];

    for (const f of sampleFaces) {
      this.run(`
        INSERT INTO faces (id, tenant_id, name, category, phone, image_url, embedding_id, active, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [...f, now]);
    }

    // 9. License Plates
    const samplePlates = [
      ['plt-01', 'tenant-makoran-01', '85ج124-ایران85', 'مهندس رضا مکرانی', 'ALLOWED', 'پژو 207 سفید', 1],
      ['plt-02', 'tenant-makoran-01', '72ب998-ایران85', 'پلاک مسدود شده حراست', 'BLOCKED', 'پراید نقره‌ای', 1],
      ['plt-03', 'tenant-makoran-01', '44د651-ایران11', 'مهمان ویژه شرکت نفت', 'VISITOR', 'تویوتا هایلوکس', 1]
    ];

    for (const p of samplePlates) {
      this.run(`
        INSERT INTO license_plates (id, tenant_id, plate_number, owner_name, category, vehicle_model, active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [...p, now]);
    }

    // 10. Subscriptions
    this.run(`
      INSERT INTO subscriptions (id, tenant_id, plan_name, price_monthly, max_cameras, max_agents, retention_days, ai_enabled, status, next_billing_date, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, ['sub-01', 'tenant-makoran-01', 'Makoran Guard Enterprise AI', 45000000, 32, 8, 60, 1, 'ACTIVE', '2026-10-17', now]);

    // 12. Attendance Records
    this.run(`
      INSERT INTO attendance (id, tenant_id, person_id, person_name, camera_id, check_type, confidence, snapshot_url, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, ['att-01', 'tenant-makoran-01', 'face-01', 'مهندس رضا مکرانی', 'cam-01', 'CHECK_IN', 0.98, '/assets/avatars/reza.jpg', now]);

    // 13. Facility & Building Automation Devices
    const facilityDevices = [
      ['fac-01', 'tenant-makoran-01', 'agent-mini-01', 'روشنایی پروژکتور محوطه و پیرامون', 'LIGHT', 'ON', 100, 'perimeter'],
      ['fac-02', 'tenant-makoran-01', 'agent-mini-01', 'سامانه سرمایش سرور روم و کنترل دما', 'HVAC', 'ON', 21.5, 'server_room'],
      ['fac-03', 'tenant-makoran-01', 'agent-mini-01', 'قفل الکترونیکی هوشمند درب انبار مرکزی', 'SMART_LOCK', 'LOCKED', 0, 'vault'],
      ['fac-04', 'tenant-makoran-01', 'agent-mini-01', 'موتور جک بازویی درب تردد خودرو', 'GATE', 'CLOSED', 0, 'gate_lpr'],
      ['fac-05', 'tenant-makoran-01', 'agent-mini-01', 'پاورمیتر و سنجش هوشمند توان شبکه', 'POWER_METER', 'ON', 3.8, 'main_panel']
    ];

    for (const d of facilityDevices) {
      this.run(`
        INSERT INTO facility_devices (id, tenant_id, agent_id, name, type, state, value, zone, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [...d, now]);
    }

    // 14. E-Commerce Products
    const products = [
      [
        'prod-01',
        'مینی‌پی‌سی گیت‌وی مکران وان (Intel N100 Mini PC Agent)',
        'تجهیز سخت‌افزاری اختصاصی گیت‌وی مکران با پردازنده ۴ هسته‌ای Intel N100، رم ۸ گیگابایت DDR5، حافظه ۲۵۶ گیگابایت NVMe، دو پورت شبکه گیگابیتی و بدنه آلومینیومی بدون فن (Fanless) مناسب کارکرد مداوم ۲۴/۷.',
        'MINI_PC_AGENT',
        18500000,
        25,
        '/assets/products/mini-pc.png',
        'MK-N100-PRO',
        JSON.stringify({ cpu: 'Intel N100 3.4GHz', ram: '8GB DDR5', storage: '256GB SSD NVMe', lan: 'Dual 2.5GbE' })
      ],
      [
        'prod-02',
        'دوربین تحت شبکه ۴K مکران گارد (Ultra HD 8MP AI Camera)',
        'دوربین هوشمند بولت ضدآب IP67 با رزولوشن 8MP 4K، سنسور Sony Starvis دید در شب رنگی، پشتیبانی از پروتکل ONVIF و RTSP، لنز ۲.۸ میلی‌متر و دید در شب ۶۰ متر.',
        'CAMERA_4K',
        9800000,
        40,
        '/assets/products/camera-4k.png',
        'MK-IPC-8MP-STAR',
        JSON.stringify({ resolution: '4K (3840x2160)', sensor: 'Sony Starvis', lens: '2.8mm Wide', poe: 'Standard IEEE 802.3af' })
      ],
      [
        'prod-03',
        'دستگاه NVR ۳۲ کاناله تحت شبکه صنعتی مکران',
        'دستگاه ذخیره‌ساز ویدئویی ۳۲ کاناله با پهنای باند ورودی ۳۲۰ مگابیت، پشتیبانی از ۴ هارد تا ظرفیت ۶۴ ترابایت، خروجی 4K HDMI، ورودی/خروجی آلارم فیزیکی و سازگاری کامل با مینی‌پی‌سی مکران.',
        'NVR',
        24500000,
        12,
        '/assets/products/nvr-32ch.png',
        'MK-NVR-32CH-4K',
        JSON.stringify({ channels: '32CH IP', hdd: '4x SATA (Up to 16TB each)', bandwidth: '320 Mbps', output: 'HDMI 4K + VGA' })
      ],
      [
        'prod-04',
        'ماژول رله صنعتی ۴ کاناله تحت شبکه (IoT Relay Module)',
        'ماژول تحریک سخت‌افزاری رله با پورت شبکه RJ45 و پروتکل Modbus/TCP جهت اتصال به آژیر، پروژکتور، قفل‌های الکترونیکی و جک پارکینگ با کنترل مستقیم از مینی‌پی‌سی مکران.',
        'SENSORS_RELAYS',
        4200000,
        50,
        '/assets/products/relay-module.png',
        'MK-RELAY-4CH-NET',
        JSON.stringify({ channels: '4x Relay Output (10A 250VAC)', input: '4x Digital Input', interface: 'Ethernet RJ45', protocol: 'TCP/IP' })
      ],
      [
        'prod-05',
        'پکیج جامع امنیت هوشمند ویلا و کارگاه صنعتی مکران گارد',
        'شامل ۱ دستگاه مینی‌پی‌سی گیت‌وی N100 + ۴ عدد دوربین 4K سونی + سوییچ صنعتی POE + آژیر ۱۱۰ دسی‌بل + اشتراک یک‌ساله ابری مکران وان.',
        'PACKAGES',
        68000000,
        8,
        '/assets/products/package-complete.png',
        'MK-BUNDLE-ENTERPRISE',
        JSON.stringify({ agent: '1x Mini PC N100', cameras: '4x 4K Sony IPC', switch: '5-Port Gigabit POE', license: '1-Year Enterprise Cloud' })
      ]
    ];

    for (const p of products) {
      this.run(`
        INSERT INTO ecommerce_products (id, name, description, category, price, stock, image_url, sku, specifications, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [...p, now]);
    }

    console.log('[DB] Seeding completed successfully.');
  }
}

export const dbService = new DatabaseService();
