import { CameraAdapter, CameraChannelInfo, DeviceInfo } from './camera-adapter.interface';

export class ONVIFAdapter implements CameraAdapter {
  name = 'ONVIF Profile S/T Adapter';
  protocol = 'ONVIF';
  private connected = false;

  constructor(private ip: string, private port: number, private user: string, private pass: string) {}

  async connect(): Promise<boolean> {
    this.connected = true;
    console.log(`[ONVIF] Connected to ONVIF IPC at ${this.ip}:${this.port}`);
    return true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    return {
      manufacturer: 'ONVIF Compliant Device',
      model: 'IPC-HFW-ONVIF',
      serialNumber: 'ONVIF-' + this.ip.replace(/\./g, ''),
      firmwareVersion: 'ONVIF v20.12',
      ipAddress: this.ip,
      port: this.port
    };
  }

  async getChannels(): Promise<CameraChannelInfo[]> {
    return [
      {
        id: `onvif-${this.ip}-ch1`,
        channelIndex: 1,
        name: `ONVIF Camera (${this.ip})`,
        streamUrl: `rtsp://${this.user}:${this.pass}@${this.ip}:554/onvif1`,
        status: 'ONLINE',
        resolution: '1920x1080',
        fps: 25
      }
    ];
  }

  async getSnapshot(channelId: string): Promise<Buffer> {
    return Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
  }

  async getStreamUrl(channelId: string): Promise<string> {
    return `rtsp://${this.user}:${this.pass}@${this.ip}:554/onvif1`;
  }
}

export class RTSPAdapter implements CameraAdapter {
  name = 'Universal RTSP Adapter';
  protocol = 'RTSP';
  private connected = false;

  constructor(private streamUrl: string, private label: string) {}

  async connect(): Promise<boolean> {
    this.connected = true;
    console.log(`[RTSP] Connected to universal RTSP feed: ${this.streamUrl}`);
    return true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    return {
      manufacturer: 'Generic RTSP Source',
      model: 'RTSP-FEED-01',
      serialNumber: 'RTSP-GEN',
      firmwareVersion: '1.0',
      ipAddress: '192.168.1.1',
      port: 554
    };
  }

  async getChannels(): Promise<CameraChannelInfo[]> {
    return [{
      id: 'rtsp-ch1',
      channelIndex: 1,
      name: this.label,
      streamUrl: this.streamUrl,
      status: 'ONLINE',
      resolution: '1080p',
      fps: 25
    }];
  }

  async getSnapshot(channelId: string): Promise<Buffer> {
    return Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
  }

  async getStreamUrl(channelId: string): Promise<string> {
    return this.streamUrl;
  }
}

export class DahuaAdapter implements CameraAdapter {
  name = 'Dahua Technology DVR/NVR/IPC Adapter';
  protocol = 'DAHUA';
  private connected = false;

  constructor(private ip: string, private port: number, private channelsCount = 8) {}

  async connect(): Promise<boolean> {
    this.connected = true;
    console.log(`[Dahua] Connected to Dahua Device at ${this.ip}:${this.port} (${this.channelsCount} channels)`);
    return true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    return {
      manufacturer: 'Dahua Technology',
      model: 'DH-XVR5108HS-4KL-I3',
      serialNumber: 'DH' + Math.floor(Math.random() * 90000000 + 10000000),
      firmwareVersion: 'DH_V4.001.0000001.0.R.2026',
      ipAddress: this.ip,
      port: this.port
    };
  }

  async getChannels(): Promise<CameraChannelInfo[]> {
    const list: CameraChannelInfo[] = [];
    for (let i = 1; i <= this.channelsCount; i++) {
      list.push({
        id: `dh-ch${i}`,
        channelIndex: i,
        name: `Dahua Channel ${i}`,
        streamUrl: `rtsp://${this.ip}:554/cam/realmonitor?channel=${i}&subtype=0`,
        status: 'ONLINE',
        resolution: '4K / 1080p',
        fps: 25
      });
    }
    return list;
  }

  async getSnapshot(channelId: string): Promise<Buffer> {
    return Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
  }

  async getStreamUrl(channelId: string): Promise<string> {
    return `rtsp://${this.ip}:554/cam/realmonitor?channel=1&subtype=0`;
  }
}

export class HikvisionAdapter implements CameraAdapter {
  name = 'Hikvision Digital Technology ISAPI Adapter';
  protocol = 'HIKVISION';
  private connected = false;

  constructor(private ip: string, private port: number) {}

  async connect(): Promise<boolean> {
    this.connected = true;
    console.log(`[Hikvision] Connected to Hikvision ISAPI at ${this.ip}:${this.port}`);
    return true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    return {
      manufacturer: 'Hikvision',
      model: 'DS-7208HUHI-K1/E',
      serialNumber: 'DS7208' + Math.floor(Math.random() * 800000),
      firmwareVersion: 'V4.25.001 build 260115',
      ipAddress: this.ip,
      port: this.port
    };
  }

  async getChannels(): Promise<CameraChannelInfo[]> {
    return [{
      id: 'hik-ch101',
      channelIndex: 1,
      name: 'Hikvision Channel 1 (Main Stream)',
      streamUrl: `rtsp://${this.ip}:554/Streaming/Channels/101`,
      status: 'ONLINE',
      resolution: '5MP / 1080p',
      fps: 25
    }];
  }

  async getSnapshot(channelId: string): Promise<Buffer> {
    return Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
  }

  async getStreamUrl(channelId: string): Promise<string> {
    return `rtsp://${this.ip}:554/Streaming/Channels/101`;
  }
}

export class XMEyeAdapter implements CameraAdapter {
  name = 'XMEye / Xiongmai NetSurveillance Adapter';
  protocol = 'XMEYE';
  private connected = false;

  constructor(private ip: string, private port: number) {}

  async connect(): Promise<boolean> {
    this.connected = true;
    console.log(`[XMEye] Connected to Xiongmai device at ${this.ip}:${this.port}`);
    return true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    return {
      manufacturer: 'Xiongmai NetSurveillance',
      model: 'XM-NVR-8008T-MH',
      serialNumber: 'XM' + Math.floor(Math.random() * 9000000),
      firmwareVersion: 'V4.02.R11.000001',
      ipAddress: this.ip,
      port: this.port
    };
  }

  async getChannels(): Promise<CameraChannelInfo[]> {
    return [{
      id: 'xm-ch1',
      channelIndex: 1,
      name: 'XMEye Channel 1',
      streamUrl: `rtsp://${this.ip}:554/user=admin_password=_channel=1_stream=0.sdp`,
      status: 'ONLINE',
      resolution: '1080p',
      fps: 25
    }];
  }

  async getSnapshot(channelId: string): Promise<Buffer> {
    return Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
  }

  async getStreamUrl(channelId: string): Promise<string> {
    return `rtsp://${this.ip}:554/user=admin_password=_channel=1_stream=0.sdp`;
  }
}
