import { v4 as uuidv4 } from 'uuid';
import { dbService } from '../database/db';
import { NotificationPayload } from '@makoran/shared';

export interface SMSDriver {
  name: string;
  send(to: string, message: string): Promise<boolean>;
}

export interface VoiceDriver {
  name: string;
  call(to: string, message: string): Promise<boolean>;
}

export interface WebhookDriver {
  name: string;
  post(url: string, payload: any): Promise<boolean>;
}

// 1. Kavenegar SMS Driver (Iran Standard)
class KavenegarDriver implements SMSDriver {
  name = 'Kavenegar SMS Gateway';
  async send(to: string, message: string): Promise<boolean> {
    console.log(`[Kavenegar API] Sending OTP/Alarm SMS to ${to}: "${message.replace(/\n/g, ' ')}"`);
    return true;
  }
}

// 2. FarazSMS Driver
class FarazSMSDriver implements SMSDriver {
  name = 'FarazSMS Pattern Gateway';
  async send(to: string, message: string): Promise<boolean> {
    console.log(`[FarazSMS API] Dispatching Pattern Alarm to ${to}`);
    return true;
  }
}

// 3. Twilio SMS Driver (Global)
class TwilioDriver implements SMSDriver {
  name = 'Twilio International SMS';
  async send(to: string, message: string): Promise<boolean> {
    console.log(`[Twilio Global] Dispatching SMS to ${to}`);
    return true;
  }
}

// 4. Automated Alarm Voice Call Driver
class AutomatedVoiceCallDriver implements VoiceDriver {
  name = 'Makoran TTS Voice Alert Gateway';
  async call(to: string, message: string): Promise<boolean> {
    console.log(`[Voice IVR] 📞 Placing automated high-priority phone call to ${to}: "${message}"`);
    return true;
  }
}

// 5. Generic Webhook Driver
class WebhookDriverImpl implements WebhookDriver {
  name = 'Enterprise Security Webhook';
  async post(url: string, payload: any): Promise<boolean> {
    console.log(`[Webhook] Dispatching JSON event payload to ${url}`);
    return true;
  }
}

export class NotificationService {
  private smsDrivers: Map<string, SMSDriver> = new Map();
  private activeSMSDriver: SMSDriver;
  private voiceDriver: VoiceDriver;
  private webhookDriver: WebhookDriver;

  constructor() {
    const kavenegar = new KavenegarDriver();
    const faraz = new FarazSMSDriver();
    const twilio = new TwilioDriver();

    this.smsDrivers.set('kavenegar', kavenegar);
    this.smsDrivers.set('faraz', faraz);
    this.smsDrivers.set('twilio', twilio);

    this.activeSMSDriver = kavenegar; // Default
    this.voiceDriver = new AutomatedVoiceCallDriver();
    this.webhookDriver = new WebhookDriverImpl();
  }

  public setSMSDriver(name: string): boolean {
    const driver = this.smsDrivers.get(name.toLowerCase());
    if (driver) {
      this.activeSMSDriver = driver;
      console.log(`[NotificationService] Active SMS driver changed to: ${driver.name}`);
      return true;
    }
    return false;
  }

  public async dispatch(payload: NotificationPayload): Promise<void> {
    const { tenant_id, event_id, title, body, channels } = payload;
    const now = new Date().toISOString();

    const users = dbService.query(
      'SELECT id, full_name, phone, email, role FROM users WHERE tenant_id = ? AND status = ?',
      [tenant_id, 'ACTIVE']
    );

    for (const channel of channels) {
      for (const user of users) {
        const recipient = channel === 'email' ? user.email : (user.phone || user.email);
        const notificationId = 'notif-' + uuidv4().substring(0, 10);

        try {
          if (channel === 'sms' && user.phone) {
            await this.activeSMSDriver.send(user.phone, `${title}\n${body}\nMakoran Guard`);
          } else if (channel === 'phone_call' && user.phone) {
            await this.voiceDriver.call(user.phone, `هشدار امنیتی سیستم مکران گارد. رویداد نفوذ ثبت شد. لطفا سامانه را بررسی کنید.`);
          } else if (channel === 'push') {
            console.log(`[WebPush] Dispatching Web/Mobile Push to ${user.id} (${user.fullName})`);
          } else if (channel === 'webhook' && payload.metadata?.webhook_url) {
            await this.webhookDriver.post(payload.metadata.webhook_url, payload);
          }

          dbService.run(`
            INSERT INTO notifications (id, tenant_id, event_id, channel, recipient, title, body, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            notificationId,
            tenant_id,
            event_id,
            channel,
            recipient,
            title,
            body,
            'SENT',
            now
          ]);
        } catch (err) {
          console.error(`[NotificationService] Error sending ${channel} to ${recipient}:`, err);
        }
      }
    }
  }

  public getHistory(tenantId: string, limit = 50): any[] {
    return dbService.query(
      'SELECT * FROM notifications WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?',
      [tenantId, limit]
    );
  }

  public getAvailableDrivers(): string[] {
    return Array.from(this.smsDrivers.keys());
  }
}

export const notificationService = new NotificationService();
