import { spawn } from 'child_process';
import path from 'path';

console.log('=======================================================');
console.log('🚀 BOOTING MAKORAN ONE & MAKORAN GUARD FULL SYSTEM');
console.log('=======================================================');

// 1. Start Server Brain
const serverProc = spawn('npx', ['tsx', 'server/src/index.ts'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: '3000', HOST: '0.0.0.0' },
  stdio: 'inherit'
});

// 2. Wait 3 seconds, then start Edge Gateway Agent
setTimeout(() => {
  console.log('[Runner] Booting Makoran Edge Gateway Agent (Mini PC)...');
  const agentProc = spawn('npx', ['tsx', 'agent/src/index.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, CLOUD_HOST: '127.0.0.1', CLOUD_PORT: '3000', AGENT_TOKEN: 'agt_tok_makoran_secret_01' },
    stdio: 'inherit'
  });

  agentProc.on('exit', (code) => {
    console.warn(`[Runner] Agent exited with code ${code}`);
  });
}, 3000);

process.on('SIGTERM', () => {
  serverProc.kill();
  process.exit(0);
});

process.on('SIGINT', () => {
  serverProc.kill();
  process.exit(0);
});
