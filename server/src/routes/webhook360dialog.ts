// 360dialog WhatsApp Webhook Receiver - Production Ready
import { Router, Request, Response } from 'express';
import express from 'express';
import { templatesRepo } from '../repos/templatesRepo';
import { resolve360DialogCredentials } from '../utils/360dialogCredentials';
import { normalize360DialogStatus } from '../services/wa360Templates';
import { sseHub } from '../services/sseBroadcaster';
import { pool } from '../db';

type AnyObj = Record<string, any>;

interface DebugEvent {
  ts: string;
  ip: string | undefined;
  auth: "ok" | "skipped" | "failed";
  headers: AnyObj;
  raw: string;
  summary: {
    object?: string;
    hasEntry?: boolean;
    messages?: number;
    statuses?: number;
    errors?: number;
  };
}

// Configuration
const WEBHOOK_RING_SIZE = Number(process.env.WEBHOOK_RING_SIZE || 200);
const BASIC_USER = process.env.D360_WEBHOOK_BASIC_USER || "";
const BASIC_PASS = process.env.D360_WEBHOOK_BASIC_PASS || "";

const requireAuth = Boolean(BASIC_USER && BASIC_PASS);
const expectedAuthHeader = requireAuth
  ? "Basic " + Buffer.from(`${BASIC_USER}:${BASIC_PASS}`).toString("base64")
  : null;

console.log(`🔧 [360DIALOG] Webhook configuration:`);
console.log(`   Ring buffer size: ${WEBHOOK_RING_SIZE}`);
console.log(`   Basic Auth: ${requireAuth ? 'ENABLED' : 'DISABLED'}`);

// In-memory ring buffer for recent events
const recent: DebugEvent[] = [];

function pushEvent(e: DebugEvent) {
  recent.push(e);
  if (recent.length > WEBHOOK_RING_SIZE) recent.shift();
}

function summarizePayload(payload: any): DebugEvent['summary'] {
  try {
    if (!payload || typeof payload !== "object") return {};
    
    const object = payload.object;
    const entry = Array.isArray(payload.entry) ? payload.entry : [];
    const firstChange = entry?.[0]?.changes?.[0]?.value ?? {};
    
    const messages = Array.isArray(firstChange.messages) ? firstChange.messages.length : 0;
    const statuses = Array.isArray(firstChange.statuses) ? firstChange.statuses.length : 0;
    const errors = Array.isArray(firstChange.errors) ? firstChange.errors.length : 0;

    return {
      object,
      hasEntry: entry.length > 0,
      messages,
      statuses,
      errors
    };
  } catch {
    return {};
  }
}

// Create the router
const webhook360dialogRouter = Router();

// Capture raw body for signature verification (if needed in future)
const rawJson = express.raw({ type: "application/json" });

// GET /webhooks/360dialog - Health check and optional Meta-style verification
webhook360dialogRouter.get('/360dialog', (req: Request, res: Response) => {
  console.log('🔍 [360DIALOG] GET /360dialog - Health check');
  
  // Optional Meta-style hub challenge (not required by 360dialog but useful for compatibility)
  const mode = req.query["hub.mode"];
  const challenge = req.query["hub.challenge"];
  
  if (mode === "subscribe" && typeof challenge === "string") {
    console.log('✅ [360DIALOG] Hub challenge verification successful');
    return res.status(200).send(challenge);
  }
  
  console.log('✅ [360DIALOG] Health check successful');
  res.status(200).send("360dialog webhook operational");
});

