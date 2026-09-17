import assert from 'node:assert';
import { CameraDiscoveryService } from '../agent/src/core/camera-discovery.ts';

console.log('--- STARTING CAMERA DISCOVERY TEST ---');

async function runTest() {
  const discovery = new CameraDiscoveryService();
  const devices = await discovery.discover('192.168.1');

  console.log(`Discovered ${devices.length} ONVIF/RTSP devices:`);
  devices.forEach(d => {
    console.log(` - [${d.manufacturer}] IP: ${d.ip}:${d.port} (${d.protocol}) -> RTSP: ${d.rtspUrl}`);
  });

  assert(devices.length >= 3, 'Expected at least 3 discovered camera endpoints');
  const d1 = devices.find(d => d.ip === '192.168.1.120');
  assert(d1, 'Expected Dahua camera at 192.168.1.120');
  assert.strictEqual(d1.manufacturer, 'Dahua Technology');
  assert.strictEqual(d1.protocol, 'ONVIF');

  console.log('✅ CAMERA DISCOVERY VERIFIED: WS-DISCOVERY & RTSP PROBES FUNCTION CORRECTLY');
}

runTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
