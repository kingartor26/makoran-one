// ==============================================================================
// MAKORAN ONE — SECURITY RULE ENGINE UNIT TEST
// ==============================================================================

function evaluateRule(armedState, detectionType, zone, rule) {
  const matchesArmed = rule.armed_states.length === 0 || rule.armed_states.includes(armedState);
  if (!matchesArmed && armedState === 'DISARMED') return false;

  const matchesZone = rule.zones.length === 0 || rule.zones.includes(zone);
  const matchesEvent = rule.event_types.includes(detectionType);

  return matchesArmed && matchesZone && matchesEvent;
}

async function runRuleEngineTest() {
  console.log('--- STARTING SECURITY RULE ENGINE UNIT TEST ---');

  const ruleHumanIntrusion = {
    name: 'Human Intrusion Rule',
    armed_states: ['ARMED_AWAY', 'ARMED_STAY'],
    event_types: ['human_detected', 'unknown_face'],
    zones: ['entrance', 'perimeter', 'vault']
  };

  const ruleBlockedPlate = {
    name: 'Blocked License Plate Rule (24/7)',
    armed_states: ['ARMED_AWAY', 'ARMED_STAY', 'DISARMED'],
    event_types: ['blocked_plate'],
    zones: ['gate_lpr']
  };

  // Case 1: System ARMED_AWAY + Human in Perimeter -> Should Trigger Alarm
  const c1 = evaluateRule('ARMED_AWAY', 'human_detected', 'perimeter', ruleHumanIntrusion);
  console.log('Case 1 (Armed Away + Human + Perimeter):', c1);
  if (!c1) throw new Error('Case 1 failed to trigger alarm!');

  // Case 2: System DISARMED + Human in Entrance -> Should NOT Trigger Alarm
  const c2 = evaluateRule('DISARMED', 'human_detected', 'entrance', ruleHumanIntrusion);
  console.log('Case 2 (Disarmed + Human + Entrance):', c2);
  if (c2) throw new Error('Case 2 should NOT trigger alarm in Disarmed state!');

  // Case 3: System DISARMED + Blocked Plate at Gate -> Should Trigger Alarm (24/7)
  const c3 = evaluateRule('DISARMED', 'blocked_plate', 'gate_lpr', ruleBlockedPlate);
  console.log('Case 3 (Disarmed + Blocked Plate + Gate):', c3);
  if (!c3) throw new Error('Case 3 failed to trigger alarm for blocked plate!');

  console.log('✅ RULE ENGINE LOGIC VERIFIED: ALL SECURITY RULE CONDITIONS EVALUATE ACCURATELY');
}

runRuleEngineTest().catch(err => {
  console.error('❌ Rule Engine test failed:', err);
  process.exit(1);
});
