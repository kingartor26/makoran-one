import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  AIProcessRequest,
  AIProcessResponse,
  DetectionResult,
  DetectionType,
  AgentActionCommand
} from '@makoran/shared';
import { dbService } from '../database/db';
import { ruleEngineService } from './rule-engine.service';

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

export class AIGatewayService {
  constructor() {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
  }

  /**
   * Main entrypoint for processing camera snapshots through AI Gateway
   */
  public async processImage(req: AIProcessRequest): Promise<AIProcessResponse> {
    const startTime = Date.now();
    const requestId = req.request_id || 'REQ-' + uuidv4().substring(0, 8);

    // 1. Persist or save image reference
    let snapshotUrl = req.image_url || '';
    if (req.image_base64) {
      const fileName = `snap_${req.camera_id}_${Date.now()}.jpg`;
      const filePath = path.join(UPLOADS_DIR, fileName);
      const buffer = Buffer.from(req.image_base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      fs.writeFileSync(filePath, buffer);
      snapshotUrl = `/uploads/${fileName}`;
    } else if (!snapshotUrl) {
      // Default placeholder if none provided
      snapshotUrl = `/assets/snapshots/camera-${req.camera_id}.jpg`;
    }

    // 2. Fetch Camera and Zone Context
    const camera = dbService.queryOne('SELECT * FROM cameras WHERE id = ? AND tenant_id = ?', [
      req.camera_id,
      req.tenant_id
    ]);
    const zone = camera?.zone || 'entrance';

    // 3. Run Inference Engines based on requested event type or camera config
    const detections: DetectionResult[] = [];
    const eventType = req.event_type;

    if (eventType === 'human_detected' || eventType === 'auto_detect') {
      const humanDetections = this.detectHumans(req);
      detections.push(...humanDetections);
    }

    if (eventType === 'face_detected' || eventType === 'unknown_face' || eventType === 'vip_face' || eventType === 'blocked_face' || eventType === 'auto_detect') {
      const faceDetections = this.detectAndRecognizeFaces(req);
      detections.push(...faceDetections);
    }

    if (eventType === 'vehicle_detected' || eventType === 'auto_detect') {
      const vehicleDetections = this.detectVehicles(req);
      detections.push(...vehicleDetections);
    }

    if (eventType === 'license_plate' || eventType === 'blocked_plate' || eventType === 'auto_detect') {
      const lprDetections = this.detectLicensePlates(req);
      detections.push(...lprDetections);
    }

    // Calculate overall confidence
    const confidence = detections.length > 0
      ? Math.max(...detections.map(d => d.confidence))
      : 0.94;

    // 4. Send to Server-Side Security Rule Engine for Decision Making
    const evaluation = await ruleEngineService.evaluateEvent({
      tenant_id: req.tenant_id,
      agent_id: req.agent_id,
      camera_id: req.camera_id,
      zone,
      detections,
      snapshot_url: snapshotUrl
    });

    const processingTimeMs = Date.now() - startTime;

    const response: AIProcessResponse = {
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

    return response;
  }

  // --- Sub-Engines ---

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
    // Check Tenant Face Directory to perform 1:N Recognition
    const registeredFaces = dbService.query('SELECT * FROM faces WHERE tenant_id = ? AND active = 1', [req.tenant_id]);
    
    // Check if specifically testing a blocked or VIP face
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
      // Sample match
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
    // Check against tenant's registered license plates
    const plates = dbService.query('SELECT * FROM license_plates WHERE tenant_id = ? AND active = 1', [req.tenant_id]);
    
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
          vehicle_model: chosenPlate.vehicle_model
        }
      }
    ];
  }
}

export const aiGatewayService = new AIGatewayService();
