// WhatsApp 360dialog Sender Service - Production Ready
// Handles quick send and bulk send with concurrency, retries, and proper error handling
import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from '../utils/logger';
import { Router } from 'express';

// ==================== TYPES ====================

export interface TemplateComponents {
  bodyParams?: string[];                  // body parameters in order
  headerImageIdOrLink?: string;           // if present, add header image (prefer id; link alternative)
  headerTextParam?: string;               // optional header text
  buttonUrlParam0?: string;               // dynamic URL button param index 0
  buttonUrlParam1?: string;               // dynamic URL button param index 1
}

export interface QuickSendInput {
  userId: string;                         // whose 360dialog API key to use
  to: string;                             // phone (E.164 or digits)
  templateName: string;
  languageCode: string;                   // "en_US" or "en"
  components?: TemplateComponents;
  timeoutMs?: number;                     // optional override
}

export interface BulkSendInput extends Omit<QuickSendInput, "to"> {
  toList: string[];                       // recipients list
  concurrency?: number;                   // default 10
  maxAttempts?: number;                   // default 4 (only for retryable errors)
}

export type SendSuccess = { 
  success: true; 
  messageId: string; 
  raw: any 
};

export type SendFailure = { 
  success: false; 
  code: "INVALID_API_KEY" | "TEMPLATE_PARAM_MISMATCH" | "RATE_LIMITED" | "RETRYABLE" | "BAD_REQUEST" | "UNKNOWN"; 
  status?: number; 
  details?: any 
};

export type SendResult = SendSuccess | SendFailure;

export interface BulkSendResult {
  total: number;
  succeeded: number;
  failed: number;
  results: Array<{ to: string } & SendResult>;
}

// Credential resolver type - injected dependency
export type Resolve360Credentials = (userId: string) => Promise<{ apiKey: string }>;

// ==================== UTILITIES ====================

/**
 * Convert phone number to digits-only format for wa_id
 */
function normalizePhoneNumber(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, "");
  if (digitsOnly.length < 7 || digitsOnly.length > 15) {
    throw new Error(`Invalid phone number: ${phone} (must be 7-15 digits)`);
  }
  return digitsOnly;
}

/**
 * Sleep utility for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff with jitter
 */
function calculateBackoff(attempt: number, baseMs: number = 250): number {
  const exponential = baseMs * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * 100); // 0-100ms jitter
  return Math.min(2000, exponential + jitter); // cap at 2 seconds
}

/**
 * Build 360dialog Cloud API payload from components
 */
function buildTemplatePayload(
  to: string,
  templateName: string,
  languageCode: string,
  components?: TemplateComponents
): any {
  const payload: any = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizePhoneNumber(to),
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: []
    }
  };

  if (!components) {
    return payload;
  }

  const templateComponents: any[] = [];

  // 1. Handle Header Component
  if (components.headerImageIdOrLink) {
    const imageParam = components.headerImageIdOrLink.startsWith('http') 
      ? { link: components.headerImageIdOrLink }
      : { id: components.headerImageIdOrLink };
    
    templateComponents.push({
      type: "header",
      parameters: [{
        type: "image",
        image: imageParam
      }]
    });
  } else if (components.headerTextParam) {
    templateComponents.push({
      type: "header",
      parameters: [{
        type: "text",
        text: components.headerTextParam
      }]
    });
  }

  // 2. Handle Body Parameters
  if (components.bodyParams && components.bodyParams.length > 0) {
    templateComponents.push({
      type: "body",
      parameters: components.bodyParams.map(param => ({
        type: "text",
        text: param
      }))
    });
  }

  // 3. Handle Button Parameters
  if (components.buttonUrlParam0) {
    templateComponents.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{
        type: "text",
        text: components.buttonUrlParam0
      }]
    });
  }

  if (components.buttonUrlParam1) {
    templateComponents.push({
      type: "button",
      sub_type: "url",
      index: "1",
      parameters: [{
        type: "text",
        text: components.buttonUrlParam1
      }]
    });
  }

  payload.template.components = templateComponents;
  return payload;
}

