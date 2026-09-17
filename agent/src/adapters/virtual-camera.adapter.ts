import { CameraAdapter, CameraChannelInfo, DeviceInfo } from './camera-adapter.interface';

export class VirtualCameraAdapter implements CameraAdapter {
  name = 'Virtual Camera Adapter (Makoran Guard Simulator)';
  protocol = 'VIRTUAL';
  private connected = false;

  constructor(
    private cameraId: string,
    private cameraName: string,
    private zone: string
  ) {}

  async connect(): Promise<boolean> {
    this.connected = true;
    console.log(`[VirtualCamera] Connected to camera ${this.cameraId} (${this.cameraName})`);
    return true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    console.log(`[VirtualCamera] Disconnected camera ${this.cameraId}`);
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    return {
      manufacturer: 'Makoran Vision Systems',
      model: 'MK-GUARD-4K-PRO',
      serialNumber: 'MK-' + this.cameraId.toUpperCase(),
      firmwareVersion: 'v2.4.1-build2026',
      ipAddress: '192.168.1.120',
      port: 554
    };
  }

  async getChannels(): Promise<CameraChannelInfo[]> {
    return [
      {
        id: this.cameraId,
        channelIndex: 1,
        name: this.cameraName,
        streamUrl: `rtsp://127.0.0.1:8554/live/${this.cameraId}`,
        status: this.connected ? 'ONLINE' : 'OFFLINE',
        resolution: '1920x1080',
        fps: 25
      }
    ];
  }

  async getSnapshot(channelId: string): Promise<Buffer> {
    // Generate an image buffer or placeholder JPEG header
    // Minimal 1x1 or realistic JPEG buffer with EXIF tag for testing
    const base64Jpeg = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    return Buffer.from(base64Jpeg, 'base64');
  }

  async getStreamUrl(channelId: string): Promise<string> {
    return `rtsp://127.0.0.1:8554/live/${channelId}`;
  }
}
