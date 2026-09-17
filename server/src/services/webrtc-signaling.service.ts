import { v4 as uuidv4 } from 'uuid';
import { agentService } from './agent.service';
import { dbService } from '../database/db';

export interface WebRTCSession {
  sessionId: string;
  tenantId: string;
  agentId: string;
  cameraId: string;
  clientId: string;
  status: 'INITIATING' | 'STREAMING' | 'CLOSED';
  createdAt: number;
  lastHeartbeat: number;
  idleTimer?: NodeJS.Timeout;
}

export class WebRTCSignalingService {
  private sessions = new Map<string, WebRTCSession>();
  private readonly IDLE_TIMEOUT_MS = 60000; // Auto stop after 60s of inactivity

  /**
   * Request live view: user explicitly opens camera stream
   */
  public async requestLiveStream(
    tenantId: string,
    agentId: string,
    cameraId: string,
    clientId: string
  ): Promise<{ sessionId: string; iceServers: any[] }> {
    const camera = dbService.queryOne('SELECT * FROM cameras WHERE id = ? AND tenant_id = ?', [
      cameraId,
      tenantId
    ]);

    if (!camera) {
      throw new Error('دوربین مورد نظر یافت نشد (Camera not found)');
    }

    const sessionId = 'webrtc-sess-' + uuidv4().substring(0, 8);

    const session: WebRTCSession = {
      sessionId,
      tenantId,
      agentId,
      cameraId,
      clientId,
      status: 'INITIATING',
      createdAt: Date.now(),
      lastHeartbeat: Date.now()
    };

    // Auto idle timeout
    session.idleTimer = setTimeout(() => {
      console.log(`[WebRTC] Session ${sessionId} timed out due to idle.`);
      this.stopLiveStream(sessionId, 'idle_timeout');
    }, this.IDLE_TIMEOUT_MS);

    this.sessions.set(sessionId, session);

    // Notify Agent to initiate stream pipeline
    const dispatched = agentService.sendCommand(agentId, {
      command: 'webrtc_start',
      channel_id: cameraId,
      parameters: {
        sessionId,
        streamUrl: camera.stream_url,
        protocol: camera.protocol
      },
      issued_at: new Date().toISOString()
    });

    if (!dispatched) {
      this.sessions.delete(sessionId);
      throw new Error('ارتباط با مینی پی‌سی گیت‌وی برقرار نیست (Agent is offline)');
    }

    return {
      sessionId,
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
  }

  /**
   * Relay SDP offer/answer between Client and Agent
   */
  public relaySignal(sessionId: string, signal: any, from: 'client' | 'agent'): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`[WebRTC] Session ${sessionId} not found for signal relay.`);
      return false;
    }

    session.lastHeartbeat = Date.now();

    if (from === 'client') {
      // Forward to Agent
      return agentService.sendCommand(session.agentId, {
        command: 'webrtc_start',
        channel_id: session.cameraId,
        parameters: {
          sessionId,
          signal
        },
        issued_at: new Date().toISOString()
      });
    } else {
      // Forward to Client
      agentService.broadcastToClients('webrtc_signal_' + sessionId, signal);
      return true;
    }
  }

  /**
   * Stop stream when user leaves page or clicks stop
   */
  public stopLiveStream(sessionId: string, reason = 'user_stopped'): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    if (session.idleTimer) {
      clearTimeout(session.idleTimer);
    }

    session.status = 'CLOSED';
    this.sessions.delete(sessionId);

    console.log(`[WebRTC] Live View stopped for camera ${session.cameraId} (Reason: ${reason})`);

    // Signal Agent to immediately close RTSP and release WebRTC pipeline
    agentService.sendCommand(session.agentId, {
      command: 'webrtc_stop',
      channel_id: session.cameraId,
      parameters: { sessionId, reason },
      issued_at: new Date().toISOString()
    });

    agentService.broadcastToClients('webrtc_closed_' + sessionId, { reason });
    return true;
  }

  public getActiveSessionsCount(): number {
    return this.sessions.size;
  }
}

export const webrtcSignalingService = new WebRTCSignalingService();
