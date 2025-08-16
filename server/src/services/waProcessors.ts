// [Claude AI] WhatsApp Webhook Processors Service — Aug 2025
import pool from '../db';

type AnyObj = Record<string, any>;

// ====== INTERFACES ======
export interface UserBusinessInfoRepo {
  getUserByPhoneNumberId(pni: string): Promise<{ userId: string } | null>;
}

export interface TemplatesRepo {
  updateStatusByNameLang(
    userId: string,
    name: string,
    language: string,
    status: string,
    reason?: string | null,
    reviewedAt?: Date | null
  ): Promise<void>;
}

export interface CampaignLogsRepo {
  upsertOnSendAck(userId: string, messageId: string, to: string, campaignId?: string | null, meta?: AnyObj): Promise<void>;
  markSent(userId: string, messageId: string, meta?: AnyObj): Promise<void>;
  markDelivered(userId: string, messageId: string, meta?: AnyObj): Promise<void>;
  markRead(userId: string, messageId: string, meta?: AnyObj): Promise<void>;
  markFailed(userId: string, messageId: string, error?: AnyObj): Promise<void>;
}

export interface Broadcaster {
  emitReport(userId: string, payload: AnyObj): void;
  emitTemplate(userId: string, payload: AnyObj): void;
}

// ====== REAL DATABASE IMPLEMENTATIONS ======

class RealUserBusinessInfoRepo implements UserBusinessInfoRepo {
  async getUserByPhoneNumberId(pni: string): Promise<{ userId: string } | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT user_id FROM user_business_info WHERE whatsapp_number_id = $1 AND is_active = true LIMIT 1',
        [pni]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return { userId: result.rows[0].user_id };
    } finally {
      client.release();
    }
  }
}

class RealTemplatesRepo implements TemplatesRepo {
  async updateStatusByNameLang(
    userId: string,
    name: string,
    language: string,
    status: string,
    reason?: string | null,
    reviewedAt?: Date | null
  ): Promise<void> {
    const client = await pool.connect();
    try {
      // Update template status based on user_id, name, and language
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
      } else {
        console.log(`⚠️  [PROCESSORS] Template not found for update: ${name} (${language}) user ${userId}`);
        
        // Optionally, create a new template entry if it doesn't exist
        // This might happen if webhook arrives before template creation
        console.log(`🔄 [PROCESSORS] Template ${name} not found, this is normal if webhook arrives before creation`);
      }
    } finally {
      client.release();
    }
  }
}

class RealCampaignLogsRepo implements CampaignLogsRepo {
  async upsertOnSendAck(userId: string, messageId: string, to: string, campaignId?: string | null, meta?: AnyObj): Promise<void> {
    const client = await pool.connect();
    try {
      // Insert or update campaign_logs entry when we get send acknowledgment
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
    } catch (error) {
      console.error(`❌ [PROCESSORS] Error upserting send ack ${messageId}:`, error);
    } finally {
      client.release();
    }
  }

  async markSent(userId: string, messageId: string, meta?: AnyObj): Promise<void> {
    await this.updateStatus(userId, messageId, 'sent', { sent_at: 'CURRENT_TIMESTAMP' }, meta);
  }

  async markDelivered(userId: string, messageId: string, meta?: AnyObj): Promise<void> {
    await this.updateStatus(userId, messageId, 'delivered', { delivered_at: 'CURRENT_TIMESTAMP' }, meta);
  }

  async markRead(userId: string, messageId: string, meta?: AnyObj): Promise<void> {
    await this.updateStatus(userId, messageId, 'read', { delivered_at: 'CURRENT_TIMESTAMP' }, meta);
  }

  async markFailed(userId: string, messageId: string, error?: AnyObj): Promise<void> {
    await this.updateStatus(userId, messageId, 'failed', {}, { ...error, failed_at: new Date() });
  }

  private async updateStatus(
    userId: string, 
    messageId: string, 
    status: string, 
    timestampUpdates: Record<string, string> = {}, 
    meta?: AnyObj
  ): Promise<void> {
    const client = await pool.connect();
    try {
      // Build dynamic SET clause for timestamp updates
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

      // First try to update existing record
      const updateResult = await client.query(`
        UPDATE campaign_logs 
        SET ${setClause}
        WHERE user_id = $3::UUID AND message_id = $4::VARCHAR
        RETURNING id, campaign_name, recipient_number, status
      `, [status, JSON.stringify(meta || {}), userId, messageId]);
      
      if (updateResult.rows.length > 0) {
        const row = updateResult.rows[0];
        console.log(`✅ [PROCESSORS] Updated message status: ${messageId} -> ${status} for user ${userId} (campaign: ${row.campaign_name})`);
      } else {
        console.log(`⚠️  [PROCESSORS] Message not found for status update: ${messageId} user ${userId}`);
        
        // Create entry if it doesn't exist (webhook arrived before send confirmation)
        // Use proper column names that exist in campaign_logs
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
    } catch (error) {
      console.error(`❌ [PROCESSORS] Error updating status ${status} for ${messageId}:`, error);
    } finally {
      client.release();
    }
  }
}

// ====== MAIN PROCESSOR CLASS ======

export class WAProcessors {
  constructor(
    private ubiRepo: UserBusinessInfoRepo,
    private templatesRepo: TemplatesRepo,
    private logsRepo: CampaignLogsRepo,
    private broadcaster: Broadcaster
  ) {}

