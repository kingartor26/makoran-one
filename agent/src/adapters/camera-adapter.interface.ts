export interface CameraChannelInfo {
  id: string;
  channelIndex: number;
  name: string;
  streamUrl: string;
  snapshotUrl?: string;
  status: 'ONLINE' | 'OFFLINE';
  resolution?: string;
  fps?: number;
}

export interface DeviceInfo {
  manufacturer: string;
  model: string;
  serialNumber: string;
  firmwareVersion: string;
  ipAddress: string;
  port: number;
}

export interface CameraAdapter {
  name: string;
  protocol: string;
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  getDeviceInfo(): Promise<DeviceInfo>;
  getChannels(): Promise<CameraChannelInfo[]>;
  getSnapshot(channelId: string): Promise<Buffer>;
  getStreamUrl(channelId: string): Promise<string>;
  getEvents?(): Promise<any[]>;
}
