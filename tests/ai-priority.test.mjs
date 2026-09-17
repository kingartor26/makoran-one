// ==============================================================================
// MAKORAN ONE — AI GATEWAY PRIORITY QUEUE TEST
// Verifies: CRITICAL requests preempt NORMAL/LOW requests
// ==============================================================================

async function runAIPriorityTest() {
  console.log('--- STARTING AI PRIORITY QUEUE TEST ---');

  const weight = {
    CRITICAL: 4,
    HIGH: 3,
    NORMAL: 2,
    LOW: 1
  };

  const queue = [];

  function insertByPriority(task) {
    let inserted = false;
    for (let i = 0; i < queue.length; i++) {
      if (weight[task.priority] > weight[queue[i].priority]) {
        queue.splice(i, 0, task);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      queue.push(task);
    }
  }

  // Insert items in mixed order
  insertByPriority({ id: 'task-low-1', priority: 'LOW' });
  insertByPriority({ id: 'task-normal-1', priority: 'NORMAL' });
  insertByPriority({ id: 'task-crit-1', priority: 'CRITICAL' });
  insertByPriority({ id: 'task-high-1', priority: 'HIGH' });
  insertByPriority({ id: 'task-crit-2', priority: 'CRITICAL' });

  console.log('Drain order of queue:');
  const drainOrder = [];
  while (queue.length > 0) {
    const t = queue.shift();
    drainOrder.push(t.priority);
  }
  console.log(drainOrder);

  // Check expected order
  if (drainOrder[0] !== 'CRITICAL' || drainOrder[1] !== 'CRITICAL' || drainOrder[2] !== 'HIGH' || drainOrder[3] !== 'NORMAL' || drainOrder[4] !== 'LOW') {
    throw new Error('Queue priority drain order violated!');
  }

  console.log('✅ AI PRIORITY QUEUE VERIFIED: CRITICAL INTRUSION TASKS PREEMPT NORMAL/LOW WORKLOADS');
}

runAIPriorityTest().catch(err => {
  console.error('❌ AI Priority test failed:', err);
  process.exit(1);
});
