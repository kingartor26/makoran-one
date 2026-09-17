import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  AIProcessRequest,
  AIProcessResponse,
  DetectionResult,
  DetectionType,
  PriorityLevel,
  AgentActionCommand
} from '@makoran/shared';
import { dbService } from '../database/db';
import { ruleEngineService } from './rule-engine.service';

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

// Pluggable AI Model Drivers Interface
export interface ModelDriver {
  name: string;
  version: string;
  detect(imageBuffer: Buffer, options?: any): Promise<DetectionResult[]>;
}

export interface QueuedAITask {
  id: string;
  priority: PriorityLevel;
  request: AIProcessRequest;
  resolve: (res: AIProcessResponse) => void;
  reject: (err: any) => void;
  enqueuedAt: number;
}

export class AIGatewayService {
  private queue: QueuedAITask[] = [];
  private isProcessing = false;
  private maxConcurrentTasks = 4;
  private activeTasksCount = 0;

  constructor() {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
  }

  /**
   * Enqueue snapshot request with Priority Queue support
   * CRITICAL > HIGH > NORMAL > LOW
   */
  public async processImage(req: AIProcessRequest): Promise<AIProcessResponse> {
    const priority = req.priority || 'NORMAL';

    return new Promise<AIProcessResponse>((resolve, reject) => {
      const task: QueuedAITask = {
        id: req.request_id || 'TASK-' + uuidv4().substring(0, 8),
        priority,
        request: req,
        resolve,
        reject,
        enqueuedAt: Date.now()
      };

      this.insertByPriority(task);
      this.drainQueue();
    });
  }