// POST /webhooks/360dialog - Main webhook receiver
webhook360dialogRouter.post('/360dialog', express.json(), async (req: Request, res: Response) => {
  const started = Date.now();
  const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";

  console.log(`📥 [360DIALOG] Webhook received from IP: ${ip}`);

  // Optional Basic Auth check
  let authStatus: DebugEvent["auth"] = "skipped";
  if (requireAuth) {
    authStatus = req.headers.authorization === expectedAuthHeader ? "ok" : "failed";
    if (authStatus === "failed") {
      console.log(`❌ [360DIALOG] Basic Auth failed from IP: ${ip}`);
      // Still return 200 to avoid retries, but log the failure
      // Change to res.status(401) if you want strict rejection
    } else {
      console.log(`✅ [360DIALOG] Basic Auth successful from IP: ${ip}`);
    }
  }

  // Get the JSON payload (already parsed by express.json())
  const payload = req.body;
  const raw = JSON.stringify(payload, null, 2);

  const summary = summarizePayload(payload);
  const duration = Date.now() - started;

  // Rich console logging for immediate verification
  console.log(`📊 [360DIALOG] Event processed:`, {
    ts: new Date().toISOString(),
    ip,
    auth: authStatus,
    duration_ms: duration,
    summary,
    payload_keys: payload ? Object.keys(payload).join(',') : 'none'
  });

  // Store in memory ring buffer for debug endpoint
  pushEvent({
    ts: new Date().toISOString(),
    ip,
    auth: authStatus,
    headers: req.headers as AnyObj,
    raw,
    summary
  });

  // CRITICAL: Always ACK with 200 OK ASAP (360dialog requirement)
  res.status(200).send("OK");

  // ======================================================================
  // ASYNC PROCESSING AREA - All heavy work happens here (non-blocking)
  // ======================================================================
  setImmediate(async () => {
    try {
      if (!payload) {
        console.log('⚠️ [360DIALOG] No payload to process (JSON parse failed)');
        return;
      }

      // Log detailed payload structure for debugging
      if (payload.object === "whatsapp_business_account" && Array.isArray(payload.entry)) {
        for (const entry of payload.entry) {
          const entryId = entry.id;
          console.log(`📋 [360DIALOG] Processing entry ID: ${entryId}`);
          
          if (Array.isArray(entry.changes)) {
            for (const change of entry.changes) {
              const field = change.field;
              const value = change.value;
              
              console.log(`🔄 [360DIALOG] Processing change: field=${field}`);
              
              // Handle incoming messages
              if (field === "messages" && Array.isArray(value.messages)) {
                console.log(`📥 [360DIALOG] Processing ${value.messages.length} message(s)`);
                for (const message of value.messages) {
                  console.log(`📨 [360DIALOG] Message:`, {
                    id: message.id,
                    from: message.from,
                    type: message.type,
                    timestamp: message.timestamp,
                    text: message.text?.body?.substring(0, 100) || 'N/A'
                  });
                }
              }
              
              // Handle status updates  
              if (field === "messages" && Array.isArray(value.statuses)) {
                console.log(`📊 [360DIALOG] Processing ${value.statuses.length} status update(s)`);
                for (const status of value.statuses) {
                  console.log(`📈 [360DIALOG] Status:`, {
                    id: status.id,
                    status: status.status,
                    timestamp: status.timestamp,
                    recipient_id: status.recipient_id
                  });
                }
              }
              
              // Handle errors
              if (field === "messages" && Array.isArray(value.errors)) {
                console.log(`❌ [360DIALOG] Processing ${value.errors.length} error(s)`);
                for (const error of value.errors) {
                  console.log(`🚫 [360DIALOG] Error:`, {
                    code: error.code,
                    title: error.title,
                    message: error.message,
                    details: error.details
                  });
                }
              }
            }
          }
        }
      }
      
      // Handle template status updates from 360dialog
      await processTemplateStatusUpdates(payload);
      
      // TODO: Add additional business logic here
      // Examples:
      // - Store messages in database
      // - Update message delivery status
      // - Trigger notifications
      // - Forward to other systems
      // - Process customer replies
      
      console.log(`✅ [360DIALOG] Async processing completed for payload with object: ${payload.object}`);
      
    } catch (error) {
      console.error('❌ [360DIALOG] Error in async processing:', error);
      // Don't throw - webhook already returned 200
    }
  });
});

// GET /webhooks/360dialog/debug/recent - Debug endpoint to view recent events
webhook360dialogRouter.get('/360dialog/debug/recent', (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit || 50), WEBHOOK_RING_SIZE);
  const data = recent.slice(-limit).reverse(); // Most recent first
  
  console.log(`🐛 [360DIALOG] Debug endpoint accessed, returning ${data.length} events`);
  
  res.status(200).json({ 
    count: data.length,
    maxCapacity: WEBHOOK_RING_SIZE,
    configuration: {
      basicAuth: requireAuth,
      ringSize: WEBHOOK_RING_SIZE
    },
    data 
  });
});

/**
 * Process template status updates from 360dialog webhook
 */
