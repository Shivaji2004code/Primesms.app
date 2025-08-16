"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const bulkQueue_1 = require("../services/bulkQueue");
const bulkRepos_1 = require("../repos/bulkRepos");
const bulkSSE_1 = require("../services/bulkSSE");
const logger_1 = require("../utils/logger");
const db_1 = __importDefault(require("../db"));
const router = (0, express_1.Router)();
const bulkQueue = new bulkQueue_1.BulkQueue(bulkRepos_1.userBusinessRepo, bulkRepos_1.bulkCampaignLogsRepo, (jobId, payload) => bulkSSE_1.bulkSSE.emit(jobId, payload));
const bulkRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: {
        error: 'Too many bulk requests',
        message: 'Bulk operations are limited to 20 per hour. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
const requireAuth = async (req, res, next) => {
    const session = req.session;
    if (!session?.userId) {
        return res.status(401).json({
            error: 'Authentication required',
            message: 'Please log in to access bulk messaging'
        });
    }
    try {
        const result = await db_1.default.query('SELECT id, name, username, role FROM users WHERE id = $1 LIMIT 1', [session.userId]);
        if (result.rows.length === 0) {
            return res.status(401).json({
                error: 'User not found',
                message: 'Your session is invalid. Please log in again.'
            });
        }
        req.user = result.rows[0];
        next();
    }
    catch (error) {
        logger_1.logger.error('[BULK-INTEGRATION] Auth error', { error });
        res.status(500).json({
            error: 'Authentication error',
            message: 'Please try again later'
        });
    }
};
router.post('/bulk-quick-send', bulkRateLimit, requireAuth, async (req, res) => {
    try {
        const { phone_number_id, template_name, language = 'en_US', recipients_text, variables = {}, campaign_name } = req.body;
        const authenticatedUserId = req.user?.id;
        if (!phone_number_id || !template_name || !recipients_text) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'phone_number_id, template_name, and recipients_text are required'
            });
        }
        const recipients = recipients_text
            .split(/[,\n]/)
            .map((num) => num.trim())
            .filter((num) => num.length > 0);
        if (recipients.length === 0) {
            return res.status(400).json({
                error: 'No recipients provided',
                message: 'Please provide at least one valid phone number'
            });
        }
        if (recipients.length > 50) {
            let templateComponents = [];
            try {
                const templatesResult = await db_1.default.query('SELECT * FROM user_templates WHERE user_id = $1 AND name = $2 AND language = $3 LIMIT 1', [authenticatedUserId, template_name, language]);
                if (templatesResult.rows.length > 0) {
                    const template = templatesResult.rows[0];
                    const templateInfo = {
                        name: template.name,
                        category: template.category,
                        language: template.language,
                        status: template.status,
                        components: template.components || []
                    };
                    templateComponents = templateInfo.components;
                }
            }
            catch (error) {
                logger_1.logger.error('[BULK-INTEGRATION] Failed to fetch template details', { error, template_name, userId: authenticatedUserId });
            }
            const jobInput = {
                userId: authenticatedUserId,
                campaignId: campaign_name,
                recipients,
                message: {
                    kind: 'template',
                    template: {
                        name: template_name,
                        language_code: language,
                        components: templateComponents
                    }
                },
                variables
            };
            const job = bulkQueue.enqueue(jobInput);
            logger_1.logger.info('[BULK-INTEGRATION] Quick send bulk job created', {
                jobId: job.jobId,
                userId: authenticatedUserId,
                recipients: recipients.length,
                template: template_name
            });
            return res.status(201).json({
                success: true,
                bulk: true,
                jobId: job.jobId,
                totalRecipients: job.totalRecipients,
                batchSize: job.batchSize,
                totalBatches: job.totalBatches,
                message: `Bulk job created for ${recipients.length} recipients. Track progress at /realtime/bulk/${job.jobId}`
            });
        }
        return res.status(400).json({
            error: 'Use regular quick-send',
            message: 'For recipients less than 50, use the regular /api/whatsapp/quick-send endpoint'
        });
    }
    catch (error) {
        logger_1.logger.error('[BULK-INTEGRATION] Bulk quick send failed', { error, userId: req.user?.id });
        res.status(500).json({
            error: 'Bulk Quick Send Failed',
            message: error.message || 'An error occurred while processing your bulk quick send request'
        });
    }
});
router.post('/bulk-customize-send', bulkRateLimit, requireAuth, async (req, res) => {
    try {
        const { templateName, language = 'en_US', phoneNumberId, recipientColumn, variableMappings = {}, data = [] } = req.body;
        const authenticatedUserId = req.user?.id;
        if (!templateName || !phoneNumberId || !recipientColumn || !Array.isArray(data)) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'templateName, phoneNumberId, recipientColumn, and data array are required'
            });
        }
        if (data.length === 0) {
            return res.status(400).json({
                error: 'No data provided',
                message: 'Please provide data array with recipient information'
            });
        }
        const recipients = [];
        const recipientVariables = [];
        data.forEach((row) => {
            const recipient = row[recipientColumn];
            if (recipient) {
                recipients.push(recipient.toString());
                const variables = {};
                Object.keys(variableMappings).forEach(variableKey => {
                    const columnName = variableMappings[variableKey];
                    if (row[columnName] !== undefined) {
                        variables[variableKey] = row[columnName].toString();
                    }
                });
                recipientVariables.push({
                    recipient: recipient.toString(),
                    variables
                });
            }
        });
        if (recipients.length === 0) {
            return res.status(400).json({
                error: 'No valid recipients found',
                message: 'No valid phone numbers found in the specified recipient column'
            });
        }
        if (recipients.length > 50) {
            let templateComponents = [];
            try {
                const templatesResult = await db_1.default.query('SELECT * FROM user_templates WHERE user_id = $1 AND name = $2 AND language = $3 LIMIT 1', [authenticatedUserId, templateName, language]);
                if (templatesResult.rows.length > 0) {
                    const template = templatesResult.rows[0];
                    const templateInfo = {
                        name: template.name,
                        category: template.category,
                        language: template.language,
                        status: template.status,
                        components: template.components || []
                    };
                    templateComponents = templateInfo.components;
                }
            }
            catch (error) {
                logger_1.logger.error('[BULK-INTEGRATION] Failed to fetch template details', { error, templateName, userId: authenticatedUserId });
            }
            const jobInput = {
                userId: authenticatedUserId,
                campaignId: `Custom_${templateName}_${Date.now()}`,
                recipients,
                message: {
                    kind: 'template',
                    template: {
                        name: templateName,
                        language_code: language,
                        components: templateComponents
                    }
                },
                recipientVariables
            };
            const job = bulkQueue.enqueue(jobInput);
            logger_1.logger.info('[BULK-INTEGRATION] Customize bulk job created', {
                jobId: job.jobId,
                userId: authenticatedUserId,
                recipients: recipients.length,
                template: templateName,
                variablesCount: Object.keys(variableMappings).length
            });
            return res.status(201).json({
                success: true,
                bulk: true,
                jobId: job.jobId,
                totalRecipients: job.totalRecipients,
                batchSize: job.batchSize,
                totalBatches: job.totalBatches,
                message: `Bulk customize job created for ${recipients.length} recipients with personalized variables. Track progress at /realtime/bulk/${job.jobId}`
            });
        }
        return res.status(400).json({
            error: 'Use regular customize-send',
            message: 'For recipients less than 50, use the regular /api/whatsapp/send-custom-messages endpoint'
        });
    }
    catch (error) {
        logger_1.logger.error('[BULK-INTEGRATION] Bulk customize send failed', { error, userId: req.user?.id });
        res.status(500).json({
            error: 'Bulk Customize Send Failed',
            message: error.message || 'An error occurred while processing your bulk customize request'
        });
    }
});
exports.default = router;
//# sourceMappingURL=bulkIntegration.js.map