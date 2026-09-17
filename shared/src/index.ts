// ==========================================
// MAKORAN ONE & MAKORAN GUARD — SHARED CONTRACTS
// ==========================================

export type PriorityLevel = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';

export type ArmedState = 'DISARMED' | 'ARMED_AWAY' | 'ARMED_STAY' | 'PANIC';

export type AlarmStatus = 'TRIGGERED' | 'ACKNOWLEDGED' | 'RESOLVED' | 'SILENCED';

export type UserRole = 'SUPERADMIN' | 'ORG_ADMIN' | 'OPERATOR' | 'VIEWER';

export type DetectionType = 
  | 'human_detected' 
  | 'face_detected' 
  | 'unknown_face' 
  | 'vip_face' 
  | 'blocked_face'
  | 'vehicle_detected' 
  | 'license_plate' 
  | 'blocked_plate' 
  | 'motion_detected' 
  | 'line_crossing' 
  | 'tampering';

export type CameraProtocol = 'ONVIF' | 'RTSP' | 'DAHUA' | 'HIKVISION' | 'XMEYE' | 'VIRTUAL';

export interface BoundingBox {
  x: number;      // 0.0 - 1.0 (relative)
  y: number;      // 0.0 - 1.0
  width: number;  // 0.0 - 1.0
  height: number; // 0.0 - 1.0
}

export interface DetectionResult {
  id: string;
  type: DetectionType;
  confidence: number;
  label?: string;
  box?: BoundingBox;
  attributes?: Record<string, any>;
}

// AI Gateway Contract v1
export interface AIProcessRequest {
  request_id: string;
  tenant_id: string;
  agent_id: string;
  camera_id: string;
  event_type: DetectionType | 'auto_detect';
  priority?: PriorityLevel;
  timestamp: string;
  image_base64?: string;
  image_url?: string;
}

export interface AIProcessResponse {
  request_id: string;
  tenant_id: string;
  camera_id: string;
  status: 'completed' | 'failed';
  detections: DetectionResult[];
  confidence: number;
  decision: 'alarm' | 'warning' | 'info' | 'ignore';
  actions: AgentActionCommand[];
  processing_time_ms: number;
  timestamp: string;
}

// Agent Commands
export type AgentCommandType = 
  | 'trigger_alarm' 
  | 'trigger_relay' 
  | 'siren_pulse' 
  | 'buzzer_beep' 
  | 'capture_snapshot' 
  | 'discover_cameras'
  | 'ptz_command'
  | 'ptz_tour'
  | 'radio_ptt'
  | 'voice_broadcast'
  | 'reboot' 
  | 'update_config' 
  | 'webrtc_start' 
  | 'webrtc_stop'
  | 'ota_update';

export interface AgentActionCommand {
  command: AgentCommandType;
  relay?: number;
  duration?: number; // seconds
  channel_id?: string;
  parameters?: Record<string, any>;
  issued_at: string;
}

// Agent Telemetry Heartbeat
export interface AgentTelemetry {
  agent_id: string;
  tenant_id: string;
  version: string;
  uptime_seconds: number;
  cpu_usage_pct: number;
  memory_usage_mb: number;
  memory_total_mb: number;
  disk_used_gb: number;
  disk_total_gb: number;
  connected_cameras: number;
  active_webrtc_streams: number;
  ip_address: string;
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED';
  timestamp: string;
}

// WebRTC Signaling
export interface WebRTCSignalingMessage {
  type: 'offer' | 'answer' | 'candidate' | 'start_request' | 'stop_request';
  session_id: string;
  client_id?: string;
  agent_id: string;
  camera_id: string;
  sdp?: string;
  candidate?: any;
}

// Attendance Contract
export interface AttendanceRecord {
  id: string;
  tenant_id: string;
  person_id: string;
  person_name: string;
  camera_id: string;
  check_type: 'CHECK_IN' | 'CHECK_OUT';
  confidence: number;
  snapshot_url?: string;
  timestamp: string;
}

// Facility Management & Building Automation Contract
export interface FacilityDevice {
  id: string;
  tenant_id: string;
  agent_id: string;
  name: string;
  type: 'LIGHT' | 'HVAC' | 'SMART_LOCK' | 'GATE' | 'POWER_METER';
  state: 'ON' | 'OFF' | 'OPEN' | 'CLOSED';
  value?: number; // e.g. temperature 24C or kW 4.2
  zone: string;
  last_updated: string;
}

// E-Commerce Product Contract
export interface ShopProduct {
  id: string;
  name: string;
  description: string;
  category: 'MINI_PC_AGENT' | 'CAMERA_4K' | 'NVR' | 'SENSORS_RELAYS' | 'PACKAGES';
  price: number;
  stock: number;
  image_url: string;
  sku: string;
  specifications: Record<string, string>;
}

// E-Commerce Order Contract
export interface ShopOrder {
  id: string;
  tenant_id: string;
  customer_name: string;
  phone: string;
  total_amount: number;
  status: 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED';
  items: Array<{ product_id: string; product_name: string; quantity: number; unit_price: number }>;
  created_at: string;
}

export interface NotificationPayload {
  tenant_id: string;
  event_id: string;
  title: string;
  body: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  channels: ('push' | 'sms' | 'phone_call' | 'webhook' | 'email')[];
  image_url?: string;
  metadata?: Record<string, any>;
}

// Standard Security Rule Definition
export interface SecurityRule {
  id: string;
  tenant_id: string;
  name: string;
  enabled: boolean;
  armed_states: ArmedState[]; // e.g. ['ARMED_AWAY', 'ARMED_STAY']
  event_types: DetectionType[];
  camera_ids: string[]; // empty means all cameras
  zones: string[]; // e.g. ['perimeter', 'entrance', 'vault']
  schedule: {
    all_day: boolean;
    start_time?: string; // '22:00'
    end_time?: string;   // '06:00'
    days_of_week?: number[]; // [0,1,2,3,4,5,6]
  };
  actions: {
    trigger_alarm: boolean;
    alarm_duration_sec: number;
    relay_output?: number;
    send_push: boolean;
    send_sms: boolean;
    send_phone_call: boolean;
    webhook_url?: string;
  };
}

// Enterprise Security Incident Dispatch
export interface SecurityIncident {
  id: string;
  tenant_id: string;
  title: string;
  event_id?: string;
  camera_id?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'DISPATCHED' | 'INVESTIGATING' | 'RESOLVED';
  assigned_to?: string;
  notes?: string;
  root_cause?: string;
  resolved_at?: string;
  created_at: string;
}

// Enterprise Shift Handover & Logbook
export interface ShiftHandover {
  id: string;
  tenant_id: string;
  officer_name: string;
  shift_type: 'MORNING' | 'EVENING' | 'NIGHT';
  outgoing_notes?: string;
  incoming_officer?: string;
  status: 'PENDING' | 'CONFIRMED';
  created_at: string;
}

// Enterprise Guard Patrol Checkpoint
export interface GuardPatrol {
  id: string;
  tenant_id: string;
  checkpoint_name: string;
  officer_name: string;
  status: 'VERIFIED' | 'DELAYED' | 'MISSED';
  camera_id?: string;
  notes?: string;
  checked_at: string;
}
