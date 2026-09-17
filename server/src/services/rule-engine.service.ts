import { v4 as uuidv4 } from 'uuid';
import { dbService } from '../database/db';
import { DetectionResult, AgentActionCommand } from '@makoran/shared';
import { agentService } from './agent.service';
import { notificationService } from './notification.service';

export interface RuleEvaluationInput {
  tenant_id: string;
  agent_id: string;
  camera_id: string;
  zone: string;
  detections: DetectionResult[];
  snapshot_url: string;
}

export interface RuleEvaluationResult {
  decision: 'alarm' | 'warning' | 'info' | 'ignore';
  alarm_triggered: boolean;
  actions: AgentActionCommand[];
  event_id: string;
  alarm_id?: string;
}

export class RuleEngineService {
  /**
   * Evaluates detections against tenant's armed state, schedules, camera zones, and rules
   */
  public async evaluateEvent(input: RuleEvaluationInput): Promise<RuleEvaluationResult> {
    const { tenant_id, agent_id, camera_id, zone, detections, snapshot_url } = input;
    const now = new Date().toISOString();

    // 1. Fetch current Makoran Guard state for this tenant
    const guardState = dbService.queryOne(
      'SELECT armed_state, alarm_status FROM guard_state WHERE tenant_id = ?',
      [tenant_id]
    ) || { armed_state: 'ARMED_AWAY', alarm_status: 'RESOLVED' };

    const currentArmedState = guardState.armed_state;

    // 2. Fetch active rules for this tenant
    const rules = dbService.query(
      'SELECT * FROM alarm_rules WHERE tenant_id = ? AND enabled = 1',
      [tenant_id]
    );

    let shouldTriggerAlarm = false;
    let matchedRule: any = null;
    let actionsToExecute: AgentActionCommand[] = [];

    // Evaluate each detection
    const primaryDetection = detections[0] || {
      id: 'det-gen',
      type: 'motion_detected',
      confidence: 0.9,
      label: 'حرکت در محوطه'
    };

    for (const rule of rules) {
      try {
        const armedStates = JSON.parse(rule.armed_states || '[]');
        const eventTypes = JSON.parse(rule.event_types || '[]');
        const cameraIds = JSON.parse(rule.camera_ids || '[]');
        const zones = JSON.parse(rule.zones || '[]');
        const ruleActions = JSON.parse(rule.actions || '{}');

        // Check Armed State match
        const matchesArmedState = armedStates.length === 0 || armedStates.includes(currentArmedState);
        if (!matchesArmedState && currentArmedState === 'DISARMED') {
          // If disarmed and rule requires armed state, continue
          continue;
        }

        // Check Camera / Zone match
        const matchesCamera = cameraIds.length === 0 || cameraIds.includes(camera_id);
        const matchesZone = zones.length === 0 || zones.includes(zone);

        // Check Event Type match
        const matchesEvent = detections.some(d => eventTypes.includes(d.type));

        if (matchesArmedState && matchesCamera && matchesZone && matchesEvent) {
          shouldTriggerAlarm = true;
          matchedRule = rule;

          // Build Agent Action Commands
          if (ruleActions.trigger_alarm) {
            actionsToExecute.push({
              command: 'trigger_alarm',
              relay: ruleActions.relay_output || 1,
              duration: ruleActions.alarm_duration_sec || 15,
              issued_at: now
            });
            actionsToExecute.push({
              command: 'siren_pulse',
              duration: ruleActions.alarm_duration_sec || 15,
              issued_at: now
            });
          }

          break; // First matching high-priority rule triggers
        }
      } catch (err) {
        console.error('[RuleEngine] Error parsing rule:', err);
      }
    }

    const decision = shouldTriggerAlarm ? 'alarm' : (detections.length > 0 ? 'info' : 'ignore');
    const eventId = 'evt-' + uuidv4().substring(0, 10);

    // 3. Persist Event to database
    dbService.run(`
      INSERT INTO events (id, tenant_id, agent_id, camera_id, event_type, confidence, label, details, snapshot_url, decision, alarm_triggered, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      eventId,
      tenant_id,
      agent_id,
      camera_id,
      primaryDetection.type,
      primaryDetection.confidence,
      primaryDetection.label || primaryDetection.type,
      JSON.stringify(detections),
      snapshot_url,
      decision,
      shouldTriggerAlarm ? 1 : 0,
      now
    ]);

    let alarmId: string | undefined = undefined;

    // 4. If ALARM triggered, create Alarm record, update tenant Guard State, dispatch commands to Agent, and notify users
    if (shouldTriggerAlarm) {
      alarmId = 'alm-' + uuidv4().substring(0, 10);
      dbService.run(`
        INSERT INTO alarms (id, tenant_id, event_id, camera_id, rule_id, status, notes, triggered_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        alarmId,
        tenant_id,
        eventId,
        camera_id,
        matchedRule?.id || null,
        'TRIGGERED',
        `هشدار ناشی از قانون امنیتی: ${matchedRule?.name || 'قانون امنیتی مکران'}`,
        now
      ]);

      // Update tenant guard state
      dbService.run(`
        UPDATE guard_state 
        SET alarm_status = 'TRIGGERED', siren_active = 1, relay_active = 1, last_state_change = ?
        WHERE tenant_id = ?
      `, [now, tenant_id]);

      // 5. Send Commands directly to the connected Agent on Mini PC
      for (const cmd of actionsToExecute) {
        agentService.sendCommand(agent_id, cmd);
      }

      // 6. Send Multi-Channel Notifications (Push, SMS, Phone Call)
      const ruleActions = matchedRule ? JSON.parse(matchedRule.actions || '{}') : {};
      const channels: ('push' | 'sms' | 'phone_call')[] = ['push'];
      if (ruleActions.send_sms) channels.push('sms');
      if (ruleActions.send_phone_call) channels.push('phone_call');

      notificationService.dispatch({
        tenant_id,
        event_id: eventId,
        title: `🚨 هشدار امنیتی مکران گارد (${matchedRule?.name || 'تشخیص نفوذ'})`,
        body: `رویداد: ${primaryDetection.label || primaryDetection.type} در زون ${zone} توسط دوربین ${camera_id}`,
        severity: 'CRITICAL',
        channels,
        image_url: snapshot_url,
        metadata: {
          alarm_id: alarmId,
          camera_id,
          agent_id,
          zone,
          confidence: primaryDetection.confidence
        }
      });
    }

    // Broadcast event to connected browser clients
    agentService.broadcastToClients('new_security_event', {
      id: eventId,
      tenant_id,
      agent_id,
      camera_id,
      event_type: primaryDetection.type,
      confidence: primaryDetection.confidence,
      label: primaryDetection.label,
      decision,
      alarm_triggered: shouldTriggerAlarm,
      alarm_id: alarmId,
      snapshot_url,
      created_at: now
    });

    return {
      decision,
      alarm_triggered: shouldTriggerAlarm,
      actions: actionsToExecute,
      event_id: eventId,
      alarm_id: alarmId
    };
  }
}

export const ruleEngineService = new RuleEngineService();
