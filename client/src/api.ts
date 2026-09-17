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

  async getShopOrders() {
    return this.request('/ecommerce/orders');
  }

  async createShopOrder(order: any) {
    return this.request('/ecommerce/orders', {
      method: 'POST',
      body: JSON.stringify(order)
    });
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