/**
 * Create axios instance for 360dialog API
 */
function create360DialogClient(apiKey: string, timeoutMs: number = 15000): AxiosInstance {
  return axios.create({
    baseURL: "https://waba-v2.360dialog.io",
    timeout: timeoutMs,
    headers: {
      'Content-Type': 'application/json',
      'D360-API-KEY': apiKey
    }
  });
}

/**
 * Map axios error to normalized error response
 */
function mapAxiosError(error: AxiosError, to: string): SendFailure {
  const response = error.response;
  const status = response?.status;

  // Redact headers for logging (security)
  const redactedError = {
    message: error.message,
    code: error.code,
    status,
    data: response?.data
  };

  logger.error('[360DIALOG] API error', { to, error: redactedError });

  // Map status codes to error types
  if (status === 401 || status === 403) {
    return {
      success: false,
      code: "INVALID_API_KEY",
      status,
      details: response?.data
    };
  }

  if (status === 400) {
    // Check if it's a template parameter issue
    const errorData = response?.data;
    const isTemplateError = errorData && (
      JSON.stringify(errorData).toLowerCase().includes('template') ||
      JSON.stringify(errorData).toLowerCase().includes('parameter') ||
      JSON.stringify(errorData).toLowerCase().includes('component')
    );

    return {
      success: false,
      code: isTemplateError ? "TEMPLATE_PARAM_MISMATCH" : "BAD_REQUEST",
      status,
      details: errorData
    };
  }

  if (status === 429) {
    return {
      success: false,
      code: "RATE_LIMITED",
      status,
      details: response?.data
    };
  }

  if (status && status >= 500) {
    return {
      success: false,
      code: "RETRYABLE",
      status,
      details: response?.data
    };
  }

  // Network errors (timeout, connection refused, etc.)
  if (!status && (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED')) {
    return {
      success: false,
      code: "RETRYABLE",
      details: { message: error.message, code: error.code }
    };
  }

  // Unknown error
  return {
    success: false,
    code: "UNKNOWN",
    status,
    details: response?.data || { message: error.message }
  };
}

/**
 * Check if error is retryable
 */
function isRetryableError(result: SendFailure): boolean {
  return result.code === "RATE_LIMITED" || result.code === "RETRYABLE";
}

// ==================== CORE FUNCTIONS ====================

/**
 * Send single template message via 360dialog
 */
async function quickSendTemplate(
  input: QuickSendInput,
  resolveCredentials: Resolve360Credentials
): Promise<SendResult> {
  try {
    // 1. Get API credentials
    const { apiKey } = await resolveCredentials(input.userId);
    if (!apiKey || apiKey.trim().length === 0) {
      return {
        success: false,
        code: "INVALID_API_KEY",
        details: { message: "No API key found for user" }
      };
    }

    // 2. Build payload
    const payload = buildTemplatePayload(
      input.to,
      input.templateName,
      input.languageCode,
      input.components
    );

    // 3. Create client and send
    const client = create360DialogClient(apiKey, input.timeoutMs || 15000);
    const response = await client.post('/messages', payload);

    // 4. Parse success response
    if (response.status === 200 && response.data.messages && response.data.messages[0]) {
      const messageId = response.data.messages[0].id;
      return {
        success: true,
        messageId,
        raw: response.data
      };
    } else {
      throw new Error('Unexpected response format from 360dialog API');
    }

  } catch (error) {
    if (axios.isAxiosError(error)) {
      return mapAxiosError(error, input.to);
    }
    
    logger.error('[360DIALOG] Unexpected error in quickSendTemplate', {
      to: input.to,
      templateName: input.templateName,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      success: false,
      code: "UNKNOWN",
      details: { message: error instanceof Error ? error.message : String(error) }
    };
  }
}

/**
 * Send template to multiple recipients with controlled concurrency and retries
 */
async function bulkSendTemplate(
  input: BulkSendInput,
  resolveCredentials: Resolve360Credentials
): Promise<BulkSendResult> {
  const {
    toList,
    concurrency = 10,
    maxAttempts = 4,
    ...baseInput
  } = input;

  const results: Array<{ to: string } & SendResult> = [];
  let succeeded = 0;
  let failed = 0;

  // Process recipients in batches with concurrency control
  const processRecipient = async (to: string): Promise<void> => {
    let attempt = 0;
    let lastResult: SendResult | undefined;

    while (attempt < maxAttempts) {
      attempt++;

      // Send individual message
      const result = await quickSendTemplate({
        ...baseInput,
        to
      }, resolveCredentials);

      lastResult = result;

      // If successful, record and return
      if (result.success) {
        results.push({ to, ...result });
        succeeded++;
        return;
      }

      // If not retryable or max attempts reached, fail
      if (!isRetryableError(result) || attempt >= maxAttempts) {
        results.push({ to, ...result });
        failed++;
        return;
      }

      // Calculate backoff and retry
      const backoffMs = calculateBackoff(attempt - 1);
      
      logger.warn('[360DIALOG] Retrying bulk send', {
        to,
        attempt,
        maxAttempts,
        backoffMs,
        code: result.code,
        status: result.status
      });

      await sleep(backoffMs);
    }

    // This shouldn't be reached, but just in case
    if (lastResult) {
      results.push({ to, ...lastResult });
      failed++;
    } else {
      // Fallback if no result was captured
      results.push({ 
        to, 
        success: false, 
        code: "UNKNOWN", 
        details: { message: "No result captured" } 
      });
      failed++;
    }
  };

  // Process all recipients with concurrency limit
  const semaphore = new Array(concurrency).fill(null);
  const recipientQueue = [...toList];

  const processNext = async (): Promise<void> => {
    const to = recipientQueue.shift();
    if (!to) return;

    await processRecipient(to);
    
    // Continue processing if more recipients
    if (recipientQueue.length > 0) {
      await processNext();
    }
  };

  // Start initial batch
  await Promise.all(semaphore.map(() => processNext()));

  // Sort results to match input order
  const sortedResults = toList.map(to => {
    const result = results.find(r => r.to === to);
    if (!result) {
      // This shouldn't happen, but handle gracefully
      return {
        to,
        success: false as const,
        code: "UNKNOWN" as const,
        details: { message: "Result not found" }
      };
    }
    return result;
  });

  return {
    total: toList.length,
    succeeded,
    failed,
    results: sortedResults
  };
}

// ==================== FACTORY FUNCTION ====================

/**
 * Create 360dialog sender with injected credential resolver
 */
export function create360Sender(resolveCredentials: Resolve360Credentials) {
  return {
    quickSendTemplate: (input: QuickSendInput) => quickSendTemplate(input, resolveCredentials),
    bulkSendTemplate: (input: BulkSendInput) => bulkSendTemplate(input, resolveCredentials),
    
    // Optional Express router factory
    expressRouter: (mountPath?: string) => createExpressRouter(resolveCredentials, mountPath)
  };
}

// ==================== EXPRESS ROUTER (OPTIONAL) ====================

/**
 * Create Express router with 360dialog send endpoints
 */
function createExpressRouter(resolveCredentials: Resolve360Credentials, mountPath?: string): Router {
  const router = Router();

  // POST /quick-send - Send single template message
  router.post('/quick-send', async (req, res) => {
    try {
      const {
        userId,
        to,
        templateName,
        languageCode,
        components,
        timeoutMs
      } = req.body;

      // Basic validation
      if (!userId || !to || !templateName || !languageCode) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: userId, to, templateName, languageCode"
        });
      }

      const input: QuickSendInput = {
        userId,
        to,
        templateName,
        languageCode,
        components,
        timeoutMs
      };

      const result = await quickSendTemplate(input, resolveCredentials);

      if (result.success) {
        res.status(200).json({
          success: true,
          messageId: result.messageId,
          to: input.to,
          template: input.templateName
        });
      } else {
        const statusCode = result.code === "INVALID_API_KEY" ? 401 : 
                          result.code === "TEMPLATE_PARAM_MISMATCH" ? 400 :
                          result.code === "RATE_LIMITED" ? 429 : 
                          result.status || 500;

        res.status(statusCode).json({
          success: false,
          error: result.code,
          details: result.details
        });
      }

    } catch (error) {
      logger.error('[360DIALOG] Express quick-send error', {
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json({
        success: false,
        error: "INTERNAL_ERROR",
        message: "An unexpected error occurred"
      });
    }
  });

  // POST /bulk-send - Send template to multiple recipients
  router.post('/bulk-send', async (req, res) => {
    try {
      const {
        userId,
        toList,
        templateName,
        languageCode,
        components,
        concurrency,
        maxAttempts,
        timeoutMs
      } = req.body;

      // Basic validation
      if (!userId || !Array.isArray(toList) || !templateName || !languageCode) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: userId, toList (array), templateName, languageCode"
        });
      }

      if (toList.length === 0) {
        return res.status(400).json({
          success: false,
          error: "toList cannot be empty"
        });
      }

      if (toList.length > 1000) {
        return res.status(400).json({
          success: false,
          error: "toList cannot exceed 1000 recipients"
        });
      }

      const input: BulkSendInput = {
        userId,
        toList,
        templateName,
        languageCode,
        components,
        concurrency,
        maxAttempts,
        timeoutMs
      };

      const result = await bulkSendTemplate(input, resolveCredentials);

      res.status(200).json({
        success: true,
        summary: {
          total: result.total,
          succeeded: result.succeeded,
          failed: result.failed
        },
        results: result.results.map(r => ({
          to: r.to,
          success: r.success,
          messageId: r.success ? r.messageId : undefined,
          error: !r.success ? {
            code: r.code,
            status: r.status,
            details: r.details
          } : undefined
        }))
      });

    } catch (error) {
      logger.error('[360DIALOG] Express bulk-send error', {
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json({
        success: false,
        error: "INTERNAL_ERROR",
        message: "An unexpected error occurred"
      });
    }
  });

  return router;
}

