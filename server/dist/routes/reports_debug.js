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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../db"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.get('/reports', auth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        console.log(`🔍 [REPORTS DEBUG] User ID: ${userId}`);
        const { page = 1, limit = 50, dateFrom = '', dateTo = '', recipientNumber = '', template = '', status = 'all', export: exportFormat = 'false' } = req.query;
        console.log(`🔍 [REPORTS DEBUG] Query params:`, { page, limit, dateFrom, dateTo, recipientNumber, template, status });
        const offset = (Number(page) - 1) * Number(limit);
        const campaignCheck = await db_1.default.query('SELECT COUNT(*) as count FROM campaign_logs WHERE user_id = $1', [userId]);
        console.log(`🔍 [REPORTS DEBUG] User has ${campaignCheck.rows[0].count} campaigns`);
        const messageCheck = await db_1.default.query(`SELECT COUNT(*) as count 
       FROM campaign_logs cl 
       JOIN campaign_logs ml ON cl.id = ml.campaign_id 
       WHERE cl.user_id = $1`, [userId]);
        console.log(`🔍 [REPORTS DEBUG] User has ${messageCheck.rows[0].count} messages`);
        let whereConditions = 'WHERE cl.user_id = $1';
        const params = [userId];
        let paramCount = 1;
        if (dateFrom && dateFrom.toString().trim()) {
            paramCount++;
            whereConditions += ` AND ml.created_at >= $${paramCount}`;
            params.push(dateFrom.toString());
            console.log(`🔍 [REPORTS DEBUG] Added dateFrom filter: ${dateFrom}`);
        }
        if (dateTo && dateTo.toString().trim()) {
            paramCount++;
            whereConditions += ` AND ml.created_at <= $${paramCount}::date + interval '1 day'`;
            params.push(dateTo.toString());
            console.log(`🔍 [REPORTS DEBUG] Added dateTo filter: ${dateTo}`);
        }
        if (recipientNumber && recipientNumber.toString().trim()) {
            paramCount++;
            whereConditions += ` AND ml.recipient_number ILIKE $${paramCount}`;
            params.push(`%${recipientNumber.toString().trim()}%`);
            console.log(`🔍 [REPORTS DEBUG] Added recipient filter: ${recipientNumber}`);
        }
        if (template && template.toString().trim()) {
            paramCount++;
            whereConditions += ` AND cl.template_used = $${paramCount}`;
            params.push(template.toString());
            console.log(`🔍 [REPORTS DEBUG] Added template filter: ${template}`);
        }
        if (status && status !== 'all') {
            paramCount++;
            whereConditions += ` AND ml.status = $${paramCount}`;
            params.push(status.toString());
            console.log(`🔍 [REPORTS DEBUG] Added status filter: ${status}`);
        }
        const reportsQuery = `
      SELECT 
        ml.id,
        cl.campaign_name,
        cl.template_used,
        cl.phone_number_id as from_number,
        ml.recipient_number,
        ml.status,
        ml.error_message,
        ml.sent_at,
        ml.delivered_at,
        ml.read_at,
        ml.created_at
      FROM campaign_logs cl
      JOIN campaign_logs ml ON cl.id = ml.campaign_id
      ${whereConditions}
      ORDER BY ml.created_at DESC
      ${exportFormat && exportFormat !== 'false' ? '' : `LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`}
    `;
        if (!exportFormat || exportFormat === 'false') {
            params.push(Number(limit), offset);
        }
        console.log(`🔍 [REPORTS DEBUG] Query:`, reportsQuery);
        console.log(`🔍 [REPORTS DEBUG] Params:`, params);
        const reportsResult = await db_1.default.query(reportsQuery, params);
        console.log(`🔍 [REPORTS DEBUG] Query returned ${reportsResult.rows.length} rows`);
        const countQuery = `
      SELECT COUNT(*) as total
      FROM campaign_logs cl
      JOIN campaign_logs ml ON cl.id = ml.campaign_id
      ${whereConditions}
    `;
        const countResult = await db_1.default.query(countQuery, params.slice(0, paramCount));
        const totalReports = parseInt(countResult.rows[0].total);
        console.log(`🔍 [REPORTS DEBUG] Total count: ${totalReports}`);
        const reports = reportsResult.rows.map(row => ({
            id: row.id,
            campaign: row.campaign_name,
            template: row.template_used,
            from: row.from_number || 'Unknown',
            recipient: row.recipient_number,
            status: row.status,
            sentAt: row.sent_at,
            deliveredAt: row.delivered_at,
            readAt: row.read_at,
            error: row.error_message,
            createdAt: row.created_at
        }));
        console.log(`🔍 [REPORTS DEBUG] Transformed ${reports.length} reports`);
        if (exportFormat && exportFormat !== 'false') {
            if (exportFormat === 'csv') {
                const csv = await Promise.resolve().then(() => __importStar(require('csv-stringify')));
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename="reports.csv"');
                const csvString = await csv.stringify(reports, {
                    header: true,
                    columns: {
                        campaign: 'Campaign',
                        template: 'Template',
                        from: 'From',
                        recipient: 'Recipient',
                        status: 'Status',
                        sentAt: 'Sent At',
                        error: 'Error'
                    }
                });
                return res.send(csvString);
            }
        }
        res.json({
            success: true,
            data: reports,
            pagination: {
                currentPage: Number(page),
                totalPages: Math.ceil(totalReports / Number(limit)),
                totalReports,
                limit: Number(limit)
            }
        });
    }
    catch (error) {
        console.error('🔍 [REPORTS DEBUG] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch reports',
            debug: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
