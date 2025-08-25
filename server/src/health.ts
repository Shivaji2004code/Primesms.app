// server/src/health.ts
import { Router } from 'express';
import pool from './db';

const router = Router();

// Shallow health (for container orchestrators & Coolify)
// NEVER touches DB, sessions, or any external dependencies
// Always returns 200 for container health checks
const shallowHealth = (_req: any, res: any) => {
  res.status(200).json({ 
    status: 'ok', 
    service: 'prime-sms',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    pid: process.pid
  });
};

// Mount shallow health at ALL the standard paths
// This ensures Coolify, Docker, Kubernetes, etc. can all find it
router.get('/health', shallowHealth);
router.get('/healthz', shallowHealth);
router.get('/api/health', shallowHealth);
router.get('/api/healthz', shallowHealth);

// Version endpoint for deployment tracking
router.get('/version', (_req, res) => {
  const packageInfo = require('../package.json');
  res.json({
    name: packageInfo.name || 'prime-sms-server',
    version: process.env.APP_VERSION || packageInfo.version || '1.2.0',
    build: process.env.BUILD_ID || 'local',
    environment: process.env.NODE_ENV || 'development',
    features: [
      'whatsapp-business-api',
      'bulk-messaging',
      'template-management',
      'admin-dashboard',
      'pricing-system',
      '360dialog-integration'
    ],
    timestamp: new Date().toISOString()
  });
});

// Metrics endpoint for monitoring
router.get('/api/metrics', (_req, res) => {
  const os = require('os');
  res.json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    load: os.loadavg(),
    platform: process.platform,
    arch: process.arch,
    node_version: process.version,
    pid: process.pid,
    timestamp: new Date().toISOString()
  });
});

// Deep DB health (optional; for debugging, not used by Coolify healthcheck)
// Only use this for manual debugging - never for container health
router.get('/api/health/db', async (_req, res) => {
  try {
    const start = Date.now();
    const result = await pool.query('SELECT 1 as health_check, NOW() as db_time');
    const duration = Date.now() - start;
    
    return res.status(200).json({ 
      status: 'ok', 
      service: 'prime-sms',
      db: {
        connected: true,
        result: result.rows[0],
        query_duration_ms: duration,
        pool_total: pool.totalCount,
        pool_idle: pool.idleCount,
        pool_waiting: pool.waitingCount
      },
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('[HEALTH] DB check failed:', err);
    return res.status(503).json({ 
      status: 'fail', 
      service: 'prime-sms',
      db: {
        connected: false,
        error: String(err?.message || err),
        pool_total: pool.totalCount,
        pool_idle: pool.idleCount,
        pool_waiting: pool.waitingCount
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Version info endpoint (useful for deployments)
router.get('/api/health/version', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'prime-sms',
    version: '1.0.0',
    node_version: process.version,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

console.log('[HEALTH] Health endpoints initialized:');
console.log('  - GET /health (shallow)');
console.log('  - GET /healthz (shallow)');
console.log('  - GET /api/health (shallow)');
console.log('  - GET /api/healthz (shallow)');
console.log('  - GET /api/health/db (deep DB check)');
console.log('  - GET /api/health/version (version info)');

export default router;