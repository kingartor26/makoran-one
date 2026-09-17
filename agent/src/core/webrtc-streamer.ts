export interface StreamSession {
  sessionId: string;
  cameraId: string;
  streamUrl: string;
  active: boolean;
  startedAt: number;
}

export class WebRTCStreamer {
  private activeStreams = new Map<string, StreamSession>();

  public startStream(sessionId: string, cameraId: string, streamUrl: string): boolean {
    if (this.activeStreams.has(sessionId)) {
      console.log(`[WebRTCStreamer] Session ${sessionId} already active.`);
      return true;
    }

    console.log(`[WebRTCStreamer] ▶ START LIVE STREAM for camera ${cameraId} (Session: ${sessionId})`);
    console.log(`[WebRTCStreamer] Initiating RTSP demux -> WebRTC H.264 RTP packetizer on-demand...`);

    this.activeStreams.set(sessionId, {
      sessionId,
      cameraId,
      streamUrl,
      active: true,
      startedAt: Date.now()
    });

    return true;
  }

  public stopStream(sessionId: string, reason = 'stop_command'): boolean {
    const session = this.activeStreams.get(sessionId);
    if (!session) return false;

    console.log(`[WebRTCStreamer] ⏹ STOP LIVE STREAM for camera ${session.cameraId} (Session: ${sessionId}, Reason: ${reason})`);
    console.log(`[WebRTCStreamer] Released RTSP decoder and WebRTC peer connection.`);

    this.activeStreams.delete(sessionId);
    return true;
  }

  public getActiveCount(): number {
    return this.activeStreams.size;
  }
}
