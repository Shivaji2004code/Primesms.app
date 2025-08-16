// Bulk Integration Routes
// Integrates bulk messaging with existing WhatsApp quick send and customize features
import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { BulkQueue, BulkJobInput } from '../services/bulkQueue';
import { userBusinessRepo, bulkCampaignLogsRepo } from '../repos/bulkRepos';
import { bulkSSE } from '../services/bulkSSE';
import { logger } from '../utils/logger';
import { analyzeTemplate, buildTemplatePayload } from '../utils/template-helper';
import pool from '../db';

const router = Router();

// Create bulk queue instance
const bulkQueue = new BulkQueue(
  userBusinessRepo,
  bulkCampaignLogsRepo,
  (jobId, payload) => bulkSSE.emit(jobId, payload)
);

// Rate limiting for bulk operations
const bulkRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit to 20 bulk operations per hour per IP
  message: {
    error: 'Too many bulk requests',
    message: 'Bulk operations are limited to 20 per hour. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Authentication middleware for bulk operations
const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const session = req.session as any;
  
  if (!session?.userId) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please log in to access bulk messaging'
    });
  }

  // Verify user exists in database
  try {
    const result = await pool.query(
      'SELECT id, name, username, role FROM users WHERE id = $1 LIMIT 1',
      [session.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'User not found',
        message: 'Your session is invalid. Please log in again.'
      });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    logger.error('[BULK-INTEGRATION] Auth error', { error });
    res.status(500).json({
      error: 'Authentication error',
      message: 'Please try again later'
    });
  }
};

// POST /api/whatsapp/bulk-quick-send - Bulk version of quick send
router.post('/bulk-quick-send', bulkRateLimit, requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      phone_number_id,
      template_name,
      language = 'en_US',
      recipients_text,
      variables = {},
      campaign_name
    } = req.body;

    const authenticatedUserId = req.user?.id;

    // Validation
    if (!phone_number_id || !template_name || !recipients_text) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'phone_number_id, template_name, and recipients_text are required'
      });
    }

    // Parse recipients
    const recipients = recipients_text
      .split(/[,\n]/)
      .map((num: string) => num.trim())
      .filter((num: string) => num.length > 0);

    if (recipients.length === 0) {
      return res.status(400).json({
        error: 'No recipients provided',
        message: 'Please provide at least one valid phone number'
      });
    }

    // Check bulk threshold - if more than 50, use bulk queue
    if (recipients.length > 50) {
      // Fetch template details to build proper components
      let templateComponents: any[] = [];
      try {
        const templatesResult = await pool.query(
          'SELECT * FROM user_templates WHERE user_id = $1 AND name = $2 AND language = $3 LIMIT 1',
          [authenticatedUserId, template_name, language]
        );
        
        if (templatesResult.rows.length > 0) {
          const template = templatesResult.rows[0];
          const templateInfo = {
            name: template.name,
            category: template.category,
            language: template.language,
            status: template.status,
            components: template.components || []
          };
          
          // Get the base template components - not build the full payload
          templateComponents = templateInfo.components;
        }
      } catch (error) {
        logger.error('[BULK-INTEGRATION] Failed to fetch template details', { error, template_name, userId: authenticatedUserId });
      }

      const jobInput: BulkJobInput = {
        userId: authenticatedUserId!,
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
        variables // Static variables for all recipients
      };

      const job = bulkQueue.enqueue(jobInput);

      logger.info('[BULK-INTEGRATION] Quick send bulk job created', {
        jobId: job.jobId,
        userId: authenticatedUserId!,
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

    // For smaller lists, fall through to regular processing
    // This could be handled by the existing quick-send endpoint
    return res.status(400).json({
      error: 'Use regular quick-send',
      message: 'For recipients less than 50, use the regular /api/whatsapp/quick-send endpoint'
    });

  } catch (error: any) {
    logger.error('[BULK-INTEGRATION] Bulk quick send failed', { error, userId: req.user?.id });
    
    res.status(500).json({
      error: 'Bulk Quick Send Failed',
      message: error.message || 'An error occurred while processing your bulk quick send request'
    });
  }
});

// POST /api/whatsapp/bulk-customize-send - Bulk version of customize send
router.post('/bulk-customize-send', bulkRateLimit, requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      templateName,
      language = 'en_US',
      phoneNumberId,
      recipientColumn,
      variableMappings = {},
      data = []
    } = req.body;

    const authenticatedUserId = req.user?.id;

    // Validation
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

    // Extract recipients and prepare per-recipient variables
    const recipients: string[] = [];
    const recipientVariables: Array<{ recipient: string; variables: any }> = [];

    data.forEach((row: any) => {
      const recipient = row[recipientColumn];
      if (recipient) {
        recipients.push(recipient.toString());
        
        // Map variables for this recipient
        const variables: any = {};
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

    // Check bulk threshold - if more than 50, use bulk queue
    if (recipients.length > 50) {
      // Fetch template details to build proper components
      let templateComponents: any[] = [];
      try {
        const templatesResult = await pool.query(
          'SELECT * FROM user_templates WHERE user_id = $1 AND name = $2 AND language = $3 LIMIT 1',
          [authenticatedUserId, templateName, language]
        );
        
        if (templatesResult.rows.length > 0) {
          const template = templatesResult.rows[0];
          const templateInfo = {
            name: template.name,
            category: template.category,
            language: template.language,
            status: template.status,
            components: template.components || []
          };
          
          // Store the base template structure for the bulk processor
          templateComponents = templateInfo.components;
        }
      } catch (error) {
        logger.error('[BULK-INTEGRATION] Failed to fetch template details', { error, templateName, userId: authenticatedUserId });
      }

      const jobInput: BulkJobInput = {
        userId: authenticatedUserId!,
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
        recipientVariables // Per-recipient variables
      };

      const job = bulkQueue.enqueue(jobInput);

      logger.info('[BULK-INTEGRATION] Customize bulk job created', {
        jobId: job.jobId,
        userId: authenticatedUserId!,
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

    // For smaller lists, fall through to regular processing
    return res.status(400).json({
      error: 'Use regular customize-send',
      message: 'For recipients less than 50, use the regular /api/whatsapp/send-custom-messages endpoint'
    });

  } catch (error: any) {
    logger.error('[BULK-INTEGRATION] Bulk customize send failed', { error, userId: req.user?.id });
    
    res.status(500).json({
      error: 'Bulk Customize Send Failed',
      message: error.message || 'An error occurred while processing your bulk customize request'
    });
  }
});

// Type declarations for request extensions
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        username: string;
        role: string;
      };
    }
  }
}

export default router;