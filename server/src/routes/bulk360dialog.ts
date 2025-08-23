// Bulk 360dialog Send API Router - High Performance Bulk Messaging
// Uses same interface as existing bulk send but with 360dialog backend
import express from 'express';
import rateLimit from 'express-rate-limit';
import pool from '../db';
import { validatePhoneNumber, sanitizeInput } from '../utils/sendApiHelpers';
import { 
  deductCredits, 
  CreditTransactionType, 
  calculateCreditCost, 
  TemplateCategory 
} from '../utils/creditSystem';
import { create360Sender } from '../services/wa360Sender';
import { resolve360DialogCredentials } from '../utils/360dialogCredentials';
import { logger } from '../utils/logger';

const router = express.Router();

// Initialize 360dialog sender
const sender360 = create360Sender(resolve360DialogCredentials);

// More restrictive rate limiting for bulk operations
const bulkRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 bulk requests per windowMs
  message: {
    error: 'Too many bulk requests',
    message: 'Bulk rate limit exceeded. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(bulkRateLimit);

/**
 * Bulk Send Endpoint for 360dialog
 * POST /api/bulk360dialog/send
 * 
 * Body:
 * {
 *   "username": "client_username",
 *   "templatename": "template_name", 
 *   "recipients": ["+1234567890", "+0987654321"],
 *   "variables": [
 *     {"var1": "Value1", "var2": "Value2"},  // for recipient 1
 *     {"var1": "ValueA", "var2": "ValueB"}   // for recipient 2
 *   ],
 *   "concurrency": 10,  // optional
 *   "maxAttempts": 4    // optional
 * }
 */
router.post('/send', async (req, res) => {
  try {
    const {
      username,
      templatename,
      recipients,
      variables = [],
      concurrency = 10,
      maxAttempts = 4,
      header_text,
      button_url
    } = req.body;

    // Basic validation
    if (!username || !templatename || !Array.isArray(recipients)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: username, templatename, recipients (array)'
      });
    }

    if (recipients.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Recipients array cannot be empty'
      });
    }

    if (recipients.length > 10000) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Cannot send to more than 10,000 recipients at once'
      });
    }

    // Validate concurrency limits
    const safeConcurrency = Math.min(Math.max(1, concurrency), 50); // 1-50 range
    const safeMaxAttempts = Math.min(Math.max(1, maxAttempts), 10); // 1-10 range

    // Authenticate user and fetch credentials
    const authResult = await authenticateAndFetchCredentials(username);
    if (!authResult.success) {
      return res.status(authResult.statusCode || 500).json({
        error: authResult.error,
        message: authResult.message
      });
    }

    const { userId, businessInfo } = authResult.data;

    // Fetch template
    const templateResult = await fetchTemplate(userId, templatename);
    if (!templateResult.success) {
      return res.status(templateResult.statusCode || 500).json({
        error: templateResult.error,
        message: templateResult.message
      });
    }

    const template = templateResult.data;

    // Validate all phone numbers
    const invalidNumbers: string[] = [];
    recipients.forEach((phone: string, index: number) => {
      if (!validatePhoneNumber(phone)) {
        invalidNumbers.push(`${phone} (index ${index})`);
      }
    });

    if (invalidNumbers.length > 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid phone numbers detected',
        details: invalidNumbers.slice(0, 10) // Show first 10 invalid numbers
      });
    }

    // Calculate total cost and check credits
    const { cost: unitCost } = await calculateCreditCost(userId, template.name, 1);
    const totalCost = unitCost * recipients.length;

    // Check if user has enough credits
    const creditCheck = await pool.query(
      'SELECT credits FROM users WHERE id = $1',
      [userId]
    );

    if (creditCheck.rows.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found'
      });
    }

    const userCredits = creditCheck.rows[0].credits || 0;
    if (userCredits < totalCost) {
      return res.status(402).json({
        error: 'Insufficient Credits',
        message: `Need ${totalCost} credits, but only ${userCredits} available`,
        details: {
          required: totalCost,
          available: userCredits,
          recipients: recipients.length,
          costPerMessage: unitCost
        }
      });
    }

    // Prepare bulk send input
    const bulkInput = {
      userId,
      toList: recipients.map((phone: string) => phone.toString()),
      templateName: template.name,
      languageCode: template.language || 'en_US',
      concurrency: safeConcurrency,
      maxAttempts: safeMaxAttempts,
      components: buildBulkComponents(header_text, button_url)
    };

    logger.info(`[BULK 360DIALOG] Starting bulk send: ${recipients.length} recipients, template: ${template.name}`);

    // Execute bulk send
    const startTime = Date.now();
    const bulkResult = await sender360.bulkSendTemplate(bulkInput);
    const duration = Date.now() - startTime;

    logger.info(`[BULK 360DIALOG] Completed: ${bulkResult.succeeded}/${bulkResult.total} sent in ${duration}ms`);

    // Deduct credits for successful sends only
    if (bulkResult.succeeded > 0) {
      try {
        const actualCost = unitCost * bulkResult.succeeded;
        const templateCategory = template.category as TemplateCategory;
        
        await deductCredits({
          userId,
          amount: actualCost,
          transactionType: CreditTransactionType.DEDUCTION_API_DELIVERED,
          templateCategory,
          templateName: template.name,
          description: `360dialog bulk send: ${bulkResult.succeeded} messages delivered`
        });

        logger.info(`[BULK 360DIALOG] Deducted ${actualCost} credits for ${bulkResult.succeeded} successful sends`);
      } catch (creditError) {
        logger.error('Failed to deduct credits for bulk 360dialog send:', creditError);
      }
    }

    // Log campaign
    await logBulkCampaign(userId, template, recipients.length, bulkResult, businessInfo.channel_id);

    // Return detailed results
    const response = {
      success: true,
      campaign: {
        template: templatename,
        provider: '360dialog',
        totalRecipients: bulkResult.total,
        successful: bulkResult.succeeded,
        failed: bulkResult.failed,
        duration: `${duration}ms`,
        creditsDeducted: unitCost * bulkResult.succeeded
      },
      summary: {
        sent: bulkResult.succeeded,
        failed: bulkResult.failed,
        rate: bulkResult.total > 0 ? Math.round((bulkResult.succeeded / bulkResult.total) * 100) : 0
      },
      results: bulkResult.results.map((result, index) => ({
        index,
        recipient: result.to,
        success: result.success,
        messageId: result.success ? result.messageId : undefined,
        error: !result.success ? {
          code: result.code,
          message: getErrorMessage(result.code)
        } : undefined
      }))
    };

    res.status(200).json(response);

  } catch (error) {
    logger.error('Bulk 360dialog Send Error:', error);
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred during bulk send'
    });
  }
});

