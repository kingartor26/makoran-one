import WebSocket from 'ws';
import os from 'os';
import { AgentTelemetry, AgentActionCommand } from '@makoran/shared';
import { CameraAdapter } from '../adapters/camera-adapter.interface';
import { VirtualCameraAdapter } from '../adapters/virtual-camera.adapter';
import { CommandExecutor } from './command-executor';
import { OfflineQueue } from './offline-queue';
import { OTAUpdater } from './ota-updater';
import { WebRTCStreamer } from './webrtc-streamer';

export interface AgentConfig {
  cloudWsUrl: string;
  cloudApiUrl: string;
  agentId: string;
  tenantId: string;
  token: string;
  heartbeatIntervalMs?: number;
}

export class AgentClient {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private backoffDelayMs = 2000;
  private readonly maxBackoffDelayMs = 30000;

  private adapters = new Map<string, CameraAdapter>();
  private queue: OfflineQueue;
  private otaUpdater: OTAUpdater;
  private commandExecutor: CommandExecutor;
  private streamer: WebRTCStreamer;

  constructor(private config: AgentConfig) {
    this.queue = new OfflineQueue();
    this.otaUpdater = new OTAUpdater();
    this.commandExecutor = new CommandExecutor(this.otaUpdater);
    this.streamer = new WebRTCStreamer();

    this.registerDefaultAdapters();
  }

  private registerDefaultAdapters(): void {
    // Register 4 camera feeds for the local site
    const c1 = new VirtualCameraAdapter('cam-01', 'دوربین ورودی اصلی (Main Entrance)', 'entrance');
    const c2 = new VirtualCameraAdapter('cam-02', 'دوربین پیرامونی دیوار شرقی (East Perimeter)', 'perimeter');
    const c3 = new VirtualCameraAdapter('cam-03', 'دوربین گیت خودرو و پلاک‌خوان (Gate LPR)', 'gate_lpr');
    const c4 = new VirtualCameraAdapter('cam-04', 'دوربین محوطه انبار و گاوصندوق (Secure Vault)', 'vault');

    this.adapters.set('cam-01', c1);
    this.adapters.set('cam-02', c2);
    this.adapters.set('cam-03', c3);
    this.adapters.set('cam-04', c4);

    c1.connect();
    c2.connect();
    c3.connect();
    c4.connect();
  }

  public start(): void {
    console.log(`[Agent] Starting Makoran Edge Gateway Agent (ID: ${this.config.agentId})...`);
    this.connect();
  }

  public stop(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  private connect(): void {
    const wsUrl = `${this.config.cloudWsUrl}?token=${this.config.token}`;
    console.log(`[Agent] Initiating secure outbound WebSocket connection to Cloud: ${this.config.cloudWsUrl}`);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        this.isConnected = true;
        this.backoffDelayMs = 2000; // Reset backoff
        console.log(`[Agent] ✅ Connected securely to Makoran Cloud Control Plane`);

        this.startHeartbeat();
        this.flushOfflineQueue();
      });

      this.ws.on('message', async (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
          await this.handleCloudMessage(msg);
        } catch (err) {
          console.error('[Agent] Failed to handle message from Cloud:', err);
        }
      });

      this.ws.on('close', (code, reason) => {
        this.isConnected = false;
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        console.warn(`[Agent] Connection lost to Cloud (Code: ${code}, Reason: ${reason}). Scheduling reconnect in ${this.backoffDelayMs}ms...`);
        this.scheduleReconnect();
      });

      this.ws.on('error', (err) => {
        console.error('[Agent] WebSocket transport error:', err.message);
      });
    } catch (err: any) {
      console.error('[Agent] Connect failure:', err.message);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.backoffDelayMs = Math.min(this.backoffDelayMs * 1.5, this.maxBackoffDelayMs);
      this.connect();
    }, this.backoffDelayMs);
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    const interval = this.config.heartbeatIntervalMs || 10000;

    this.sendHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, interval);
  }

  private sendHeartbeat(): void {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Collect low-power Mini PC hardware telemetry (Intel N100 / N95 simulation)
    const totalMem = os.totalmem() / (1024 * 1024);
    const freeMem = os.freemem() / (1024 * 1024);
    const usedMem = totalMem - freeMem;

    // Simulated light CPU usage (never heavy because AI is server-side!)
    const simulatedCpu = Math.round((4.0 + Math.random() * 5.0) * 10) / 10;

    const telemetry: AgentTelemetry = {
      agent_id: this.config.agentId,
      tenant_id: this.config.tenantId,
      version: this.otaUpdater.getVersion(),
      uptime_seconds: Math.floor(process.uptime()),
      cpu_usage_pct: simulatedCpu,
      memory_usage_mb: Math.round(usedMem),
      memory_total_mb: Math.round(totalMem),
      disk_used_gb: 34.5,
      disk_total_gb: 256.0,
      connected_cameras: this.adapters.size,
      active_webrtc_streams: this.streamer.getActiveCount(),
      ip_address: '192.168.1.105',
      status: 'ONLINE',
      timestamp: new Date().toISOString()
    };

    this.ws.send(JSON.stringify({
      type: 'heartbeat',
      payload: telemetry
    }));
  }

  private async handleCloudMessage(msg: any): Promise<void> {
    if (msg.type === 'welcome') {
      console.log(`[Agent] Cloud handshake accepted. Server time: ${msg.payload.serverTime}`);
    } else if (msg.type === 'command') {
      const cmd: AgentActionCommand = msg.payload;

      if (cmd.command === 'webrtc_start') {
        const { sessionId, streamUrl } = cmd.parameters || {};
        this.streamer.startStream(sessionId, cmd.channel_id || 'cam-01', streamUrl);
      } else if (cmd.command === 'webrtc_stop') {
        const { sessionId, reason } = cmd.parameters || {};
        this.streamer.stopStream(sessionId, reason);
      } else {
        // Relay, Siren, Buzzer, OTA
        const result = await this.commandExecutor.execute(cmd);

        // Send ACK back
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'command_ack',
            payload: {
              command: cmd.command,
              success: result.success,
              result: result.result,
              timestamp: new Date().toISOString()
            }
          }));
        }
      }
    }
  }

  private flushOfflineQueue(): void {
    const pending = this.queue.getPending();
    if (pending.length === 0) return;

    console.log(`[Agent] Syncing ${pending.length} buffered offline items with Cloud...`);
    for (const item of pending) {
      // In real scenario, post buffered items to /api/v1/events/sync
      this.queue.remove(item.id);
    }
    console.log(`[Agent] Offline queue sync completed.`);
  }

  public async captureAndUploadSnapshot(cameraId: string, eventType: string = 'human_detected'): Promise<any> {
    const adapter = this.adapters.get(cameraId);
    if (!adapter) throw new Error(`Camera ${cameraId} not found on this agent`);

    const snapshotBuffer = await adapter.getSnapshot(cameraId);
    const base64 = snapshotBuffer.toString('base64');

    // POST to Cloud Server AI Gateway API
    const response = await fetch(`${this.config.cloudApiUrl}/api/v1/ai/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.token}`
      },
      body: JSON.stringify({
        camera_id: cameraId,
        agent_id: this.config.agentId,
        event_type: eventType,
        image_base64: `data:image/jpeg;base64,${base64}`,
        priority: 'HIGH'
      })
    });

    return await response.json();
  }
}
