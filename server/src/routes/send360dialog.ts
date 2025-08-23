// 360dialog Send API Router - Compatible with existing Prime SMS API
// Replaces Meta Graph API with 360dialog while maintaining same interface
import express from 'express';
import rateLimit from 'express-rate-limit';
import pool from '../db';
import { validatePhoneNumber, sanitizeInput, extractVariables } from '../utils/sendApiHelpers';
import { 
  deductCredits, 
  CreditTransactionType, 
  calculateCreditCost, 
  TemplateCategory 
} from '../utils/creditSystem';
import { 
  checkAndHandleDuplicate 
} from '../middleware/duplicateDetection';
import { create360Sender } from '../services/wa360Sender';
import { resolve360DialogCredentials } from '../utils/360dialogCredentials';
import { logger } from '../utils/logger';

const router = express.Router();

// Initialize 360dialog sender with credential resolver
const sender360 = create360Sender(resolve360DialogCredentials);

// Rate limiting middleware - same as existing
const sendRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(sendRateLimit);

/**
 * Template Analysis Endpoint - Same interface as existing
 */
router.get('/template-info/:username/:templatename', async (req, res) => {
  try {
    const { username, templatename } = req.params;

    // Authenticate user and fetch credentials (360dialog version)
    const authResult = await authenticateAndFetchCredentials(username);
    if (!authResult.success) {
      return res.status(authResult.statusCode || 500).json({
        error: authResult.error,
        message: authResult.message
      });
    }

    const { userId } = authResult.data;

    // Fetch template (same as existing)
    const templateResult = await fetchTemplate(userId, templatename);
    if (!templateResult.success) {
      return res.status(templateResult.statusCode || 500).json({
        error: templateResult.error,
        message: templateResult.message
      });
    }

    const template = templateResult.data;
    const analysis = analyzeTemplate(template);

    res.json({
      success: true,
      template: {
        name: template.name,
        language: template.language,
        status: template.status
      },
      requirements: analysis
    });

  } catch (error) {
    logger.error('360dialog template analysis error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to analyze template'
    });
  }
});

/**
 * Main Send Endpoint - Compatible with existing API but using 360dialog
 * Supports both GET and POST requests with same parameter structure
 */
router.all('/', async (req, res) => {
  try {
    // Extract parameters from both GET and POST requests
    const params = extractParameters(req);
    
    // Validate required parameters
    const validation = validateRequiredParams(params);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Bad Request',
        message: validation.message,
        details: validation.details
      });
    }

    // Step 1: Authenticate user and fetch credentials (360dialog version)
    const authResult = await authenticateAndFetchCredentials(params.username);
    if (!authResult.success) {
      return res.status(authResult.statusCode || 500).json({
        error: authResult.error,
        message: authResult.message
      });
    }

    const { userId, businessInfo } = authResult.data;

    // Step 2: Fetch message template
    const templateResult = await fetchTemplate(userId, params.templatename);
    if (!templateResult.success) {
      return res.status(templateResult.statusCode || 500).json({
        error: templateResult.error,
        message: templateResult.message
      });
    }

    const template = templateResult.data;

    // Step 3: Validate recipient number
    if (!validatePhoneNumber(params.recipient_number)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid recipient phone number format',
        details: 'Phone number must be in WhatsApp format (country code + number, e.g., 919398424270 for India, 14155552345 for US)'
      });
    }

    // Step 4: Convert parameters to 360dialog format
    const components = convertParamsToComponents(params, template);

    // Step 4.5: DUPLICATE DETECTION - Same as existing
    const variables = extractVariablesFromParams(params);
    const duplicateCheck = await checkAndHandleDuplicate(
      userId,
      template.name,
      params.recipient_number,
      variables
    );
    
    if (duplicateCheck.isDuplicate) {
      logger.info(`❌ DUPLICATE DETECTED: 360dialog API call blocked for template ${template.name} to ${params.recipient_number}`);
      
      // Still deduct credits for duplicates as per requirement
      try {
        const templateCategory = template.category as TemplateCategory;
        const { cost } = await calculateCreditCost(userId, template.name, 1);
        
        await deductCredits({
          userId,
          amount: cost,
          transactionType: CreditTransactionType.DEDUCTION_DUPLICATE_BLOCKED,
          templateCategory,
          templateName: template.name,
          description: `Duplicate message blocked via 360dialog API - credits still deducted for ${params.recipient_number}`
        });
        
        logger.info(`[DUPLICATE DETECTION] Deducted ${cost} credits for blocked duplicate 360dialog API message`);
      } catch (creditError) {
        logger.error('[DUPLICATE DETECTION] Error deducting credits for duplicate 360dialog API call:', creditError);
      }
      
      return res.status(400).json({
        success: false,
        duplicate: true,
        message: 'Duplicate message blocked - same template and variables sent to this number within 5 minutes',
        template: template.name,
        phone: params.recipient_number,
        variables: variables,
        hash: duplicateCheck.hash
      });
    }

    // Step 5: Send message via 360dialog API
    const sendResult = await sender360.quickSendTemplate({
      userId,
      to: params.recipient_number,
      templateName: template.name,
      languageCode: template.language || 'en_US',
      components,
      timeoutMs: 30000
    });

    if (!sendResult.success) {
      // Map 360dialog errors to HTTP status codes
      const statusCode = sendResult.code === "INVALID_API_KEY" ? 502 : 
                        sendResult.code === "TEMPLATE_PARAM_MISMATCH" ? 400 :
                        sendResult.code === "RATE_LIMITED" ? 429 : 
                        sendResult.code === "RETRYABLE" ? 502 :
                        sendResult.status || 500;

      return res.status(statusCode).json({
        error: sendResult.code,
        message: getErrorMessage(sendResult.code),
        details: sendResult.details
      });
    }

    // Step 6: CREDIT DEDUCTION - Same as existing but for 360dialog
    try {
      const templateCategory = template.category as TemplateCategory;
      const { cost } = await calculateCreditCost(userId, template.name, 1);
      
      const creditResult = await deductCredits({
        userId,
        amount: cost,
        transactionType: CreditTransactionType.DEDUCTION_API_DELIVERED,
        templateCategory,
        templateName: template.name,
        messageId: sendResult.messageId,
        description: `360dialog API message sent successfully to ${params.recipient_number}`
      });
      
      if (!creditResult.success) {
        logger.warn(`[CREDIT SYSTEM] Failed to deduct credits for 360dialog API delivery: insufficient balance`);
      } else {
        logger.info(`[CREDIT SYSTEM] Deducted ${cost} credits for 360dialog API delivery. New balance: ${creditResult.newBalance}`);
      }
    } catch (creditError) {
      logger.error('Credit deduction error for 360dialog API delivery:', creditError);
    }

    // Step 7: Log successful send and return response
    await logMessageSend(userId, template.id, params.recipient_number, sendResult.messageId, template.name, businessInfo.channel_id);

    return res.status(200).json({
      success: true,
      message: 'Message sent successfully via 360dialog',
      message_id: sendResult.messageId,
      recipient: params.recipient_number,
      template: params.templatename,
      provider: '360dialog'
    });

  } catch (error) {
    logger.error('360dialog Send API Error:', error);
    
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while processing your request'
    });
  }
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Extract parameters - same as existing
 */
