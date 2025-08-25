"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sseHub = void 0;
const express_1 = require("express");
const sseBroadcaster_1 = require("../services/sseBroadcaster");
Object.defineProperty(exports, "sseHub", { enumerable: true, get: function () { return sseBroadcaster_1.sseHub; } });
const db_1 = __importDefault(require("../db"));
const sseRouter = (0, express_1.Router)();
const requireAuthForSSE = async (req, res, next) => {
    const session = req.session;
    console.log('🔐 [SSE] Auth check:', {
        path: req.path,
        hasSession: Boolean(req.session),
        sessionId: req.sessionID?.substring(0, 8),
        userId: session?.userId,
        userAgent: req.get('User-Agent')?.substring(0, 30)
    });
    if (!session?.userId) {
        console.log('❌ [SSE] Auth failed: No session or userId');
        res.status(401).json({
            error: 'Authentication required for SSE connection',
            message: 'Please log in to receive real-time updates'
        });
        return;
    }
    try {
        const result = await db_1.default.query('SELECT id, name, username, role FROM users WHERE id = $1 LIMIT 1', [session.userId]);
        if (result.rows.length === 0) {
            console.log('❌ [SSE] Auth failed: User not found for userId:', session.userId);
            res.status(401).json({
                error: 'User not found',
                message: 'Your session is invalid. Please log in again.'
            });
            return;
        }
        const user = result.rows[0];
        req.user = user;
        console.log(`✅ [SSE] Auth success: ${user.username} (${user.id})`);
        next();
    }
    catch (error) {
        console.error('❌ [SSE] Database error during auth:', error);
        res.status(500).json({
            error: 'Authentication error',
            message: 'Please try again later'
        });
    }
};
const validateUserAccess = (req, res, next) => {
    const requestedUserId = req.params.userId;
    const authenticatedUserId = req.user?.id;
    if (authenticatedUserId !== requestedUserId && req.user?.role !== 'admin') {
        console.log(`❌ [SSE] Access denied: User ${authenticatedUserId} tried to access ${requestedUserId}`);
        res.status(403).json({
            error: 'Access denied',
            message: 'You can only access your own real-time updates'
        });
        return;
    }
    console.log(`✅ [SSE] Access granted: User ${authenticatedUserId} accessing ${requestedUserId}`);
    next();
};
sseRouter.get('/realtime/reports/:userId', requireAuthForSSE, validateUserAccess, (req, res) => {
    const userId = req.params.userId;
    try {
        console.log(`📡 [SSE] Starting reports stream for user ${userId}`);
        sseBroadcaster_1.sseHub.attachReports(req, res, userId);
    }
    catch (error) {
        console.error(`❌ [SSE] Error starting reports stream for ${userId}:`, error);
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Failed to start real-time updates',
                message: 'Please try refreshing the page'
            });
        }
    }
});
sseRouter.get('/realtime/templates/:userId', requireAuthForSSE, validateUserAccess, (req, res) => {
    const userId = req.params.userId;
    try {
        console.log(`📡 [SSE] Starting templates stream for user ${userId}`);
        sseBroadcaster_1.sseHub.attachTemplates(req, res, userId);
    }
    catch (error) {
        console.error(`❌ [SSE] Error starting templates stream for ${userId}:`, error);
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Failed to start real-time updates',
                message: 'Please try refreshing the page'
            });
        }
    }
});
sseRouter.get('/realtime/stats', (req, res) => {
    const session = req.session;
    const debugToken = req.header('authorization')?.replace('Bearer ', '');
    const isAdmin = session?.userId && req.user?.role === 'admin';
    const validDebugToken = debugToken === process.env.WEBHOOK_DEBUG_TOKEN;
    if (!isAdmin && !validDebugToken) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    const stats = sseBroadcaster_1.sseHub.getConnectionStats();
    res.json({
        connections: stats,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
sseRouter.post('/realtime/test/:userId', requireAuthForSSE, validateUserAccess, (req, res) => {
    const userId = req.params.userId;
    const { eventType } = req.body || {};
    if (!['reports', 'templates'].includes(eventType)) {
        return res.status(400).json({
            error: 'Invalid event type',
            message: 'eventType must be "reports" or "templates"'
        });
    }
    const success = sseBroadcaster_1.sseHub.sendTestEvent(userId, eventType);
    res.json({
        success,
        message: success
            ? `Test ${eventType} event sent to user ${userId}`
            : `No active ${eventType} connections for user ${userId}`,
        hasConnections: sseBroadcaster_1.sseHub.hasConnectionsForUser(userId),
        userId,
        eventType
    });
});
sseRouter.get('/realtime/health', (req, res) => {
    const stats = sseBroadcaster_1.sseHub.getConnectionStats();
    res.json({
        status: 'healthy',
        service: 'SSE Real-time Updates',
        connections: stats,
        timestamp: new Date().toISOString()
    });
});
exports.default = sseRouter;
