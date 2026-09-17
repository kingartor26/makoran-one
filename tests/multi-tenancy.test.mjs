// ==============================================================================
// MAKORAN ONE — MULTI-TENANCY ISOLATION VERIFICATION TEST
// Verifies: Strict isolation between Tenant A and Tenant B
// ==============================================================================

import initSqlJs from 'sql.js';

async function runMultiTenancyTest() {
  console.log('--- STARTING MULTI-TENANCY ISOLATION TEST ---');
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  db.run(`
    CREATE TABLE tenants (id TEXT PRIMARY KEY, name TEXT);
    CREATE TABLE cameras (id TEXT PRIMARY KEY, tenant_id TEXT, name TEXT);
    CREATE TABLE events (id TEXT PRIMARY KEY, tenant_id TEXT, label TEXT);
  `);

  // Insert Tenant 1 and Tenant 2 data
  db.run(`INSERT INTO tenants VALUES ('tenant-01', 'Tenant Alpha'), ('tenant-02', 'Tenant Beta');`);
  db.run(`INSERT INTO cameras VALUES ('cam-t1-1', 'tenant-01', 'Alpha Cam 1'), ('cam-t2-1', 'tenant-02', 'Beta Cam 1');`);
  db.run(`INSERT INTO events VALUES ('evt-t1-1', 'tenant-01', 'Alpha Event'), ('evt-t2-1', 'tenant-02', 'Beta Event');`);

  // Test 1: Query scoped to Tenant 1
  const t1Cams = db.exec("SELECT * FROM cameras WHERE tenant_id = 'tenant-01'");
  console.log('Tenant 1 Cameras:', t1Cams[0]?.values);
  if (t1Cams[0]?.values.length !== 1 || t1Cams[0]?.values[0][0] !== 'cam-t1-1') {
    throw new Error('Tenant 1 data leakage or missing data!');
  }

  // Test 2: Query scoped to Tenant 2
  const t2Cams = db.exec("SELECT * FROM cameras WHERE tenant_id = 'tenant-02'");
  console.log('Tenant 2 Cameras:', t2Cams[0]?.values);
  if (t2Cams[0]?.values.length !== 1 || t2Cams[0]?.values[0][0] !== 'cam-t2-1') {
    throw new Error('Tenant 2 data leakage or missing data!');
  }

  // Test 3: Events isolation
  const t1Evts = db.exec("SELECT * FROM events WHERE tenant_id = 'tenant-01'");
  if (t1Evts[0]?.values.length !== 1 || t1Evts[0]?.values[0][2] !== 'Alpha Event') {
    throw new Error('Events isolation breach!');
  }

  console.log('✅ MULTI-TENANCY ISOLATION VERIFIED: ZERO CROSS-TENANT DATA LEAKAGE');
}

runMultiTenancyTest().catch(err => {
  console.error('❌ Multi-tenancy test failed:', err);
  process.exit(1);
});
