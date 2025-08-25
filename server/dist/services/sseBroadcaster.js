"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sseHub = exports.SSEHub = void 0;
class SSEHub {
    constructor() {
        this.reports = new Map();
        this.templates = new Map();
        this.connectionCount = 0;
    }
    attachReports(req, res, userId) {
        console.log(`📡 [SSE] New reports connection for user ${userId}`);
        this.attach(this.reports, res, userId, 'reports');
    }
    attachTemplates(req, res, userId) {
        console.log(`📡 [SSE] New templates connection for user ${userId}`);
        this.attach(this.templates, res, userId, 'templates');
    }
    emitReport(userId, payload) {
        this.emit(this.reports, userId, payload, 'report');
    }
    emitTemplate(userId, payload) {
        this.emit(this.templates, userId, payload, 'template');
    }
    attach(bucket, res, userId, type) {
        this.connectionCount++;
        const connectionId = `${type}-${userId}-${this.connectionCount}`;
        res.status(200);
        res.set({
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control',
            'X-Accel-Buffering': 'no',
        });
        res.write(`data: ${JSON.stringify({
            type: 'connection',
            status: 'connected',
            userId,
            connectionType: type,
            at: new Date().toISOString()
        })}\n\n`);
        let connectionSet = bucket.get(userId);
        if (!connectionSet) {
            connectionSet = new Set();
            bucket.set(userId, connectionSet);
        }
        connectionSet.add(res);
        console.log(`✅ [SSE] Connected ${connectionId}, total connections: ${this.getTotalConnections()}`);
        const keepAlive = setInterval(() => {
            try {
                res.write(': ping\n\n');
            }
            catch (error) {
                console.log(`💔 [SSE] Keep-alive failed for ${connectionId}, cleaning up`);
                clearInterval(keepAlive);
                this.cleanup(bucket, userId, res);
            }
        }, 30000);
        const cleanup = () => {
            console.log(`🔌 [SSE] Disconnect ${connectionId}`);
            clearInterval(keepAlive);
            this.cleanup(bucket, userId, res);
        };
        res.on('close', cleanup);
        res.on('error', cleanup);
        if (res.req) {
            res.req.on('close', cleanup);
            res.req.on('aborted', cleanup);
        }
    }
    emit(bucket, userId, payload, eventType) {
        const connectionSet = bucket.get(userId);
        if (!connectionSet || connectionSet.size === 0) {
            console.log(`📡 [SSE] No ${eventType} connections for user ${userId}`);
            return;
        }
        const data = `data: ${JSON.stringify(payload)}\n\n`;
        let successCount = 0;
        let failureCount = 0;
        for (const res of connectionSet) {
            try {
                res.write(data);
                successCount++;
            }
            catch (error) {
                console.log(`❌ [SSE] Failed to send ${eventType} event to user ${userId}:`, error);
                failureCount++;
                connectionSet.delete(res);
                try {
                    res.end();
                }
                catch (endError) {
                }
            }
        }
        console.log(`📡 [SSE] Sent ${eventType} event to user ${userId}: ${successCount} success, ${failureCount} failed`);
    }
    cleanup(bucket, userId, res) {
        const connectionSet = bucket.get(userId);
        if (connectionSet) {
            connectionSet.delete(res);
            if (connectionSet.size === 0) {
                bucket.delete(userId);
            }
        }
        try {
            if (!res.destroyed && !res.headersSent) {
                res.end();
            }
        }
        catch (error) {
        }
        console.log(`🧹 [SSE] Cleaned up connection for user ${userId}, total connections: ${this.getTotalConnections()}`);
    }
    getTotalConnections() {
        let total = 0;
        for (const set of this.reports.values()) {
            total += set.size;
        }
        for (const set of this.templates.values()) {
            total += set.size;
        }
        return total;
    }
    getConnectionStats() {
        let reportsCount = 0;
        let templatesCount = 0;
        for (const set of this.reports.values()) {
            reportsCount += set.size;
        }
        for (const set of this.templates.values()) {
            templatesCount += set.size;
        }
        return {
            reports: reportsCount,
            templates: templatesCount,
            total: reportsCount + templatesCount
        };
    }
    hasConnectionsForUser(userId) {
        const reportsConnections = this.reports.get(userId)?.size || 0;
        const templatesConnections = this.templates.get(userId)?.size || 0;
        return reportsConnections > 0 || templatesConnections > 0;
    }
    sendTestEvent(userId, eventType) {
        const testPayload = {
            type: 'test',
            message: `Test ${eventType} event`,
            userId,
            at: new Date().toISOString()
        };
        if (eventType === 'reports') {
            this.emitReport(userId, testPayload);
        }
        else {
            this.emitTemplate(userId, testPayload);
        }
        return this.hasConnectionsForUser(userId);
    }
    broadcastToAll(payload, eventType = 'reports') {
        const bucket = eventType === 'reports' ? this.reports : this.templates;
        let userCount = 0;
        for (const userId of bucket.keys()) {
            this.emit(bucket, userId, payload, eventType);
            userCount++;
        }
        console.log(`📢 [SSE] Broadcasted ${eventType} event to ${userCount} users`);
    }
}
exports.SSEHub = SSEHub;
exports.sseHub = new SSEHub();
setInterval(() => {
    const stats = exports.sseHub.getConnectionStats();
    if (stats.total > 0) {
        console.log(`📊 [SSE] Connection stats: ${stats.reports} reports, ${stats.templates} templates (${stats.total} total)`);
    }
}, 60000);
//# sourceMappingURL=sseBroadcaster.js.map