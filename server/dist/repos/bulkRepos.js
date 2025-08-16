"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkCampaignLogsRepo = exports.userBusinessRepo = exports.BulkCampaignLogsRepo = exports.UserBusinessRepo = void 0;
const db_1 = __importDefault(require("../db"));
const logger_1 = require("../utils/logger");
class UserBusinessRepo {
    async getCredsByUserId(userId) {
        try {
            const query = `
        SELECT 
          whatsapp_number_id,
          access_token
        FROM user_business_info 
        WHERE user_id = $1 AND is_active = true
        LIMIT 1
      `;
            const result = await db_1.default.query(query, [userId]);
            if (result.rows.length === 0) {
                throw new Error(`No active WhatsApp Business credentials found for user ${userId}`);
            }
            const row = result.rows[0];
            if (!row.whatsapp_number_id || !row.access_token) {
                throw new Error(`Incomplete WhatsApp Business credentials for user ${userId}`);
            }
            return {
                phoneNumberId: row.whatsapp_number_id,
                accessToken: row.access_token
            };
        }
        catch (error) {
            logger_1.logger.error('[BULK-REPO] Failed to get user credentials', { userId, error });
            throw error;
        }
    }
}
exports.UserBusinessRepo = UserBusinessRepo;
class BulkCampaignLogsRepo {
    async createCampaignLogEntry(userId, to, campaignId, templateName, phoneNumberId, language, variables, components) {
        try {
            const cleanRecipient = to?.toString().trim();
            if (!cleanRecipient) {
                throw new Error('Empty recipient provided');
            }
            const campaignData = {
                source: 'bulk',
                variables,
                template_components: components,
                timestamp: new Date().toISOString()
            };
            const insertQuery = `
        INSERT INTO campaign_logs (
          user_id, 
          campaign_name, 
          template_used,
          phone_number_id,
          recipient_number, 
          language_code,
          status, 
          campaign_data,
          created_at, 
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `;
            const result = await db_1.default.query(insertQuery, [
                userId,
                campaignId,
                templateName,
                phoneNumberId,
                cleanRecipient,
                language,
                campaignData
            ]);
            const logId = result.rows[0].id;
            logger_1.logger.debug('[BULK-REPO] Campaign log entry created', {
                userId,
                logId,
                recipient: cleanRecipient,
                campaignId,
                templateName
            });
            return logId.toString();
        }
        catch (error) {
            logger_1.logger.error('[BULK-REPO] Failed to create campaign log entry', {
                userId,
                to,
                campaignId,
                templateName,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    async updateCampaignLogStatus(logId, status, messageId, errorMessage) {
        try {
            const updateQuery = `
        UPDATE campaign_logs 
        SET 
          status = $1,
          message_id = $2,
          error_message = $3,
          sent_at = CASE WHEN $1 = 'sent' THEN CURRENT_TIMESTAMP ELSE sent_at END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `;
            await db_1.default.query(updateQuery, [
                status,
                messageId || null,
                errorMessage || null,
                logId
            ]);
            logger_1.logger.debug('[BULK-REPO] Campaign log status updated', {
                logId,
                status,
                messageId,
                hasError: !!errorMessage
            });
        }
        catch (error) {
            logger_1.logger.error('[BULK-REPO] Failed to update campaign log status', {
                logId,
                status,
                messageId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    async updateCampaignLogByMessageId(userId, messageId, status, timestamp, errorMessage) {
        try {
            let updateQuery = '';
            let params = [];
            if (status === 'sent') {
                updateQuery = `
          UPDATE campaign_logs 
          SET status = $1, sent_at = COALESCE(sent_at, $2), updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $3 AND message_id = $4`;
                params = [status, timestamp || new Date(), userId, messageId];
            }
            else if (status === 'delivered') {
                updateQuery = `
          UPDATE campaign_logs 
          SET status = $1, delivered_at = COALESCE(delivered_at, $2), updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $3 AND message_id = $4`;
                params = [status, timestamp || new Date(), userId, messageId];
            }
            else if (status === 'read') {
                updateQuery = `
          UPDATE campaign_logs 
          SET status = $1, read_at = COALESCE(read_at, $2), updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $3 AND message_id = $4`;
                params = [status, timestamp || new Date(), userId, messageId];
            }
            else if (status === 'failed') {
                updateQuery = `
          UPDATE campaign_logs 
          SET status = $1, error_message = $2, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $3 AND message_id = $4`;
                params = [status, errorMessage || 'Message failed', userId, messageId];
            }
            if (updateQuery) {
                const result = await db_1.default.query(updateQuery, params);
                if (result.rowCount && result.rowCount > 0) {
                    logger_1.logger.debug('[BULK-REPO] Campaign log updated by webhook', {
                        userId,
                        messageId,
                        status,
                        timestamp: timestamp?.toISOString()
                    });
                    return true;
                }
                else {
                    logger_1.logger.warn('[BULK-REPO] No campaign log found for webhook update', {
                        userId,
                        messageId,
                        status
                    });
                    return false;
                }
            }
            return false;
        }
        catch (error) {
            logger_1.logger.error('[BULK-REPO] Failed to update campaign log by messageId', {
                userId,
                messageId,
                status,
                error: error instanceof Error ? error.message : String(error)
            });
            return false;
        }
    }
    async upsertOnSendAck(userId, messageId, to, campaignId, meta) {
        try {
            const cleanRecipient = to?.toString().trim();
            if (!cleanRecipient) {
                logger_1.logger.warn('[BULK-REPO] Skipping log entry: empty recipient', { userId, messageId });
                return;
            }
            if (!messageId) {
                logger_1.logger.warn('[BULK-REPO] Skipping log entry: empty messageId', { userId, to: cleanRecipient });
                return;
            }
            const campaignName = campaignId || `BULK_${meta?.jobId || 'UNKNOWN'}_${Date.now()}`;
            const phoneNumberQuery = `
        SELECT whatsapp_number_id 
        FROM user_business_info 
        WHERE user_id = $1 AND is_active = true 
        LIMIT 1
      `;
            const phoneResult = await db_1.default.query(phoneNumberQuery, [userId]);
            const phoneNumberId = phoneResult.rows[0]?.whatsapp_number_id || null;
            const insertQuery = `
        INSERT INTO campaign_logs (
          user_id, 
          campaign_name, 
          template_used,
          phone_number_id,
          recipient_number, 
          message_id, 
          status, 
          total_recipients, 
          successful_sends, 
          failed_sends,
          sent_at,
          campaign_data,
          created_at, 
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'sent', 1, 1, 0, CURRENT_TIMESTAMP, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `;
            const templateUsed = this.extractTemplateName(meta) || 'BULK_MESSAGE';
            const campaignData = {
                source: 'bulk',
                jobId: meta?.jobId,
                batchIndex: meta?.batchIndex,
                messageType: meta?.messageType || 'unknown',
                timestamp: new Date().toISOString()
            };
            const result = await db_1.default.query(insertQuery, [
                userId,
                campaignName,
                templateUsed,
                phoneNumberId,
                cleanRecipient,
                messageId,
                campaignData
            ]);
            if (result.rows.length > 0) {
                logger_1.logger.debug('[BULK-REPO] Campaign log entry created', {
                    userId,
                    messageId,
                    recipient: cleanRecipient,
                    recordId: result.rows[0].id,
                    campaignName
                });
            }
            else {
                logger_1.logger.debug('[BULK-REPO] Campaign log entry already exists (ignored)', {
                    userId,
                    messageId,
                    recipient: cleanRecipient
                });
            }
        }
        catch (error) {
            logger_1.logger.error('[BULK-REPO] Failed to upsert campaign log', {
                userId,
                messageId,
                to,
                campaignId,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    extractTemplateName(meta) {
        if (!meta)
            return null;
        if (meta.templateName)
            return meta.templateName;
        if (meta.template?.name)
            return meta.template.name;
        return null;
    }
}
exports.BulkCampaignLogsRepo = BulkCampaignLogsRepo;
exports.userBusinessRepo = new UserBusinessRepo();
exports.bulkCampaignLogsRepo = new BulkCampaignLogsRepo();
//# sourceMappingURL=bulkRepos.js.map