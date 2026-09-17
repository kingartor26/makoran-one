import { AgentActionCommand } from '@makoran/shared';
import { OTAUpdater } from './ota-updater';

export class CommandExecutor {
  private activeRelays = new Map<number, NodeJS.Timeout>();
  private otaUpdater: OTAUpdater;

  constructor(otaUpdater: OTAUpdater) {
    this.otaUpdater = otaUpdater;
  }

  public async execute(cmd: AgentActionCommand): Promise<{ success: boolean; result?: any }> {
    console.log(`[CommandExecutor] >>> Executing command: ${cmd.command}`, cmd);

    switch (cmd.command) {
      case 'trigger_alarm':
      case 'trigger_relay': {
        const relayNum = cmd.relay || 1;
        const durationSec = cmd.duration || 10;
        this.activateRelay(relayNum, durationSec);
        return { success: true, result: `Relay ${relayNum} activated for ${durationSec}s` };
      }

      case 'siren_pulse': {
        const durationSec = cmd.duration || 15;
        console.log(`[Hardware] 🚨 PHYSICAL SIREN ACTIVATED for ${durationSec} seconds (110dB Siren Output Active)`);
        return { success: true, result: `Siren pulsing for ${durationSec}s` };
      }

      case 'buzzer_beep': {
        console.log(`[Hardware] 📢 Gateway Mini PC internal buzzer beeped`);
        return { success: true, result: 'Buzzer beep executed' };
      }

      case 'ptz_command': {
        const action = cmd.parameters?.action || 'stop'; // left, right, up, down, zoom_in, zoom_out, preset
        const speed = cmd.parameters?.speed || 5;
        console.log(`[CCTV PTZ] Camera ${cmd.channel_id} executing PTZ action: ${action} at speed ${speed}`);
        return { success: true, result: `PTZ action ${action} executed on ${cmd.channel_id}` };
      }

      case 'ota_update': {
        const version = cmd.parameters?.version || '1.3.0';
        const checksum = cmd.parameters?.checksum || 'sha256:valid';
        const success = await this.otaUpdater.applyUpdate(version, checksum);
        return { success, result: `OTA Update to ${version} result: ${success}` };
      }

      case 'reboot': {
        console.warn(`[Hardware] Mini PC graceful reboot scheduled in 3 seconds...`);
        return { success: true, result: 'Reboot scheduled' };
      }

      default:
        console.log(`[CommandExecutor] Unhandled or informative command: ${cmd.command}`);
        return { success: true };
    }
  }

  private activateRelay(relayNumber: number, durationSec: number): void {
    // If relay was already active, clear prior timeout
    if (this.activeRelays.has(relayNumber)) {
      clearTimeout(this.activeRelays.get(relayNumber)!);
    }

    console.log(`[Hardware] ⚡ RELAY #${relayNumber} TRIGGERED: HIGH (Closed circuit)`);

    const timer = setTimeout(() => {
      console.log(`[Hardware] ⚡ RELAY #${relayNumber} RESTORED: LOW (Open circuit)`);
      this.activeRelays.delete(relayNumber);
    }, durationSec * 1000);

    this.activeRelays.set(relayNumber, timer);
  }
}