function extractParameters(req: express.Request): any {
  const isPost = req.method === 'POST';
  const source = isPost ? req.body : req.query;
  
  const params: any = {
    username: sanitizeInput(source.username),
    templatename: sanitizeInput(source.templatename),
    recipient_number: sanitizeInput(source.recipient_number),
    header_text: source.header_text ? sanitizeInput(source.header_text) : undefined,
    button_payload: source.button_payload ? sanitizeInput(source.button_payload) : undefined,
    button_text: source.button_text ? sanitizeInput(source.button_text) : undefined,
    button_url: source.button_url ? sanitizeInput(source.button_url) : undefined
  };

  const variables = extractVariables(source);
  Object.assign(params, variables);

  return params;
}

/**
 * Validate required parameters - same as existing
 */
function validateRequiredParams(params: any): { isValid: boolean; message?: string; details?: string[] } {
  const required = ['username', 'templatename', 'recipient_number'];
  const missing: string[] = [];
  
  for (const param of required) {
    if (!params[param] || typeof params[param] !== 'string' || params[param].trim() === '') {
      missing.push(param);
    }
  }
  
  if (missing.length > 0) {
    return {
      isValid: false,
      message: 'Missing required parameters',
      details: missing.map(param => `${param} is required`)
    };
  }
  
  return { isValid: true };
}

/**
 * Authenticate user and fetch 360dialog credentials
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
    
    // Validate required 360dialog info
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
        businessInfo: {
          channel_id: row.channel_id,
          api_key: row.api_key, // Will be used by credential resolver
          business_name: row.business_name
        }
      }
    };
    
  } catch (error) {
    logger.error('360dialog authentication error:', error);
    return {
      success: false,
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to authenticate user'
    };
  }
}

/**
 * Fetch template - same as existing
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
        template_id,
        header_media_id,
        header_type,
        media_id,
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
    logger.error('Template fetch error:', error);
    return {
      success: false,
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to fetch template'
    };
  }
}

/**
 * Convert parameters to 360dialog components format
 */
function convertParamsToComponents(params: any, template: any): any {
  const components: any = {};
  const templateComponents: any[] = template.components || [];

  // Handle header parameters
  const headerComponent = templateComponents.find((c: any) => c.type === 'HEADER');
  if (headerComponent) {
    if (headerComponent.format === 'TEXT' && params.header_text) {
      components.headerTextParam = params.header_text;
    } else if (headerComponent.format === 'IMAGE') {
      const mediaId = template.media_id || template.header_media_id;
      if (mediaId) {
        components.headerImageIdOrLink = mediaId;
      }
    }
  }

  // Handle body variables
  const vars = Object.keys(params)
    .filter(k => k.startsWith('var'))
    .sort((a, b) => {
      const numA = parseInt(a.slice(3)) || 0;
      const numB = parseInt(b.slice(3)) || 0;
      return numA - numB;
    })
    .map(k => params[k])
    .filter(v => v !== undefined && v !== null && v.toString().trim() !== '');

  if (vars.length > 0) {
    components.bodyParams = vars.map(v => v.toString());
  }

  // Handle button parameters
  if (params.button_url) {
    components.buttonUrlParam0 = params.button_url;
  }

  return components;
}

