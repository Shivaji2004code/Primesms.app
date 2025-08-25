"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../db"));
const auth_1 = require("../middleware/auth");
const logCleanup_1 = require("../services/logCleanup");
const router = express_1.default.Router();
router.get('/', auth_1.requireAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const countResult = await db_1.default.query('SELECT COUNT(*) as total FROM campaign_logs');
        const total = parseInt(countResult.rows[0].total);
        const logsResult = await db_1.default.query(`SELECT 
        id,
        recipient_number,
        status,
        message_id,
        created_at
      FROM campaign_logs 
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2`, [limit, offset]);
        const logs = logsResult.rows.map(row => ({
            id: row.id,
            recipientNumber: row.recipient_number,
            status: row.status,
            messageId: row.message_id,
            createdAt: row.created_at
        }));
        res.json({
            logs,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        });
    }
    catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/cleanup/stats', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const stats = await logCleanup_1.logCleanupService.getOldLogsStats();
        res.json({
            success: true,
            stats: {
                campaignLogsCount: stats.campaignLogsCount,
                totalCount: stats.campaignLogsCount,
                thresholdDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
            }
        });
    }
    catch (error) {
        console.error('Error getting log cleanup stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get log cleanup statistics'
        });
    }
});
router.post('/cleanup', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const result = await logCleanup_1.logCleanupService.cleanupOldLogs();
        res.json({
            success: true,
            message: 'Log cleanup completed successfully',
            deleted: {
                campaignLogsDeleted: result.campaignLogsDeleted,
                totalDeleted: result.campaignLogsDeleted
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Error during manual log cleanup:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to cleanup logs'
        });
    }
});
router.get('/cleanup/status', auth_1.requireAuth, auth_1.requireAdmin, (req, res) => {
    res.json({
        success: true,
        status: {
            cronJobActive: true,
            cleanupThreshold: '90 days',
            scheduleTime: '02:00 UTC daily',
            timezone: 'UTC'
        }
    });
});
exports.default = router;
//# sourceMappingURL=logs.js.map