// ==================== EXAMPLES ====================

/*
// Example 1: Quick send with one body param
const sender = create360Sender(async (userId) => {
  const result = await pool.query('SELECT api_key FROM user_business_info WHERE user_id = $1 AND provider = $2', [userId, '360dialog']);
  return { apiKey: result.rows[0]?.api_key };
});

const quickResult = await sender.quickSendTemplate({
  userId: "123",
  to: "+1234567890",
  templateName: "welcome_message",
  languageCode: "en_US",
  components: {
    bodyParams: ["John Doe"]
  }
});
console.log(quickResult); // { success: true, messageId: "wamid.xxx", raw: {...} }

// Example 2: Quick send with header image (media id)
const quickWithHeaderResult = await sender.quickSendTemplate({
  userId: "123",
  to: "+1234567890", 
  templateName: "promo_image",
  languageCode: "en",
  components: {
    headerImageIdOrLink: "media_id_12345", // or "https://example.com/image.jpg"
    bodyParams: ["Special Offer", "50% off"]
  }
});

// Example 3: Bulk send to 3 numbers, concurrency 2
const bulkResult = await sender.bulkSendTemplate({
  userId: "123",
  toList: ["+1234567890", "+0987654321", "+1122334455"],
  templateName: "newsletter",
  languageCode: "en_US",
  components: {
    bodyParams: ["Weekly Update"]
  },
  concurrency: 2,
  maxAttempts: 3
});
console.log(bulkResult);
// {
//   total: 3,
//   succeeded: 2, 
//   failed: 1,
//   results: [
//     { to: "+1234567890", success: true, messageId: "wamid.xxx" },
//     { to: "+0987654321", success: false, code: "RATE_LIMITED", status: 429 },
//     { to: "+1122334455", success: true, messageId: "wamid.yyy" }
//   ]
// }
*/