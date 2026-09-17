export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: string;
  phone?: string;
  tenantId: string;
  tenantName: string;
}

export interface GuardState {
  tenant_id: string;
  armed_state: 'ARMED_AWAY' | 'ARMED_STAY' | 'DISARMED' | 'PANIC';
  alarm_status: 'TRIGGERED' | 'ACKNOWLEDGED' | 'RESOLVED' | 'SILENCED';
  last_armed_by?: string;
  last_state_change: string;
  siren_active: number;
  relay_active: number;
}

export interface Camera {
  id: string;
  name: string;
  protocol: string;
  channel_index: number;
  stream_url: string;
  zone: string;
  resolution: string;
  fps: number;
  status: string;
  motion_detection: number;
  ai_enabled: number;
}

export interface Agent {
  id: string;
  tenant_id: string;
  name: string;
  token: string;
  status: string;
  version: string;
  ip_address: string;
  cpu_usage: number;
  memory_usage_mb: number;
  memory_total_mb: number;
  disk_used_gb: number;
  disk_total_gb: number;
  uptime_seconds: number;
  last_heartbeat: string;
  is_live_connected?: boolean;
}

export interface SecurityEvent {
  id: string;
  camera_id: string;
  camera_name?: string;
  zone?: string;
  event_type: string;
  confidence: number;
  label: string;
  details?: string;
  snapshot_url?: string;
  decision: string;
  alarm_triggered: number;
  created_at: string;
}

export interface AlarmItem {
  id: string;
  event_id: string;
  camera_id: string;
  camera_name?: string;
  zone?: string;
  status: 'TRIGGERED' | 'ACKNOWLEDGED' | 'RESOLVED' | 'SILENCED';
  notes: string;
  triggered_at: string;
  event_type: string;
  confidence: number;
  label: string;
  snapshot_url: string;
}

export interface AlarmRule {
  id: string;
  name: string;
  enabled: number;
  armed_states: string;
  event_types: string;
  camera_ids: string;
  zones: string;
  schedule: string;
  actions: string;
  created_at: string;
}

export interface FaceItem {
  id: string;
  name: string;
  category: 'VIP' | 'EMPLOYEE' | 'VISITOR' | 'BLOCKED' | 'UNKNOWN';
  phone?: string;
  image_url?: string;
  notes?: string;
  active: number;
}

export interface PlateItem {
  id: string;
  plate_number: string;
  owner_name: string;
  category: 'ALLOWED' | 'BLOCKED' | 'VISITOR' | 'EMPLOYEE';
  vehicle_model?: string;
  active: number;
}

export interface AttendanceItem {
  id: string;
  person_id: string;
  person_name: string;
  camera_id: string;
  check_type: 'CHECK_IN' | 'CHECK_OUT';
  confidence: number;
  snapshot_url?: string;
  timestamp: string;
}

export interface FacilityItem {
  id: string;
  agent_id: string;
  name: string;
  type: 'LIGHT' | 'HVAC' | 'SMART_LOCK' | 'GATE' | 'POWER_METER';
  state: string;
  value: number;
  zone: string;
  last_updated: string;
}

export interface ShopProductItem {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  image_url: string;
  sku: string;
  specifications: string;
}

export interface ShopOrderItem {
  id: string;
  customer_name: string;
  phone: string;
  total_amount: number;
  status: string;
  items: string;
  created_at: string;
}

  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  city: string;
  site_address: string;
  status: string;
  devices_installed: number;
}
