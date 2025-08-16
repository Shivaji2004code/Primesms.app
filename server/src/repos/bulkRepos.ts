// Repository implementations for bulk messaging
// Connects to existing database schema without changes
import pool from '../db';
import { logger } from '../utils/logger';
import { CredsProvider, CampaignLogsRepo, TenantCreds } from '../services/bulkQueue';

export class UserBusinessRepo implements CredsProvider {
  async getCredsByUserId(userId: string): Promise<TenantCreds> {
    try {
      const query = `
        SELECT 
          whatsapp_number_id,
          access_token
        FROM user_business_info 
        WHERE user_id = $1 AND is_active = true
        LIMIT 1
      `;
      
      const result = await pool.query(query, [userId]);
      
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
      
    } catch (error) {
      logger.error('[BULK-REPO] Failed to get user credentials', { userId, error });
      throw error;
    }
  }
}

export class BulkCampaignLogsRepo implements CampaignLogsRepo {
  async createCampaignLogEntry(
    userId: string, 
    to: string, 
    campaignId: string, 
    templateName: string, 
    phoneNumberId: string, 
    language: string, 
    variables?: any, 
    components?: any
  ): Promise<string> {
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
        VALUES ($1::UUID, $2::VARCHAR, $3::VARCHAR, $4::VARCHAR, $5::VARCHAR, $6::VARCHAR, 'pending'::VARCHAR, $7::JSONB, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `;
      
      const result = await pool.query(insertQuery, [
        userId,
        campaignId,
        templateName,
        phoneNumberId,
        cleanRecipient,
        language,
        JSON.stringify(campaignData)
      ]);
      
      const logId = result.rows[0].id;
      
      logger.debug('[BULK-REPO] Campaign log entry created', {
        userId,
        logId,
        recipient: cleanRecipient,
        campaignId,
        templateName
      });
      
      return logId.toString();
      
    } catch (error) {
      logger.error('[BULK-REPO] Failed to create campaign log entry', {
        userId,
        to,
        campaignId,
        templateName,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async updateCampaignLogStatus(
    logId: string, 
    status: 'sent' | 'failed', 
    messageId?: string, 
    errorMessage?: string
  ): Promise<void> {
    try {
      const updateQuery = `
        UPDATE campaign_logs 
        SET 
          status = $1::VARCHAR,
          message_id = $2::VARCHAR,
          error_message = $3::TEXT,
          sent_at = CASE WHEN $1::VARCHAR = 'sent' THEN CURRENT_TIMESTAMP ELSE sent_at END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4::UUID
      `;
      
      await pool.query(updateQuery, [
        status,
        messageId || null,
        errorMessage || null,
        logId
      ]);
      
      logger.debug('[BULK-REPO] Campaign log status updated', {
        logId,
        status,
        messageId,
        hasError: !!errorMessage
      });
      
    } catch (error) {
      logger.error('[BULK-REPO] Failed to update campaign log status', {
        logId,
        status,
        messageId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async updateCampaignLogByMessageId(
    userId: string,
    messageId: string,
    status: 'sent' | 'delivered' | 'read' | 'failed',
    timestamp?: Date,
    errorMessage?: string
  ): Promise<boolean> {
    try {
      let updateQuery = '';
      let params: any[] = [];

      if (status === 'sent') {
        updateQuery = `
          UPDATE campaign_logs 
          SET status = $1::VARCHAR, sent_at = COALESCE(sent_at, $2::TIMESTAMP), updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $3::UUID AND message_id = $4::VARCHAR`;
        params = [status, timestamp || new Date(), userId, messageId];
      } else if (status === 'delivered') {
        updateQuery = `
          UPDATE campaign_logs 
          SET status = $1::VARCHAR, delivered_at = COALESCE(delivered_at, $2::TIMESTAMP), updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $3::UUID AND message_id = $4::VARCHAR`;
        params = [status, timestamp || new Date(), userId, messageId];
      } else if (status === 'read') {
        updateQuery = `
          UPDATE campaign_logs 
          SET status = $1::VARCHAR, read_at = COALESCE(read_at, $2::TIMESTAMP), updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $3::UUID AND message_id = $4::VARCHAR`;
        params = [status, timestamp || new Date(), userId, messageId];
      } else if (status === 'failed') {
        updateQuery = `
          UPDATE campaign_logs 
          SET status = $1::VARCHAR, error_message = $2::TEXT, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $3::UUID AND message_id = $4::VARCHAR`;
        params = [status, errorMessage || 'Message failed', userId, messageId];
      }

      if (updateQuery) {
        const result = await pool.query(updateQuery, params);
        
        if (result.rowCount && result.rowCount > 0) {
          logger.debug('[BULK-REPO] Campaign log updated by webhook', {
            userId,
            messageId,
            status,
            timestamp: timestamp?.toISOString()
          });
          return true;
        } else {
          logger.warn('[BULK-REPO] No campaign log found for webhook update', {
            userId,
            messageId,
            status
          });
          return false;
        }
      }
      
      return false;
      
    } catch (error) {
      logger.error('[BULK-REPO] Failed to update campaign log by messageId', {
        userId,
        messageId,
        status,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
  async upsertOnSendAck(
    userId: string, 
    messageId: string, 
    to: string, 
    campaignId?: string | null, 
    meta?: any
  ): Promise<void> {
    try {
      // Validate inputs
      const cleanRecipient = to?.toString().trim();
      if (!cleanRecipient) {
        logger.warn('[BULK-REPO] Skipping log entry: empty recipient', { userId, messageId });
        return;
      }

      if (!messageId) {
        logger.warn('[BULK-REPO] Skipping log entry: empty messageId', { userId, to: cleanRecipient });
        return;
      }

      // Create a unique campaign name for bulk operations
      const campaignName = campaignId || `BULK_${meta?.jobId || 'UNKNOWN'}_${Date.now()}`;
      
      // Get user's phone_number_id for logging
      const phoneNumberQuery = `
        SELECT whatsapp_number_id 
        FROM user_business_info 
        WHERE user_id = $1 AND is_active = true 
        LIMIT 1
      `;
      
      const phoneResult = await pool.query(phoneNumberQuery, [userId]);
      const phoneNumberId = phoneResult.rows[0]?.whatsapp_number_id || null;

      // Insert or update campaign_logs entry
      // Use ON CONFLICT to handle potential duplicate messageId entries
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
      
      const result = await pool.query(insertQuery, [
        userId,
        campaignName,
        templateUsed,
        phoneNumberId,
        cleanRecipient,
        messageId,
        campaignData
      ]);
      
      if (result.rows.length > 0) {
        logger.debug('[BULK-REPO] Campaign log entry created', {
          userId,
          messageId,
          recipient: cleanRecipient,
          recordId: result.rows[0].id,
          campaignName
        });
      } else {
        logger.debug('[BULK-REPO] Campaign log entry already exists (ignored)', {
          userId,
          messageId,
          recipient: cleanRecipient
        });
      }
      
    } catch (error) {
      // Don't throw - just log the error so bulk sending continues
      logger.error('[BULK-REPO] Failed to upsert campaign log', {
        userId,
        messageId,
        to,
        campaignId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private extractTemplateName(meta: any): string | null {
    if (!meta) return null;
    
    // Try to extract template name from meta
    if (meta.templateName) return meta.templateName;
    if (meta.template?.name) return meta.template.name;
    
    return null;
  }
}

// Export instances for use in bulk queue
export const userBusinessRepo = new UserBusinessRepo();
export const bulkCampaignLogsRepo = new BulkCampaignLogsRepo();