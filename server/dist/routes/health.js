"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../db"));
const env_1 = require("../utils/env");
const logger_1 = require("../utils/logger");
const router = express_1.default.Router();
async function dbPing() {
    try {
        await db_1.default.query('SELECT 1');
        return true;
    }
    catch {
        return false;
    }
}
router.get(['/health', '/healthz'], async (_req, res) => {
    const ok = await dbPing();
    if (ok) {
        res.status(200).json({ status: 'ok' });
    }
    else {
        res.status(503).json({ status: 'db_unreachable' });
    }
});
router.get('/api/health', async (req, res) => {
    try {
        const healthStatus = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version || '1.0.0',
            environment: env_1.env.nodeEnv,
            uptime: process.uptime(),
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100,
                rss: Math.round(process.memoryUsage().rss / 1024 / 1024 * 100) / 100
            }
        };
        res.status(200).json(healthStatus);
    }
    catch (error) {
        (0, logger_1.logError)('Health check failed', error);
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: 'Health check failed'
        });
    }
});
router.get('/ready', async (req, res) => {
    const checks = {
        environment: false,
        database: false,
        memory: false
    };
    const startTime = Date.now();
    try {
        const envCheck = env_1.env.isReady();
        checks.environment = envCheck.ready;
        try {
            const client = await db_1.default.connect();
            await client.query('SELECT 1');
            client.release();
            checks.database = true;
        }
        catch (dbError) {
            (0, logger_1.logError)('Database readiness check failed', dbError);
            checks.database = false;
        }
        const memUsage = process.memoryUsage();
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
        const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
        const memoryUsagePercent = (heapUsedMB / heapTotalMB) * 100;
        checks.memory = memoryUsagePercent < 90;
        const isReady = Object.values(checks).every(check => check === true);
        const duration = Date.now() - startTime;
        const response = {
            status: isReady ? 'ready' : 'not ready',
            timestamp: new Date().toISOString(),
            checks,
            responseTime: `${duration}ms`,
            details: {
                environment: checks.environment ? 'OK' : 'Environment variables not properly loaded',
                database: checks.database ? 'Connected' : 'Connection failed',
                memory: checks.memory ? `${Math.round(memoryUsagePercent)}% used` : `${Math.round(memoryUsagePercent)}% used (too high)`
            }
        };
        if (isReady) {
            (0, logger_1.logInfo)('Readiness check passed', { duration: `${duration}ms` });
            res.status(200).json(response);
        }
        else {
            (0, logger_1.logError)('Readiness check failed', undefined, { checks, duration: `${duration}ms` });
            res.status(503).json(response);
        }
    }
    catch (error) {
        (0, logger_1.logError)('Readiness check error', error);
        res.status(503).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: 'Readiness check encountered an error',
            checks,
            responseTime: `${Date.now() - startTime}ms`
        });
    }
});
router.get('/ping', (req, res) => {
    res.status(200).json({
        status: 'pong',
        timestamp: new Date().toISOString()
    });
});
router.get('/info', (req, res) => {
    try {
        const systemInfo = {
            application: 'Prime SMS API',
            version: process.env.npm_package_version || '1.0.0',
            environment: env_1.env.nodeEnv,
            node: {
                version: process.version,
                platform: process.platform,
                arch: process.arch
            },
            uptime: {
                process: process.uptime(),
                system: require('os').uptime()
            },
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
            timestamp: new Date().toISOString()
        };
        if (env_1.env.isDevelopment) {
            res.status(200).json(systemInfo);
        }
        else {
            res.status(200).json({
                application: systemInfo.application,
                version: systemInfo.version,
                environment: systemInfo.environment,
                timestamp: systemInfo.timestamp
            });
        }
    }
    catch (error) {
        (0, logger_1.logError)('System info endpoint error', error);
        res.status(500).json({
            error: 'Failed to retrieve system information',
            timestamp: new Date().toISOString()
        });
    }
});
router.post('/shutdown', (req, res) => {
    if (!env_1.env.isDevelopment) {
        res.status(403).json({
            error: 'Shutdown endpoint not available in production',
            timestamp: new Date().toISOString()
        });
        return;
    }
    (0, logger_1.logInfo)('Graceful shutdown requested via API');
    res.status(200).json({
        message: 'Shutting down gracefully...',
        timestamp: new Date().toISOString()
    });
    setTimeout(() => {
        process.exit(0);
    }, 1000);
});
exports.default = router;
