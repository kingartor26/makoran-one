import http from 'http';
import express from 'express';
import cors from 'cors';
import path from 'path';
import WebSocket from 'ws';
import { dbService } from './database/db';
import { apiRouter } from './routes/api.routes';
import { agentService } from './services/agent.service';
import { authService } from './services/auth.service';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

async function bootstrap() {
  // 1. Initialize SQLite WASM Database
  console.log('[Bootstrap] Initializing Makoran One Core Database...');
  await dbService.init();

  const app = express();
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Static assets & uploads
  app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));
  app.use('/assets', express.static(path.resolve(__dirname, '../../assets')));

  // REST API v1
  app.use('/api/v1', apiRouter);

  // Serve Client frontend if built
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws') || req.path.startsWith('/uploads') || req.path.startsWith('/assets')) {
      return next();
    }
    const indexHtml = path.join(clientDist, 'index.html');
    if (fs.existsSync(indexHtml)) {
      res.sendFile(indexHtml);
    } else {
      res.json({
        status: 'MAKORAN_ONE_API_RUNNING',
        message: 'Makoran One & Makoran Guard Cloud Brain is operational',
        docs: '/api/v1/health'
      });
    }
  });

  const server = http.createServer(app);

  // 2. Setup WebSocket Server for Agents and Clients
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws: WebSocket, req) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const pathname = url.pathname;

    // A. Agent Connection Plane
    if (pathname === '/ws/agent') {
      const token = url.searchParams.get('token') || (req.headers['x-agent-token'] as string);
      if (!token) {
        console.warn('[WS Agent] Unauthorized connection attempt without token');
        ws.close(4001, 'Unauthorized: Token required');
        return;
      }

      const auth = agentService.authenticateAgent(token);
      if (!auth) {
        console.warn(`[WS Agent] Invalid agent token: ${token}`);
        ws.close(4002, 'Unauthorized: Invalid token');
        return;
      }

      agentService.registerConnection(auth.agentId, auth.tenantId, ws);

      ws.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'heartbeat') {
            agentService.handleHeartbeat(auth.agentId, msg.payload);
          } else if (msg.type === 'command_ack') {
            console.log(`[WS Agent] Command ACK from ${auth.agentId}:`, msg.payload);
          }
        } catch (err) {
          console.error('[WS Agent] Error processing message:', err);
        }
      });

      ws.on('close', () => {
        agentService.handleDisconnection(auth.agentId);
      });

      // Send initial welcome & config sync
      ws.send(JSON.stringify({
        type: 'welcome',
        payload: {
          agentId: auth.agentId,
          tenantId: auth.tenantId,
          serverTime: new Date().toISOString()
        }
      }));
    }

    // B. Client Real-Time Events Plane
    else if (pathname === '/ws/client') {
      const token = url.searchParams.get('token');
      if (token) {
        try {
          authService.verifyToken(token);
        } catch (err) {
          ws.close(4003, 'Invalid JWT');
          return;
        }
      }

      // Register listener to push real-time events to connected UI client
      const unregister = agentService.registerClientListener((event, data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ event, data }));
        }
      });

      ws.on('close', () => {
        unregister();
      });
    } else {
      ws.close(4004, 'Unknown endpoint');
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`=======================================================`);
    console.log(`🚀 MAKORAN ONE & MAKORAN GUARD CLOUD BRAIN STARTED`);
    console.log(`📡 HTTP Server listening on http://${HOST}:${PORT}`);
    console.log(`⚡ WebSocket Agent Gateway on ws://${HOST}:${PORT}/ws/agent`);
    console.log(`👁️ WebSocket Client Live on ws://${HOST}:${PORT}/ws/client`);
    console.log(`=======================================================`);
  });
}

bootstrap().catch(err => {
  console.error('[Bootstrap] Fatal startup error:', err);
  process.exit(1);
});
