const API_BASE = '/api/v1';

export class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('makoran_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('makoran_token', token);
    } else {
      localStorage.removeItem('makoran_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    if (response.status === 401) {
      // Clear expired token
      this.setToken(null);
      window.dispatchEvent(new Event('auth_logout'));
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'خطایی در ارتباط با سرور رخ داد');
    }
    return data;
  }

  // Auth
  async login(email: string, password: string) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.setToken(res.token);
    return res;
  }

  async getMe() {
    return this.request('/auth/me');
  }

  // Multi-Tenancy
  async getTenants() {
    return this.request('/tenants');
  }

  async createTenant(data: { name: string; slug?: string; plan?: string }) {
    return this.request('/tenants', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async switchTenant(tenant_id: string) {
    const res = await this.request('/auth/switch-tenant', {
      method: 'POST',
      body: JSON.stringify({ tenant_id })
    });
    if (res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  // Audit Logs
  async getAuditLogs(search = '', action = '') {
    let url = '/audit-logs?limit=50';
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (action) url += `&action=${encodeURIComponent(action)}`;
    return this.request(url);
  }

  // Face & Plate Searches
  async searchFaceSightings(person_name: string) {
    return this.request('/faces/search', {
      method: 'POST',
      body: JSON.stringify({ person_name })
    });
  }

  async searchPlateTimeline(q: string) {
    return this.request(`/plates/search?q=${encodeURIComponent(q)}`);
  }

  // Guard State
  async getGuardState() {
    return this.request('/guard/state');
  }

  async setArmedState(armed_state: string) {
    return this.request('/guard/arm', {
      method: 'POST',
      body: JSON.stringify({ armed_state })
    });
  }

  async setAlarmAction(action: 'ACKNOWLEDGE' | 'RESOLVE' | 'SILENCE') {
    return this.request('/guard/alarm-action', {
      method: 'POST',
      body: JSON.stringify({ action })
    });
  }

  // Agents
  async getAgents() {
    return this.request('/agents');
  }

  async sendAgentCommand(agentId: string, command: string, params: any = {}) {
    return this.request(`/agents/${agentId}/command`, {
      method: 'POST',
      body: JSON.stringify({ command, ...params })
    });
  }

  // Cameras
  async getCameras() {
    return this.request('/cameras');
  }

  async addCamera(camera: any) {
    return this.request('/cameras', {
      method: 'POST',
      body: JSON.stringify(camera)
    });
  }

  async sendPTZ(cameraId: string, action: string, speed = 5) {
    return this.request(`/cameras/${cameraId}/ptz`, {
      method: 'POST',
      body: JSON.stringify({ action, speed })
    });
  }

  // Camera Discovery
  async discoverCameras(agent_id = 'agent-mini-01', subnet = '192.168.1') {
    return this.request('/cameras/discover', {
      method: 'POST',
      body: JSON.stringify({ agent_id, subnet })
    });
  }

  // Privacy Compliance
  async pruneBiometrics(retention_days = 30) {
    return this.request('/privacy/prune', {
      method: 'POST',
      body: JSON.stringify({ retention_days })
    });
  }

  // Test Notifications
  async testNotification(channel = 'sms', recipient = '+989120000000', message = '') {
    return this.request('/notifications/test', {
      method: 'POST',
      body: JSON.stringify({ channel, recipient, message })
    });
  }

  // AI & Snapshots
  async processAI(payload: { camera_id: string; agent_id?: string; event_type?: string; image_base64?: string }) {
    return this.request('/ai/process', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // Events & Alarms
  async getEvents(limit = 50) {
    return this.request(`/events?limit=${limit}`);
  }

  async getAlarms() {
    return this.request('/alarms');
  }

  // Rules
  async getRules() {
    return this.request('/rules');
  }

  async addRule(rule: any) {
    return this.request('/rules', {
      method: 'POST',
      body: JSON.stringify(rule)
    });
  }

  // Faces
  async getFaces() {
    return this.request('/faces');
  }

  async addFace(face: any) {
    return this.request('/faces', {
      method: 'POST',
      body: JSON.stringify(face)
    });
  }

  // Plates
  async getPlates() {
    return this.request('/plates');
  }

  async addPlate(plate: any) {
    return this.request('/plates', {
      method: 'POST',
      body: JSON.stringify(plate)
    });
  }

  // WebRTC
  async requestLiveView(cameraId: string, agentId = 'agent-mini-01') {
    return this.request('/webrtc/request', {
      method: 'POST',
      body: JSON.stringify({ camera_id: cameraId, agent_id: agentId })
    });
  }

  async stopLiveView(sessionId: string) {
    return this.request('/webrtc/stop', {
      method: 'POST',
      body: JSON.stringify({ sessionId })
    });
  }

  // Attendance
  async getAttendance() {
    return this.request('/attendance');
  }

  async logAttendance(data: any) {
    return this.request('/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Facility & Automation
  async getFacilities() {
    return this.request('/facilities');
  }

  async addFacility(device: { name: string; type: string; zone: string; agent_id?: string }) {
    return this.request('/facilities', {
      method: 'POST',
      body: JSON.stringify(device)
    });
  }

  async facilityMasterControl(action: 'ALL_OFF' | 'ALL_ON' | 'LOCKDOWN') {
    return this.request('/facilities/master-control', {
      method: 'POST',
      body: JSON.stringify({ action })
    });
  }

  async toggleFacility(id: string, state?: string, value?: number) {
    return this.request(`/facilities/${id}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ state, value })
    });
  }

  // E-Commerce
  async getShopProducts() {
    return this.request('/ecommerce/products');
  }

  async addProduct(product: any) {
    return this.request('/ecommerce/products', {
      method: 'POST',
      body: JSON.stringify(product)
    });
  }

  async deleteProduct(id: string) {
    return this.request(`/ecommerce/products/${id}`, {
      method: 'DELETE'
    });
  }

  async getShopOrders() {
    return this.request('/ecommerce/orders');
  }

  async createShopOrder(order: any) {
    return this.request('/ecommerce/orders', {
      method: 'POST',
      body: JSON.stringify(order)
    });
  }

  async updateOrderStatus(id: string, status: string) {
    return this.request(`/ecommerce/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  }

  // Users Management (RBAC)
  async getUsers() {
    return this.request('/users');
  }

  async createUser(user: any) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(user)
    });
  }

  async deleteUser(id: string) {
    return this.request(`/users/${id}`, {
      method: 'DELETE'
    });
  }

  async updateUserRole(id: string, role: string, status?: string) {
    return this.request(`/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role, status })
    });
  }

  // Platform Settings
  async getSettings() {
    return this.request('/settings');
  }

  // Enterprise Security Incidents & Patrol Dispatch
  async getIncidents() {
    return this.request('/incidents');
  }

  async createIncident(incident: any) {
    return this.request('/incidents', {
      method: 'POST',
      body: JSON.stringify(incident)
    });
  }

  async updateIncidentStatus(id: string, status: string, root_cause?: string, notes?: string) {
    return this.request(`/incidents/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, root_cause, notes })
    });
  }

  // Enterprise Shift Handovers & Guard Logbook
  async getShifts() {
    return this.request('/shifts');
  }

  async createShift(shift: any) {
    return this.request('/shifts', {
      method: 'POST',
      body: JSON.stringify(shift)
    });
  }

  // Enterprise Guard Patrol Checkpoints
  async getPatrols() {
    return this.request('/patrols');
  }

  async recordPatrol(patrol: any) {
    return this.request('/patrols/check', {
      method: 'POST',
      body: JSON.stringify(patrol)
    });
  }

  // Disaster Recovery Encrypted Backup
  async getSystemBackup() {
    return this.request('/system/backup');
  }

  // Billing & CRM
  async getBilling() {
    return this.request('/billing');
  }

  async getCRM() {
    return this.request('/crm');
  }

  async getHealth() {
    return this.request('/health');
  }
}

export const api = new ApiClient();
