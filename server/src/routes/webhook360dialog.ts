// 360dialog WhatsApp Webhook Receiver - Production Ready
import { Router, Request, Response } from 'express';
import express from 'express';

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
      
      // TODO: Add your business logic here
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

console.log('🚀 [360DIALOG] Webhook router created successfully');

export default webhook360dialogRouter;