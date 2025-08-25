"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("./db"));
const router = (0, express_1.Router)();
const shallowHealth = (_req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'prime-sms',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid
    });
};
router.get('/health', shallowHealth);
router.get('/healthz', shallowHealth);
router.get('/api/health', shallowHealth);
router.get('/api/healthz', shallowHealth);
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
router.get('/api/health/db', async (_req, res) => {
    try {
        const start = Date.now();
        const result = await db_1.default.query('SELECT 1 as health_check, NOW() as db_time');
        const duration = Date.now() - start;
        return res.status(200).json({
            status: 'ok',
            service: 'prime-sms',
            db: {
                connected: true,
                result: result.rows[0],
                query_duration_ms: duration,
                pool_total: db_1.default.totalCount,
                pool_idle: db_1.default.idleCount,
                pool_waiting: db_1.default.waitingCount
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (err) {
        console.error('[HEALTH] DB check failed:', err);
        return res.status(503).json({
            status: 'fail',
            service: 'prime-sms',
            db: {
                connected: false,
                error: String(err?.message || err),
                pool_total: db_1.default.totalCount,
                pool_idle: db_1.default.idleCount,
                pool_waiting: db_1.default.waitingCount
            },
            timestamp: new Date().toISOString()
        });
    }
});
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
exports.default = router;
//# sourceMappingURL=health.js.map