  async processWebhook(body: AnyObj): Promise<void> {
    try {
      const entries = body?.entry || [];
      console.log(`🔄 [PROCESSORS] Processing ${entries.length} webhook entries`);
      
      for (const entry of entries) {
        const changes = entry?.changes || [];
        
        for (const change of changes) {
          if (!change) continue;
          const field = change.field;
          const value = change.value;

          console.log(`📝 [PROCESSORS] Processing field: ${field}`);

          if (field === 'message_template_status_update') {
            // Template status updates need WABA ID context for user resolution
            await this.handleTemplateUpdate(value, entry.id);
            continue;
          }

          if (field === 'messages') {
            // Handle message status updates (sent, delivered, read, failed)
            if (Array.isArray(value?.statuses) && value.statuses.length > 0) {
              await this.handleMessageStatuses(value);
            }
            // Note: Incoming messages are handled by the existing processIncomingMessages function
          }
        }
      }
    } catch (error) {
      console.error('❌ [PROCESSORS] Error in processWebhook:', error);
      // Don't throw - webhook should always return 200
    }
  }

  private async resolveUserIdFromValue(val: AnyObj): Promise<string | null> {
    try {
      const pni: string | undefined = val?.metadata?.phone_number_id;
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
    } catch (error) {
      console.error('❌ [PROCESSORS] Error resolving user from phone_number_id:', error);
      return null;
    }
  }

  // ====== TEMPLATE STATUS UPDATES ======
  private async handleTemplateUpdate(val: AnyObj, wabaId?: string): Promise<void> {
    try {
      // Use the enhanced template processor that includes category updates and Graph API fallback
      const { handleTemplateStatusChange } = await import('./templateProcessor');
      await handleTemplateStatusChange(val, wabaId);
    } catch (error) {
      console.error('❌ [PROCESSORS] Error handling template update:', error);
    }
  }

  // ====== MESSAGE STATUS UPDATES (for Reports) ======
  private async handleMessageStatuses(val: AnyObj): Promise<void> {
    try {
      console.log(`📊 [PROCESSORS] Processing message statuses: ${val.statuses?.length || 0} updates`);
      
      const userId = await this.resolveUserIdFromValue(val);
      if (!userId) return;

      for (const statusObj of val.statuses as AnyObj[]) {
        const wamid: string = statusObj.id;
        const status: string = String(statusObj.status).toLowerCase();
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

        // Update campaign_logs based on status
        if (status === 'sent') {
          await this.logsRepo.markSent(userId, wamid, meta);
          this.broadcaster.emitReport(userId, { 
            type: 'report_update', 
            status: 'sent', 
            messageId: wamid, 
            at: atIso, 
            meta 
          });
        } else if (status === 'delivered') {
          await this.logsRepo.markDelivered(userId, wamid, meta);
          this.broadcaster.emitReport(userId, { 
            type: 'report_update', 
            status: 'delivered', 
            messageId: wamid, 
            at: atIso, 
            meta 
          });
        } else if (status === 'read') {
          await this.logsRepo.markRead(userId, wamid, meta);
          this.broadcaster.emitReport(userId, { 
            type: 'report_update', 
            status: 'read', 
            messageId: wamid, 
            at: atIso, 
            meta 
          });
        } else if (status === 'failed' || status === 'deleted') {
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
        } else {
          console.log(`🤷 [PROCESSORS] Unknown status: ${status} for ${wamid}`);
        }
      }
    } catch (error) {
      console.error('❌ [PROCESSORS] Error handling message statuses:', error);
    }
  }
}

// ====== FACTORY FUNCTION ======
export function createProcessors(broadcaster: Broadcaster): WAProcessors {
  return new WAProcessors(
    new RealUserBusinessInfoRepo(),
    new RealTemplatesRepo(),
    new RealCampaignLogsRepo(),
    broadcaster
  );
}