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
exports.WAProcessors = void 0;
exports.createProcessors = createProcessors;
const db_1 = __importDefault(require("../db"));
class RealUserBusinessInfoRepo {
    async getUserByPhoneNumberId(pni) {
        const client = await db_1.default.connect();
        try {
            const result = await client.query('SELECT user_id FROM user_business_info WHERE whatsapp_number_id = $1 AND is_active = true LIMIT 1', [pni]);
            if (result.rows.length === 0) {
                return null;
            }
            return { userId: result.rows[0].user_id };
        }
        finally {
            client.release();
        }
    }
}
class RealTemplatesRepo {
    async updateStatusByNameLang(userId, name, language, status, reason, reviewedAt) {
        const client = await db_1.default.connect();
        try {
            const updateResult = await client.query(`
        UPDATE templates 
        SET 
          status = $1,
          rejection_reason = COALESCE($2, rejection_reason),
          updated_at = COALESCE($3, CURRENT_TIMESTAMP),
          whatsapp_response = COALESCE(
            whatsapp_response, 
            jsonb_build_object('last_updated', $3, 'webhook_status', $1)
          )
        WHERE user_id = $4 AND name = $5 AND language = $6
        RETURNING id, name
      `, [status, reason, reviewedAt || new Date(), userId, name, language]);
            if (updateResult.rows.length > 0) {
                console.log(`✅ [PROCESSORS] Updated template status: ${name} (${language}) -> ${status} for user ${userId}`);
            }
            else {
                console.log(`⚠️  [PROCESSORS] Template not found for update: ${name} (${language}) user ${userId}`);
                console.log(`🔄 [PROCESSORS] Template ${name} not found, this is normal if webhook arrives before creation`);
            }
        }
        finally {
            client.release();
        }
    }
}
class RealCampaignLogsRepo {
    async upsertOnSendAck(userId, messageId, to, campaignId, meta) {
        const client = await db_1.default.connect();
        try {
            await client.query(`
        INSERT INTO campaign_logs (
          user_id, message_id, recipient_number, status, sent_at, campaign_data, updated_at
        ) VALUES ($1, $2, $3, 'sent', CURRENT_TIMESTAMP, $4, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, message_id) 
        DO UPDATE SET 
          status = CASE WHEN campaign_logs.status = 'pending' THEN 'sent' ELSE campaign_logs.status END,
          sent_at = COALESCE(campaign_logs.sent_at, CURRENT_TIMESTAMP),
          campaign_data = COALESCE($4, campaign_logs.campaign_data),
          updated_at = CURRENT_TIMESTAMP
      `, [userId, messageId, to, JSON.stringify(meta || {})]);
            console.log(`✅ [PROCESSORS] Upserted send ack: ${messageId} for user ${userId}`);
        }
        catch (error) {
            console.error(`❌ [PROCESSORS] Error upserting send ack ${messageId}:`, error);
        }
        finally {
            client.release();
        }
    }
    async markSent(userId, messageId, meta) {
        await this.updateStatus(userId, messageId, 'sent', { sent_at: 'CURRENT_TIMESTAMP' }, meta);
    }
    async markDelivered(userId, messageId, meta) {
        await this.updateStatus(userId, messageId, 'delivered', { delivered_at: 'CURRENT_TIMESTAMP' }, meta);
    }
    async markRead(userId, messageId, meta) {
        await this.updateStatus(userId, messageId, 'read', { delivered_at: 'CURRENT_TIMESTAMP' }, meta);
    }
    async markFailed(userId, messageId, error) {
        await this.updateStatus(userId, messageId, 'failed', {}, { ...error, failed_at: new Date() });
    }
    async updateStatus(userId, messageId, status, timestampUpdates = {}, meta) {
        const client = await db_1.default.connect();
        try {
            const timestampClauses = Object.entries(timestampUpdates)
                .map(([field, value]) => `${field} = ${value}`)
                .join(', ');
            const setClause = `
        status = $1,
        campaign_data = CASE 
          WHEN campaign_data IS NULL THEN $2::jsonb 
          ELSE campaign_data || $2::jsonb 
        END,
        updated_at = CURRENT_TIMESTAMP
        ${timestampClauses ? ', ' + timestampClauses : ''}
      `;
            const updateResult = await client.query(`
        UPDATE campaign_logs 
        SET ${setClause}
        WHERE user_id = $3::UUID AND message_id = $4::VARCHAR
        RETURNING id, campaign_name, recipient_number, status
      `, [status, JSON.stringify(meta || {}), userId, messageId]);
            if (updateResult.rows.length > 0) {
                const row = updateResult.rows[0];
                console.log(`✅ [PROCESSORS] Updated message status: ${messageId} -> ${status} for user ${userId} (campaign: ${row.campaign_name})`);
            }
            else {
                console.log(`⚠️  [PROCESSORS] Message not found for status update: ${messageId} user ${userId}`);
                const recipientNumber = meta?.recipient_id || 'unknown';
                await client.query(`
          INSERT INTO campaign_logs (
            user_id, message_id, recipient_number, status, campaign_data, 
            campaign_name, template_used, 
            sent_at, delivered_at, read_at,
            created_at, updated_at
          ) VALUES ($1::UUID, $2::VARCHAR, $3::VARCHAR, $4::VARCHAR, $5::JSONB, 'webhook_only', 'unknown', 
            ${status === 'sent' ? 'CURRENT_TIMESTAMP' : 'NULL'},
            ${status === 'delivered' ? 'CURRENT_TIMESTAMP' : 'NULL'},
            ${status === 'read' ? 'CURRENT_TIMESTAMP' : 'NULL'},
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (message_id) DO UPDATE SET
            status = EXCLUDED.status,
            campaign_data = COALESCE(campaign_logs.campaign_data, '{}'::jsonb) || EXCLUDED.campaign_data,
            ${status === 'sent' ? 'sent_at = COALESCE(campaign_logs.sent_at, EXCLUDED.sent_at),' : ''}
            ${status === 'delivered' ? 'delivered_at = COALESCE(campaign_logs.delivered_at, EXCLUDED.delivered_at),' : ''}
            ${status === 'read' ? 'read_at = COALESCE(campaign_logs.read_at, EXCLUDED.read_at),' : ''}
            updated_at = CURRENT_TIMESTAMP
        `, [userId, messageId, recipientNumber, status, JSON.stringify(meta || {})]);
                console.log(`🔄 [PROCESSORS] Created campaign_logs entry from webhook: ${messageId}`);
            }
        }
        catch (error) {
            console.error(`❌ [PROCESSORS] Error updating status ${status} for ${messageId}:`, error);
        }
        finally {
            client.release();
        }
    }
}
class WAProcessors {
    constructor(ubiRepo, templatesRepo, logsRepo, broadcaster) {
        this.ubiRepo = ubiRepo;
        this.templatesRepo = templatesRepo;
        this.logsRepo = logsRepo;
        this.broadcaster = broadcaster;
    }
    async processWebhook(body) {
        try {
            const entries = body?.entry || [];
            console.log(`🔄 [PROCESSORS] Processing ${entries.length} webhook entries`);
            for (const entry of entries) {
                const changes = entry?.changes || [];
                for (const change of changes) {
                    if (!change)
                        continue;
                    const field = change.field;
                    const value = change.value;
                    console.log(`📝 [PROCESSORS] Processing field: ${field}`);
                    if (field === 'message_template_status_update') {
                        await this.handleTemplateUpdate(value, entry.id);
                        continue;
                    }
                    if (field === 'messages') {
                        if (Array.isArray(value?.statuses) && value.statuses.length > 0) {
                            await this.handleMessageStatuses(value);
                        }
                    }
                }
            }
        }
        catch (error) {
            console.error('❌ [PROCESSORS] Error in processWebhook:', error);
        }
    }
    async resolveUserIdFromValue(val) {
        try {
            const pni = val?.metadata?.phone_number_id;
            if (!pni) {
                console.log('⚠️  [PROCESSORS] No phone_number_id in webhook payload');
                return null;
            }
            const user = await this.ubiRepo.getUserByPhoneNumberId(pni);
            if (!user) {
                console.log(`⚠️  [PROCESSORS] No user found for phone_number_id: ${pni}`);
                return null;
            }
            console.log(`📱 [PROCESSORS] Resolved phone_number_id ${pni} -> user ${user.userId}`);
            return user.userId;
        }
        catch (error) {
            console.error('❌ [PROCESSORS] Error resolving user from phone_number_id:', error);
            return null;
        }
    }
    async handleTemplateUpdate(val, wabaId) {
        try {
            const { handleTemplateStatusChange } = await Promise.resolve().then(() => __importStar(require('./templateProcessor')));
            await handleTemplateStatusChange(val, wabaId);
        }
        catch (error) {
            console.error('❌ [PROCESSORS] Error handling template update:', error);
        }
    }
    async handleMessageStatuses(val) {
        try {
            console.log(`📊 [PROCESSORS] Processing message statuses: ${val.statuses?.length || 0} updates`);
            const userId = await this.resolveUserIdFromValue(val);
            if (!userId)
                return;
            for (const statusObj of val.statuses) {
                const wamid = statusObj.id;
                const status = String(statusObj.status).toLowerCase();
                const timestamp = statusObj.timestamp;
                const atIso = timestamp ? new Date(Number(timestamp) * 1000).toISOString() : new Date().toISOString();
                const meta = {
                    conversation: statusObj.conversation || null,
                    pricing: statusObj.pricing || null,
                    recipient_id: statusObj.recipient_id || null,
                    timestamp: atIso,
                    raw: statusObj
                };
                console.log(`📊 [PROCESSORS] Status update: ${wamid} -> ${status} at ${atIso}`);
                if (status === 'sent') {
                    await this.logsRepo.markSent(userId, wamid, meta);
                    this.broadcaster.emitReport(userId, {
                        type: 'report_update',
                        status: 'sent',
                        messageId: wamid,
                        at: atIso,
                        meta
                    });
                }
                else if (status === 'delivered') {
                    await this.logsRepo.markDelivered(userId, wamid, meta);
                    this.broadcaster.emitReport(userId, {
                        type: 'report_update',
                        status: 'delivered',
                        messageId: wamid,
                        at: atIso,
                        meta
                    });
                }
                else if (status === 'read') {
                    await this.logsRepo.markRead(userId, wamid, meta);
                    this.broadcaster.emitReport(userId, {
                        type: 'report_update',
                        status: 'read',
                        messageId: wamid,
                        at: atIso,
                        meta
                    });
                }
                else if (status === 'failed' || status === 'deleted') {
                    const errorInfo = {
                        ...meta,
                        errors: statusObj.errors || null,
                        error: statusObj.error || null,
                        failure_reason: statusObj.failure_reason || 'unknown'
                    };
                    await this.logsRepo.markFailed(userId, wamid, errorInfo);
                    this.broadcaster.emitReport(userId, {
                        type: 'report_update',
                        status: 'failed',
                        messageId: wamid,
                        at: atIso,
                        meta: errorInfo
                    });
                }
                else {
                    console.log(`🤷 [PROCESSORS] Unknown status: ${status} for ${wamid}`);
                }
            }
        }
        catch (error) {
            console.error('❌ [PROCESSORS] Error handling message statuses:', error);
        }
    }
}
exports.WAProcessors = WAProcessors;
function createProcessors(broadcaster) {
    return new WAProcessors(new RealUserBusinessInfoRepo(), new RealTemplatesRepo(), new RealCampaignLogsRepo(), broadcaster);
}
