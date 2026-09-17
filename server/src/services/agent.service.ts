import WebSocket from 'ws';
import { dbService } from '../database/db';
import { AgentTelemetry, AgentActionCommand } from '@makoran/shared';

export interface ConnectedAgent {
  agentId: string;
  tenantId: string;
  ws: WebSocket;
  connectedAt: Date;
  lastHeartbeat: Date;
  telemetry?: AgentTelemetry;
}

export class AgentService {
  private activeAgents = new Map<string, ConnectedAgent>();
  private clientListeners = new Set<(event: string, data: any) => void>();

  public registerClientListener(listener: (event: string, data: any) => void): () => void {
    this.clientListeners.add(listener);
    return () => this.clientListeners.delete(listener);
  }

  public broadcastToClients(event: string, data: any): void {
    for (const listener of this.clientListeners) {
      try {
        listener(event, data);
      } catch (err) {
        console.error('[AgentService] Broadcast listener error:', err);
      }
    }
  }

  public authenticateAgent(token: string): { agentId: string; tenantId: string; name: string } | null {
    const agent = dbService.queryOne(
      'SELECT id, tenant_id, name, token, status FROM agents WHERE token = ?',
      [token]
    );
    if (!agent) return null;
    return {
      agentId: agent.id,
      tenantId: agent.tenant_id,
      name: agent.name
    };
  }

  public registerConnection(agentId: string, tenantId: string, ws: WebSocket): void {
    this.activeAgents.set(agentId, {
      agentId,
      tenantId,
      ws,
      connectedAt: new Date(),
      lastHeartbeat: new Date()
    });

    const now = new Date().toISOString();
    dbService.run('UPDATE agents SET status = ?, last_heartbeat = ? WHERE id = ?', ['ONLINE', now, agentId]);
    console.log(`[AgentService] Agent connected: ${agentId} for tenant ${tenantId}`);

    this.broadcastToClients('agent_status_change', {
      agentId,
      tenantId,
      status: 'ONLINE',
      timestamp: now
    });
  }

  public handleHeartbeat(agentId: string, telemetry: AgentTelemetry): void {
    const conn = this.activeAgents.get(agentId);
    if (conn) {
      conn.lastHeartbeat = new Date();
      conn.telemetry = telemetry;
    }

    const now = new Date().toISOString();
    dbService.run(`
      UPDATE agents 
      SET status = ?, 
          version = ?, 
          ip_address = ?, 
          cpu_usage = ?, 
          memory_usage_mb = ?, 
          memory_total_mb = ?, 
          disk_used_gb = ?, 
          disk_total_gb = ?, 
          uptime_seconds = ?, 
          last_heartbeat = ? 
      WHERE id = ?
    `, [
      telemetry.status || 'ONLINE',
      telemetry.version || '1.0.0',
      telemetry.ip_address || '',
      telemetry.cpu_usage_pct || 0,
      telemetry.memory_usage_mb || 0,
      telemetry.memory_total_mb || 0,
      telemetry.disk_used_gb || 0,
      telemetry.disk_total_gb || 0,
      telemetry.uptime_seconds || 0,
      now,
      agentId
    ]);

    this.broadcastToClients('agent_telemetry', telemetry);
  }

  public handleDisconnection(agentId: string): void {
    this.activeAgents.delete(agentId);
    const now = new Date().toISOString();
    dbService.run('UPDATE agents SET status = ? WHERE id = ?', ['OFFLINE', agentId]);
    console.log(`[AgentService] Agent disconnected: ${agentId}`);

    this.broadcastToClients('agent_status_change', {
      agentId,
      status: 'OFFLINE',
      timestamp: now
    });
  }

  public sendCommand(agentId: string, command: AgentActionCommand): boolean {
    const conn = this.activeAgents.get(agentId);
    if (!conn || conn.ws.readyState !== WebSocket.OPEN) {
      console.warn(`[AgentService] Cannot send command to ${agentId}: Agent not connected`);
      return false;
    }

    try {
      conn.ws.send(JSON.stringify({
        type: 'command',
        payload: command
      }));
      console.log(`[AgentService] Dispatched command to Agent ${agentId}:`, command.command);
      return true;
    } catch (err) {
      console.error(`[AgentService] Failed to send command to ${agentId}:`, err);
      return false;
    }
  }

  public isAgentOnline(agentId: string): boolean {
    const conn = this.activeAgents.get(agentId);
    return !!(conn && conn.ws.readyState === WebSocket.OPEN);
  }

  public getAllAgents(tenantId: string): any[] {
    const agents = dbService.query('SELECT * FROM agents WHERE tenant_id = ? ORDER BY created_at DESC', [tenantId]);
    return agents.map(a => ({
      ...a,
      is_live_connected: this.isAgentOnline(a.id)
    }));
  }

  public getAgentById(tenantId: string, agentId: string): any {
    const agent = dbService.queryOne('SELECT * FROM agents WHERE tenant_id = ? AND id = ?', [tenantId, agentId]);
    if (!agent) return null;
    return {
      ...agent,
      is_live_connected: this.isAgentOnline(agent.id)
    };
  }
}

export const agentService = new AgentService();