async function processTemplateStatusUpdates(payload: any): Promise<void> {
  try {
    if (!payload || typeof payload !== 'object') {
      return;
    }

    // Check if this is a template status update webhook
    // 360dialog sends template updates in different formats, we need to handle:
    // 1. Direct template status updates
    // 2. Template approval/rejection notifications
    if (payload.object === 'whatsapp_business_account' && Array.isArray(payload.entry)) {
      for (const entry of payload.entry) {
        if (Array.isArray(entry.changes)) {
          for (const change of entry.changes) {
            // Handle template status changes
            if (change.field === 'message_template_status_update' || change.field === 'template_status_update') {
              await handleTemplateStatusChange(change.value);
            }
            // Handle other template-related changes
            else if (change.field === 'message_template_quality_update') {
              await handleTemplateQualityUpdate(change.value);
            }
          }
        }
      }
    }
    
    // Handle direct template webhook format (if 360dialog sends it differently)
    else if (payload.template || payload.message_template) {
      const template = payload.template || payload.message_template;
      await handleTemplateStatusChange(template);
    }

  } catch (error) {
    console.error('❌ [360DIALOG] Error processing template status updates:', error);
  }
}

/**
 * Handle individual template status change
 */
async function handleTemplateStatusChange(templateData: any): Promise<void> {
  try {
    if (!templateData || !templateData.name) {
      console.log('⚠️ [360DIALOG] Invalid template data in webhook, skipping');
      return;
    }

    const {
      name,
      language = 'en_US',
      status,
      category,
      reason,
      rejected_reason,
      id,
      namespace
    } = templateData;

    const normalizedStatus = normalize360DialogStatus(status);
    const rejectionReason = rejected_reason || reason;

    console.log(`📝 [360DIALOG] Processing template status update:`, {
      name,
      language,
      status: normalizedStatus,
      category,
      reason: rejectionReason,
      id,
      namespace
    });

    // Find which user owns this template by checking our database
    const existingTemplates = await pool.query(
      'SELECT user_id FROM templates WHERE name = $1 AND language = $2 LIMIT 1',
      [name, language]
    );

    if (existingTemplates.rows.length === 0) {
      console.log(`⚠️ [360DIALOG] Template ${name} (${language}) not found in our database, skipping update`);
      return;
    }

    const userId = existingTemplates.rows[0].user_id;

    // Update template status in database
    await templatesRepo.upsertStatusAndCategory({
      userId,
      name,
      language,
      status: normalizedStatus,
      category: category?.toUpperCase(),
      reason: rejectionReason,
      reviewedAt: new Date()
    });

    console.log(`✅ [360DIALOG] Updated template ${name} (${language}) status to ${normalizedStatus} for user ${userId}`);

    // Emit SSE event to notify the frontend
    sseHub.emitTemplate(userId, {
      type: 'template_update',
      name,
      language,
      status: normalizedStatus,
      category: category?.toUpperCase() || null,
      reason: rejectionReason || null,
      at: new Date().toISOString(),
      source: '360dialog_webhook'
    });

    console.log(`📡 [360DIALOG] SSE event emitted for template ${name} status change`);

  } catch (error) {
    console.error('❌ [360DIALOG] Error handling template status change:', error);
  }
}

/**
 * Handle template quality score updates
 */
async function handleTemplateQualityUpdate(qualityData: any): Promise<void> {
  try {
    if (!qualityData || !qualityData.name) {
      return;
    }

    const {
      name,
      language = 'en_US',
      quality_score
    } = qualityData;

    console.log(`⭐ [360DIALOG] Processing template quality update:`, {
      name,
      language,
      quality_score
    });

    // Update quality score in database if we have the template
    const existingTemplates = await pool.query(
      'SELECT user_id FROM templates WHERE name = $1 AND language = $2 LIMIT 1',
      [name, language]
    );

    if (existingTemplates.rows.length > 0) {
      const userId = existingTemplates.rows[0].user_id;
      
      await pool.query(
        'UPDATE templates SET quality_rating = $1, updated_at = CURRENT_TIMESTAMP WHERE name = $2 AND language = $3 AND user_id = $4',
        [quality_score?.score?.toUpperCase() || null, name, language, userId]
      );

      console.log(`✅ [360DIALOG] Updated quality score for template ${name} (${language})`);
    }

  } catch (error) {
    console.error('❌ [360DIALOG] Error handling template quality update:', error);
  }
}

console.log('🚀 [360DIALOG] Webhook router created successfully');

export default webhook360dialogRouter;