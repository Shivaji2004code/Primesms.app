"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.logCleanupService = exports.LogCleanupService = void 0;
const index_1 = require("../index");
const cron = __importStar(require("node-cron"));
class LogCleanupService {
    constructor() {
        this.cronJob = null;
    }
    static getInstance() {
        if (!LogCleanupService.instance) {
            LogCleanupService.instance = new LogCleanupService();
        }
        return LogCleanupService.instance;
    }
    async cleanupOldLogs() {
        const client = await index_1.pool.connect();
        try {
            const threshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
            const thresholdISO = threshold.toISOString();
            console.log(`🧹 Starting log cleanup for records older than: ${threshold.toISOString()}`);
            await client.query('BEGIN');
            const messageLogsResult = await client.query('DELETE FROM message_logs WHERE created_at < $1', [thresholdISO]);
            const campaignLogsResult = await client.query('DELETE FROM campaign_logs WHERE created_at < $1', [thresholdISO]);
            await client.query('COMMIT');
            const messageLogsDeleted = messageLogsResult.rowCount || 0;
            const campaignLogsDeleted = campaignLogsResult.rowCount || 0;
            console.log(`✅ Log cleanup completed successfully:`);
            console.log(`   - Message logs deleted: ${messageLogsDeleted}`);
            console.log(`   - Campaign logs deleted: ${campaignLogsDeleted}`);
            console.log(`   - Total logs deleted: ${messageLogsDeleted + campaignLogsDeleted}`);
            return { messageLogsDeleted, campaignLogsDeleted };
        }
        catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Error during log cleanup:', error);
            throw new Error(`Log cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        finally {
            client.release();
        }
    }
    startScheduledCleanup() {
        if (this.cronJob) {
            console.log('📅 Log cleanup cron job is already running');
            return;
        }
        this.cronJob = cron.schedule('0 2 * * *', async () => {
            try {
                console.log('🕐 Starting scheduled log cleanup...');
                await this.cleanupOldLogs();
            }
            catch (error) {
                console.error('❌ Scheduled log cleanup failed:', error);
            }
        }, {
            timezone: 'UTC'
        });
        console.log('📅 Log cleanup cron job started - runs daily at 2:00 AM UTC');
    }
    stopScheduledCleanup() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            console.log('🛑 Log cleanup cron job stopped');
        }
    }
    async getOldLogsStats() {
        const client = await index_1.pool.connect();
        try {
            const threshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
            const thresholdISO = threshold.toISOString();
            const messageLogsResult = await client.query('SELECT COUNT(*) as count FROM message_logs WHERE created_at < $1', [thresholdISO]);
            const campaignLogsResult = await client.query('SELECT COUNT(*) as count FROM campaign_logs WHERE created_at < $1', [thresholdISO]);
            return {
                messageLogsCount: parseInt(messageLogsResult.rows[0].count),
                campaignLogsCount: parseInt(campaignLogsResult.rows[0].count)
            };
        }
        finally {
            client.release();
        }
    }
}
exports.LogCleanupService = LogCleanupService;
exports.logCleanupService = LogCleanupService.getInstance();
//# sourceMappingURL=logCleanup.js.map