/**
 * Extract variables from parameters for duplicate detection - same as existing
 */
function extractVariablesFromParams(params: any): Record<string, string> {
  const variables: Record<string, string> = {};
  
  Object.keys(params).forEach(key => {
    if (key.startsWith('var') && params[key]) {
      variables[key] = params[key].toString();
    }
  });
  
  return variables;
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(code: string): string {
  switch (code) {
    case "INVALID_API_KEY":
      return "360dialog API authentication failed - invalid API key";
    case "TEMPLATE_PARAM_MISMATCH":
      return "Invalid template parameters or recipient number";
    case "RATE_LIMITED":
      return "Rate limit exceeded - please try again later";
    case "RETRYABLE":
      return "Temporary service error - please try again";
    case "BAD_REQUEST":
      return "Invalid request parameters";
    default:
      return "Failed to send message via 360dialog API";
  }
}

/**
 * Log successful message send - updated for 360dialog
 */
async function logMessageSend(userId: string, templateId: string, recipient: string, messageId: string, templateName: string, channelId?: string): Promise<void> {
  try {
    const cleanRecipient = recipient?.toString().trim();
    if (!cleanRecipient) {
      logger.error(`⚠️  360dialog API send attempted with empty recipient for template: ${templateName}`);
      return;
    }
    
    const campaignName = `API360_SEND_${templateName}_${Date.now()}`;
    
    const result = await pool.query(`
      INSERT INTO campaign_logs (
        user_id, campaign_name, template_used, phone_number_id, recipient_number, 
        message_id, status, total_recipients, successful_sends, failed_sends,
        sent_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'sent', 1, 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `, [userId, campaignName, templateName, channelId, cleanRecipient, messageId]);
    
    logger.info(`✅ Created campaign_logs entry for 360dialog API send: ${cleanRecipient} (messageId: ${messageId}, recordId: ${result.rows[0].id})`);
    
  } catch (error) {
    logger.error('❌ Failed to log 360dialog API message send:', error);
  }
}

/**
 * Analyze template - same as existing
 */
function analyzeTemplate(template: any): any {
  const components = template.components || [];
  const analysis: any = {
    required_params: ['username', 'templatename', 'recipient_number'],
    optional_params: [],
    variable_count: 0,
    has_header: false,
    header_type: null,
    has_buttons: false,
    button_types: [],
    provider: '360dialog',
    example_request: {
      method: 'POST',
      url: '/api/send360dialog',
      body: {
        username: 'your_username',
        templatename: template.name,
        recipient_number: '+1234567890'
      }
    }
  };

  // Analyze header
  const headerComponent = components.find((c: any) => c.type === 'HEADER');
  if (headerComponent) {
    analysis.has_header = true;
    analysis.header_type = headerComponent.format;
    
    if (headerComponent.format === 'TEXT') {
      analysis.optional_params.push({
        name: 'header_text',
        description: 'Text content for the header',
        required: false,
        example: 'Welcome Message'
      });
      analysis.example_request.body.header_text = 'Your header text here';
    }
  }

  // Analyze body variables
  const bodyComponent = components.find((c: any) => c.type === 'BODY');
  if (bodyComponent && bodyComponent.text) {
    const variableMatches = bodyComponent.text.match(/\{\{\d+\}\}/g);
    if (variableMatches) {
      analysis.variable_count = variableMatches.length;
      
      for (let i = 1; i <= analysis.variable_count; i++) {
        analysis.optional_params.push({
          name: `var${i}`,
          description: `Variable ${i} for template body`,
          required: true,
          example: `Value ${i}`
        });
        analysis.example_request.body[`var${i}`] = `Value ${i}`;
      }
    }
  }

  // Analyze buttons
  const buttonComponent = components.find((c: any) => c.type === 'BUTTONS');
  if (buttonComponent && buttonComponent.buttons) {
    analysis.has_buttons = true;
    
    buttonComponent.buttons.forEach((button: any, index: number) => {
      analysis.button_types.push({
        type: button.type,
        text: button.text,
        index: index
      });

      if (button.type === 'URL' && button.url && button.url.includes('{{1}}')) {
        analysis.optional_params.push({
          name: 'button_url',
          description: `Dynamic URL for button: "${button.text}"`,
          required: false,
          example: 'https://example.com/order/12345'
        });
        analysis.example_request.body.button_url = 'https://your-url.com/path';
      }
    });
  }

  return analysis;
}

export default router;