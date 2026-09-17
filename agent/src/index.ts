import { AgentClient } from './core/agent-client';

const CLOUD_HOST = process.env.CLOUD_HOST || '127.0.0.1';
const CLOUD_PORT = process.env.CLOUD_PORT || '3000';
const AGENT_ID = process.env.AGENT_ID || 'agent-mini-01';
const TENANT_ID = process.env.TENANT_ID || 'tenant-makoran-01';
const AGENT_TOKEN = process.env.AGENT_TOKEN || 'agt_tok_makoran_secret_01';

const agent = new AgentClient({
  cloudWsUrl: `ws://${CLOUD_HOST}:${CLOUD_PORT}/ws/agent`,
  cloudApiUrl: `http://${CLOUD_HOST}:${CLOUD_PORT}`,
  agentId: AGENT_ID,
  tenantId: TENANT_ID,
  token: AGENT_TOKEN,
  heartbeatIntervalMs: 10000
});

agent.start();

process.on('SIGTERM', () => {
  console.log('[Agent] Received SIGTERM, shutting down...');
  agent.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Agent] Received SIGINT, shutting down...');
  agent.stop();
  process.exit(0);
});
