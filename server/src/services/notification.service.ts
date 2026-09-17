import { v4 as uuidv4 } from 'uuid';
import { dbService } from '../database/db';
import { NotificationPayload } from '@makoran/shared';

export interface NotificationProvider {
  name: string;
  sendSMS(to: string, message: string): Promise<boolean>;
  sendCall(to: string, message: string): Promise<boolean>;
  sendPush(to: string, title: string, body: string, data?: any): Promise<boolean>;
}

/**
 * Mock/Realistic Provider for Iranian & Global SMS/Voice APIs (Kavenegar, Twilio, FarazSMS)
 */
class MakoranDefaultProvider implements NotificationProvider {
  name = 'Makoran Gateway Hub';

  async sendSMS(to: string, message: string): Promise<boolean> {
    console.log(`[SMS Hub] Sending SMS to ${to}: "${message}"`);
    return true;
  }

  async sendCall(to: string, message: string): Promise<boolean> {
    console.log(`[Voice Hub] Initiating Automated Alarm Phone Call to ${to}: "${message}"`);
    return true;
  }

  async sendPush(to: string, title: string, body: string, data?: any): Promise<boolean> {
    console.log(`[Push Hub] Dispatching Web/Mobile Push to ${to}: [${title}] ${body}`);
    return true;
  }
}

export class NotificationService {
  private provider: NotificationProvider = new MakoranDefaultProvider();

  public async dispatch(payload: NotificationPayload): Promise<void> {
    const { tenant_id, event_id, title, body, channels } = payload;
    const now = new Date().toISOString();

    // Fetch operators/admins to notify for this tenant
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
            await this.provider.sendSMS(user.phone, `${title}\n${body}\nMakoran Guard Security`);
          } else if (channel === 'phone_call' && user.phone) {
            await this.provider.sendCall(user.phone, `هشدار امنیتی سیستم مکران گارد. نفوذ تایید شد. سریعا بررسی نمایید.`);
          } else if (channel === 'push') {
            await this.provider.sendPush(user.id, title, body, payload.metadata);
          }

          // Record in DB
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
}

export const notificationService = new NotificationService();