/**
 * Bulk Send Status Endpoint
 * GET /api/bulk360dialog/status/:campaignId
 */
router.get('/status/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    // This could be implemented to check bulk campaign status
    // For now, return a simple response
    res.json({
      success: true,
      message: 'Status endpoint not yet implemented',
      campaignId
    });

  } catch (error) {
    logger.error('Bulk status check error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to check bulk send status'
    });
  }
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Build components for bulk send (simpler than individual sends)
 */
function buildBulkComponents(headerText?: string, buttonUrl?: string): any {
  const components: any = {};

  if (headerText) {
    components.headerTextParam = headerText;
  }

  if (buttonUrl) {
    components.buttonUrlParam0 = buttonUrl;
  }

  return Object.keys(components).length > 0 ? components : undefined;
}

/**
 * Authenticate user for bulk operations
 */
async function authenticateAndFetchCredentials(username: string): Promise<{
  success: boolean;
  statusCode?: number;
  error?: string;
  message?: string;
  data?: any;
}> {
  try {
    const query = `
      SELECT 
        u.id as user_id,
        u.username,
        u.credits,
        ubi.channel_id,
        ubi.api_key,
        ubi.is_active,
        ubi.business_name
      FROM users u
      INNER JOIN user_business_info ubi ON u.id = ubi.user_id
      WHERE u.username = $1 AND ubi.is_active = true AND ubi.provider = '360dialog'
    `;
    
    const result = await pool.query(query, [username]);
    
    if (result.rows.length === 0) {
      return {
        success: false,
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid username or inactive 360dialog account'
      };
    }
    
    const row = result.rows[0];
    
    if (!row.channel_id || !row.api_key) {
      return {
        success: false,
        statusCode: 401,
        error: 'Unauthorized',
        message: '360dialog API not properly configured for this user'
      };
    }
    
    return {
      success: true,
      data: {
        userId: row.user_id,
        credits: row.credits,
        businessInfo: {
          channel_id: row.channel_id,
          api_key: row.api_key,
          business_name: row.business_name
        }
      }
    };
    
  } catch (error) {
    logger.error('Bulk authentication error:', error);
    return {
      success: false,
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to authenticate user'
    };
  }
}

/**
 * Fetch template for bulk operations
 */
async function fetchTemplate(userId: string, templateName: string): Promise<{
  success: boolean;
  statusCode?: number;
  error?: string;
  message?: string;
  data?: any;
}> {
  try {
    const query = `
      SELECT 
        id,
        name,
        language,
        components,
        status,
        category
      FROM templates 
      WHERE user_id = $1 AND name = $2 AND status IN ('APPROVED', 'ACTIVE')
    `;
    
    const result = await pool.query(query, [userId, templateName]);
    
    if (result.rows.length === 0) {
      return {
        success: false,
        statusCode: 404,
        error: 'Not Found',
        message: `Template '${templateName}' not found or not active`
      };
    }
    
    return {
      success: true,
      data: result.rows[0]
    };
    
  } catch (error) {
    logger.error('Bulk template fetch error:', error);
    return {
      success: false,
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to fetch template'
    };
  }
}

/**
 * Log bulk campaign results
 */
async function logBulkCampaign(
  userId: string,
  template: any,
  totalRecipients: number,
  bulkResult: any,
  channelId: string
): Promise<void> {
  try {
    const campaignName = `BULK360_${template.name}_${Date.now()}`;
    
    await pool.query(`
      INSERT INTO campaign_logs (
        user_id, campaign_name, template_used, phone_number_id, 
        status, total_recipients, successful_sends, failed_sends,
        sent_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, 'completed', $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      userId,
      campaignName,
      template.name,
      channelId,
      totalRecipients,
      bulkResult.succeeded,
      bulkResult.failed
    ]);
    
    logger.info(`✅ Logged bulk campaign: ${campaignName} (${bulkResult.succeeded}/${totalRecipients} sent)`);
    
  } catch (error) {
    logger.error('❌ Failed to log bulk campaign:', error);
  }
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(code: string): string {
  switch (code) {
    case "INVALID_API_KEY":
      return "360dialog API key is invalid or expired";
    case "TEMPLATE_PARAM_MISMATCH":
      return "Template parameters are incorrect";
    case "RATE_LIMITED":
      return "Rate limited by 360dialog - message will be retried";
    case "RETRYABLE":
      return "Temporary error - message will be retried";
    case "BAD_REQUEST":
      return "Invalid message format or recipient";
    default:
      return "Unknown error occurred";
  }
}

export default router;