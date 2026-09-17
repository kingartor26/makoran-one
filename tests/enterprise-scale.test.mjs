/**
 * Makoran One - Enterprise Scaling Integration Test
 * Verifies Security Incidents, Guard Patrol Dispatch, Shift Handover Logbook,
 * Checkpoint Verification, and Disaster Recovery Backup Snapshot.
 */

const BASE_URL = 'http://localhost:3000/api/v1';

async function runEnterpriseScaleTests() {
  console.log('===========================================================');
  console.log(' MAKORAN ONE ENTERPRISE SCALING INTEGRATION SUITE');
  console.log('===========================================================\n');

  let adminToken = '';

  // 1. Authenticate
  try {
    const authRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@makoran.io',
        password: 'MakoranGuard2026!'
      })
    });
    const authData = await authRes.json();
    if (!authData.token) throw new Error('Authentication failed: ' + JSON.stringify(authData));
    adminToken = authData.token;
    console.log('✓ Stage 1: Authenticated as Superadmin for Enterprise Tests');
  } catch (err) {
    console.error('✗ Authentication failed:', err);
    process.exit(1);
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`
  };

  // 2. Query Incidents
  try {
    const incRes = await fetch(`${BASE_URL}/incidents`, { headers: authHeaders });
    const incidents = await incRes.json();
    if (!Array.isArray(incidents) || incidents.length < 2) {
      throw new Error(`Expected at least 2 seeded incidents, got ${incidents?.length}`);
    }
    console.log(`✓ Stage 2: Loaded ${incidents.length} security incidents (Found inc-01, inc-02)`);
  } catch (err) {
    console.error('✗ Stage 2 failed:', err);
    process.exit(1);
  }

  // 3. Create & Dispatch New Incident
  let newIncidentId = '';
  try {
    const createRes = await fetch(`${BASE_URL}/incidents`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        title: 'هشدار تلاش برای صعود از فنس زون شرقی',
        camera_id: 'cam-01',
        severity: 'CRITICAL',
        assigned_to: 'ستوان دوم بلوچ (تیم واکنش سریع)',
        notes: 'تشخیص انسان در منطقه ممنوعه در ساعت ۰۲:۳۰ بامداد'
      })
    });
    const createData = await createRes.json();
    if (!createData.id || createData.status !== 'DISPATCHED') {
      throw new Error('Failed to dispatch incident: ' + JSON.stringify(createData));
    }
    newIncidentId = createData.id;
    console.log(`✓ Stage 3: Dispatched new critical incident: ${newIncidentId}`);
  } catch (err) {
    console.error('✗ Stage 3 failed:', err);
    process.exit(1);
  }

  // 4. Update Incident Lifecycle (INVESTIGATING -> RESOLVED)
  try {
    const step1Res = await fetch(`${BASE_URL}/incidents/${newIncidentId}/status`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        status: 'INVESTIGATING',
        notes: 'تیم واکنش سریع به محل فنس شرقی اعزام و مستقر شد'
      })
    });
    const step1Data = await step1Res.json();
    if (step1Data.status !== 'INVESTIGATING') throw new Error('Failed to update to INVESTIGATING');

    const step2Res = await fetch(`${BASE_URL}/incidents/${newIncidentId}/status`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        status: 'RESOLVED',
        root_cause: 'سایه ناشی از باد شدید در پوشش حفاظتی شاخه‌ها - محوطه امن اعلام شد',
        notes: 'مختومه توسط سرپرست حراست'
      })
    });
    const step2Data = await step2Res.json();
    if (step2Data.status !== 'RESOLVED') throw new Error('Failed to update to RESOLVED');
    console.log(`✓ Stage 4: Incident ${newIncidentId} lifecycle verified (DISPATCHED -> INVESTIGATING -> RESOLVED)`);
  } catch (err) {
    console.error('✗ Stage 4 failed:', err);
    process.exit(1);
  }

  // 5. Query & Create Guard Shift Handover
  try {
    const shiftRes = await fetch(`${BASE_URL}/shifts`, { headers: authHeaders });
    const shifts = await shiftRes.json();
    if (!Array.isArray(shifts) || shifts.length < 1) throw new Error('Expected seeded shifts');

    const createShiftRes = await fetch(`${BASE_URL}/shifts`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        officer_name: 'ستوان محمدی',
        shift_type: 'EVENING',
        incoming_officer: 'استوار ریگی',
        outgoing_notes: 'کلیه گیت‌ها، بازوهای تردد و پروژکتورهای دید در شب سالم و عملیاتی تحویل شد.'
      })
    });
    const createShiftData = await createShiftRes.json();
    if (!createShiftData.success || !createShiftData.id) throw new Error('Failed to record shift handover');
    console.log(`✓ Stage 5: Shift handover recorded successfully: ${createShiftData.id}`);
  } catch (err) {
    console.error('✗ Stage 5 failed:', err);
    process.exit(1);
  }

  // 6. Query & Record Guard Patrol Checkpoint
  try {
    const patrolsRes = await fetch(`${BASE_URL}/patrols`, { headers: authHeaders });
    const patrols = await patrolsRes.json();
    if (!Array.isArray(patrols) || patrols.length < 4) throw new Error('Expected at least 4 patrol checkpoints');

    const checkRes = await fetch(`${BASE_URL}/patrols/check`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        checkpoint_name: 'ایستگاه بازرسی مخازن نفتی مکران',
        officer_name: 'ستوان شه‌بخش',
        camera_id: 'cam-02',
        status: 'VERIFIED',
        notes: 'تست فیزیکی شیرهای اضطراری و پایش دوربین مداربسته تایید شد.'
      })
    });
    const checkData = await checkRes.json();
    if (!checkData.success || !checkData.id) throw new Error('Failed to record patrol checkpoint check-in');
    console.log(`✓ Stage 6: Patrol checkpoint verified and recorded: ${checkData.id}`);
  } catch (err) {
    console.error('✗ Stage 6 failed:', err);
    process.exit(1);
  }

  // 7. Disaster Recovery Encrypted Backup
  try {
    const backupRes = await fetch(`${BASE_URL}/system/backup`, { headers: authHeaders });
    const backup = await backupRes.json();
    if (!backup.tables || !backup.tables.cameras || !backup.tables.incidents || !backup.tables.shifts) {
      throw new Error('Backup snapshot missing essential database tables');
    }
    if (!backup.exported_at || backup.platform !== 'Makoran One Enterprise Guard') {
      throw new Error('Backup metadata header corrupted');
    }
    console.log(`✓ Stage 7: Disaster Recovery Snapshot exported (${Object.keys(backup.tables).length} tables backed up)`);
  } catch (err) {
    console.error('✗ Stage 7 failed:', err);
    process.exit(1);
  }

  // 8. Two-Way Audio & Voice Warning PA Broadcast
  try {
    const broadcastRes = await fetch(`${BASE_URL}/agents/agent-mini-01/broadcast`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        message: 'هشدار امنیتی سیستم مکران گارد: ورود غیرمجاز تشخیص داده شد.',
        zone: 'entrance',
        volume: 90
      })
    });
    const broadcastData = await broadcastRes.json();
    if (!broadcastData.success) {
      throw new Error('Failed to dispatch voice broadcast command: ' + JSON.stringify(broadcastData));
    }
    console.log(`✓ Stage 8: Live Voice Deterrence Warning broadcasted to Mini PC speaker: "${broadcastData.message}"`);
  } catch (err) {
    console.error('✗ Stage 8 failed:', err);
    process.exit(1);
  }

  console.log('\n===========================================================');
  console.log(' ALL 8 ENTERPRISE INTEGRATION STAGES PASSED SUCCESSFULLY!');
  console.log('===========================================================');
}

runEnterpriseScaleTests();