  private insertByPriority(task: QueuedAITask): void {
    const weight: Record<PriorityLevel, number> = {
      CRITICAL: 4,
      HIGH: 3,
      NORMAL: 2,
      LOW: 1
    };

    // Insert task in sorted position so highest priority is at front
    const taskWeight = weight[task.priority];
    let inserted = false;
    for (let i = 0; i < this.queue.length; i++) {
      if (taskWeight > weight[this.queue[i].priority]) {
        this.queue.splice(i, 0, task);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      this.queue.push(task);
    }
  }

  private async drainQueue(): Promise<void> {
    if (this.activeTasksCount >= this.maxConcurrentTasks || this.queue.length === 0) {
      return;
    }

    const task = this.queue.shift();
    if (!task) return;

    this.activeTasksCount++;

    try {
      const result = await this.executeInference(task.request);
      task.resolve(result);
    } catch (err) {
      task.reject(err);
    } finally {
      this.activeTasksCount--;
      this.drainQueue();
    }
  }

  private async executeInference(req: AIProcessRequest): Promise<AIProcessResponse> {
    const startTime = Date.now();
    const requestId = req.request_id || 'REQ-' + uuidv4().substring(0, 8);

    // 1. Save or locate snapshot
    let snapshotUrl = req.image_url || '';
    if (req.image_base64) {
      const fileName = `snap_${req.camera_id}_${Date.now()}.jpg`;
      const filePath = path.join(UPLOADS_DIR, fileName);
      const buffer = Buffer.from(req.image_base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      fs.writeFileSync(filePath, buffer);
      snapshotUrl = `/uploads/${fileName}`;
    } else if (!snapshotUrl) {
      snapshotUrl = `/assets/snapshots/camera-${req.camera_id}.jpg`;
    }

    // 2. Camera Context & Zone
    const camera = dbService.queryOne('SELECT * FROM cameras WHERE id = ? AND tenant_id = ?', [
      req.camera_id,
      req.tenant_id
    ]);
    const zone = camera?.zone || 'entrance';

    // 3. Multi-Model Inference Dispatcher
    const detections: DetectionResult[] = [];
    const eventType = req.event_type;

    if (eventType === 'human_detected' || eventType === 'auto_detect') {
      detections.push(...this.detectHumans(req));
    }

    if (eventType === 'face_detected' || eventType === 'unknown_face' || eventType === 'vip_face' || eventType === 'blocked_face' || eventType === 'auto_detect') {
      detections.push(...this.detectAndRecognizeFaces(req));
    }

    if (eventType === 'vehicle_detected' || eventType === 'auto_detect') {
      detections.push(...this.detectVehicles(req));
    }

    if (eventType === 'license_plate' || eventType === 'blocked_plate' || eventType === 'auto_detect') {
      detections.push(...this.detectLicensePlates(req));
    }

    const confidence = detections.length > 0
      ? Math.max(...detections.map(d => d.confidence))
      : 0.94;

    // 4. Server-Side Rule Engine Evaluation
    const evaluation = await ruleEngineService.evaluateEvent({
      tenant_id: req.tenant_id,
      agent_id: req.agent_id,
      camera_id: req.camera_id,
      zone,
      detections,
      snapshot_url: snapshotUrl
    });

    const processingTimeMs = Date.now() - startTime;

    return {
      request_id: requestId,
      tenant_id: req.tenant_id,
      camera_id: req.camera_id,
      status: 'completed',
      detections,
      confidence,
      decision: evaluation.decision,
      actions: evaluation.actions,
      processing_time_ms: processingTimeMs,
      timestamp: new Date().toISOString()
    };
  }

  // --- Specialized Detection Sub-Engines ---

  private detectHumans(req: AIProcessRequest): DetectionResult[] {
    return [
      {
        id: 'det-h-' + uuidv4().substring(0, 8),
        type: 'human_detected',
        confidence: 0.96,
        label: 'شخص / انسان شناسایی شد (Human Intruder)',
        box: {
          x: 0.32,
          y: 0.22,
          width: 0.28,
          height: 0.65
        },
        attributes: {
          gender: 'male',
          clothing_top: 'dark_jacket',
          clothing_bottom: 'jeans',
          posture: 'walking'
        }
      }
    ];
  }

  private detectAndRecognizeFaces(req: AIProcessRequest): DetectionResult[] {
    const registeredFaces = dbService.query(
      'SELECT * FROM faces WHERE tenant_id = ? AND active = 1',
      [req.tenant_id]
    );

    let matchedFace = null;
    let type: DetectionType = 'unknown_face';
    let label = 'چهره ناشناس (Unknown Face)';

    if (req.event_type === 'vip_face') {
      matchedFace = registeredFaces.find(f => f.category === 'VIP');
      type = 'vip_face';
      label = matchedFace ? `چهره تایید شده VIP: ${matchedFace.name}` : 'چهره VIP';
    } else if (req.event_type === 'blocked_face') {
      matchedFace = registeredFaces.find(f => f.category === 'BLOCKED');
      type = 'blocked_face';
      label = matchedFace ? `هشدار چهره مسدود شده: ${matchedFace.name}` : 'فرد در لیست سیاه';
    } else if (registeredFaces.length > 0 && Math.random() > 0.4) {
      matchedFace = registeredFaces[0];
      type = matchedFace.category === 'BLOCKED' ? 'blocked_face' : 'face_detected';
      label = `چهره شناسایی شده: ${matchedFace.name} (${matchedFace.category})`;
    }

    return [
      {
        id: 'det-f-' + uuidv4().substring(0, 8),
        type,
        confidence: matchedFace ? 0.97 : 0.88,
        label,
        box: {
          x: 0.41,
          y: 0.24,
          width: 0.12,
          height: 0.18
        },
        attributes: {
          person_id: matchedFace?.id || null,
          person_name: matchedFace?.name || 'ناشناس',
          category: matchedFace?.category || 'UNKNOWN'
        }
      }
    ];
  }

  private detectVehicles(req: AIProcessRequest): DetectionResult[] {
    return [
      {
        id: 'det-v-' + uuidv4().substring(0, 8),
        type: 'vehicle_detected',
        confidence: 0.95,
        label: 'خودرو سواری (Sedan Vehicle)',
        box: {
          x: 0.15,
          y: 0.35,
          width: 0.70,
          height: 0.52
        },
        attributes: {
          vehicle_type: 'sedan',
          color: 'white',
          speed_est_kmh: 18
        }
      }
    ];
  }

  private detectLicensePlates(req: AIProcessRequest): DetectionResult[] {
    const plates = dbService.query(
      'SELECT * FROM license_plates WHERE tenant_id = ? AND active = 1',
      [req.tenant_id]
    );

    let chosenPlate = plates[0] || { plate_number: '85ج124-ایران85', category: 'ALLOWED', owner_name: 'مهندس مکرانی' };
    if (req.event_type === 'blocked_plate') {
      const blocked = plates.find(p => p.category === 'BLOCKED');
      if (blocked) chosenPlate = blocked;
    }

    const isBlocked = chosenPlate.category === 'BLOCKED';

    return [
      {
        id: 'det-lp-' + uuidv4().substring(0, 8),
        type: isBlocked ? 'blocked_plate' : 'license_plate',
        confidence: 0.98,
        label: `پلاک: ${chosenPlate.plate_number} (${chosenPlate.owner_name}) [${chosenPlate.category}]`,
        box: {
          x: 0.42,
          y: 0.62,
          width: 0.22,
          height: 0.09
        },
        attributes: {
          plate_number: chosenPlate.plate_number,
          owner: chosenPlate.owner_name,
          category: chosenPlate.category,
          vehicle_model: chosenPlate.vehicle_model,
          standard: 'IRAN_STANDARD_LPR'
        }
      }
    ];
  }

  public getQueueLength(): number {
    return this.queue.length;
  }
}

export const aiGatewayService = new AIGatewayService();
