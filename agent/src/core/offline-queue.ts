import fs from 'fs';
import path from 'path';

export interface QueuedItem {
  id: string;
  type: 'event' | 'snapshot';
  payload: any;
  timestamp: string;
  retries: number;
}

export class OfflineQueue {
  private queueFile: string;
  private items: QueuedItem[] = [];

  constructor(storageDir = path.resolve(__dirname, '../../data')) {
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    this.queueFile = path.join(storageDir, 'offline_queue.json');
    this.load();
  }

  private load(): void {
    if (fs.existsSync(this.queueFile)) {
      try {
        const content = fs.readFileSync(this.queueFile, 'utf8');
        this.items = JSON.parse(content);
      } catch (err) {
        console.error('[OfflineQueue] Failed to load queue:', err);
        this.items = [];
      }
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(this.queueFile, JSON.stringify(this.items, null, 2));
    } catch (err) {
      console.error('[OfflineQueue] Failed to save queue:', err);
    }
  }

  public enqueue(type: 'event' | 'snapshot', payload: any): void {
    const item: QueuedItem = {
      id: 'queue-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      type,
      payload,
      timestamp: new Date().toISOString(),
      retries: 0
    };
    this.items.push(item);
    this.save();
    console.log(`[OfflineQueue] Buffered ${type} in local queue (Total pending: ${this.items.length})`);
  }

  public getPending(): QueuedItem[] {
    return [...this.items];
  }

  public remove(id: string): void {
    this.items = this.items.filter(i => i.id !== id);
    this.save();
  }

  public count(): number {
    return this.items.length;
  }
}
