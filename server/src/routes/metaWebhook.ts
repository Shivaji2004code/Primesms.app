// [Claude AI] Meta WhatsApp Webhook Implementation — Aug 2025
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import pool from '../db';
import { createProcessors } from '../services/waProcessors';
import { sseHub } from '../services/sseBroadcaster';
import { processWebhookForN8n } from '../services/n8nWebhookProcessor';

type AnyObj = Record<string, any>;

declare global {
  namespace Express {
    interface Request { rawBody?: Buffer; }
  }
}

// Use existing UserBusinessInfo interface from types
import { UserBusinessInfo } from '../types';

// ====== DATABASE QUERIES for user_business_info table ======
async function getUserBusinessInfo(userId: string): Promise<UserBusinessInfo> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM user_business_info WHERE user_id = $1 AND is_active = true LIMIT 1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`No active business info found for user ${userId}`);
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      businessName: row.business_name,
      whatsappNumber: row.whatsapp_number,
      whatsappNumberId: row.whatsapp_number_id,
      wabaId: row.waba_id,
      accessToken: row.access_token,
      webhookUrl: row.webhook_url,
      webhookVerifyToken: row.webhook_verify_token,
      isActive: row.is_active,
      appId: row.app_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  } finally {
    client.release();
  }
}

async function lookupByPhoneNumberId(phoneNumberId: string): Promise<UserBusinessInfo | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM user_business_info WHERE whatsapp_number_id = $1 AND is_active = true LIMIT 1',
      [phoneNumberId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      businessName: row.business_name,
      whatsappNumber: row.whatsapp_number,
      whatsappNumberId: row.whatsapp_number_id,
      wabaId: row.waba_id,
      accessToken: row.access_token,
      webhookUrl: row.webhook_url,
      webhookVerifyToken: row.webhook_verify_token,
      isActive: row.is_active,
      appId: row.app_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  } finally {
    client.release();
  }
}

// ====== WEBHOOK EVENT PROCESSORS ======
async function processIncomingMessages(ubi: UserBusinessInfo, messages: any[]): Promise<void> {
  try {
    console.log(`📥 [WEBHOOK] Processing ${messages.length} incoming message(s) for user ${ubi.userId}`);
    
    for (const message of messages) {
      const { from, id, timestamp, type } = message;
      const text = message.text?.body || message.interactive?.button_reply?.title || '';
      
      console.log(`📥 [WEBHOOK] Incoming message: ${type} from ${from} - "${text}"`);
      
      // TODO: Implement your incoming message handling logic here
      // Examples:
      // - Store in database for customer support
      // - Trigger auto-replies
      // - Update conversation threads
      // - Send notifications to business users
      
      // For now, just log the structured message data
      console.log(`📥 [WEBHOOK] Message details:`, {
        messageId: id,
        from,
        type,
        text: text.substring(0, 100), // Truncate for logging
        timestamp: new Date(parseInt(timestamp) * 1000).toISOString(),
        phoneNumberId: ubi.whatsappNumberId
      });
    }
  } catch (error) {
    console.error('❌ [WEBHOOK] Error processing incoming messages:', error);
  }
}

async function processStatusUpdates(ubi: UserBusinessInfo, statuses: any[]): Promise<void> {
  const client = await pool.connect();
  try {
    console.log(`📊 [WEBHOOK] Processing ${statuses.length} status update(s) for user ${ubi.userId}`);
    
    for (const status of statuses) {
      const { id, status: statusValue, timestamp, recipient_id } = status;
      
      console.log(`📊 [WEBHOOK] Status update: message ${id} -> ${statusValue} for ${recipient_id}`);
      
      // Update campaign_logs table directly (no more message_logs)
      if (statusValue && id) {
        let updateQuery = '';
        let timestampValue = new Date(parseInt(timestamp) * 1000);
        
        // Build update query based on status
        if (statusValue === 'sent') {
          updateQuery = `
            UPDATE campaign_logs 
            SET status = $1, sent_at = COALESCE(sent_at, $2), updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $3 AND message_id = $4`;
        } else if (statusValue === 'delivered') {
          updateQuery = `
            UPDATE campaign_logs 
            SET status = $1, delivered_at = COALESCE(delivered_at, $2), updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $3 AND message_id = $4`;
        } else if (statusValue === 'read') {
          updateQuery = `
            UPDATE campaign_logs 
            SET status = $1, read_at = COALESCE(read_at, $2), updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $3 AND message_id = $4`;
        } else if (statusValue === 'failed') {
          const errorMessage = status.errors?.[0]?.title || status.error?.message || 'Delivery failed';
          updateQuery = `
            UPDATE campaign_logs 
            SET status = 'failed', error_message = $5, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $3 AND message_id = $4`;
        }
        
        if (updateQuery) {
          const params = statusValue === 'failed' 
            ? [statusValue, timestampValue, ubi.userId, id, status.errors?.[0]?.title || 'Delivery failed']
            : [statusValue, timestampValue, ubi.userId, id];
            
          const updateResult = await client.query(updateQuery, params);
          
          if (updateResult.rowCount && updateResult.rowCount > 0) {
            console.log(`✅ [WEBHOOK] Updated campaign status: ${id} -> ${statusValue} for user ${ubi.userId}`);
          } else {
            console.log(`⚠️  [WEBHOOK] No campaign found for message ID: ${id} user ${ubi.userId}`);
            
            // Create campaign_logs entry if webhook arrives before send confirmation
            if (statusValue !== 'failed') {
              await client.query(`
                INSERT INTO campaign_logs (
                  user_id, message_id, recipient_number, status, campaign_name, 
                  template_used, sent_at, delivered_at, read_at, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, 'webhook_only', 'unknown', 
                  ${statusValue === 'sent' ? '$5' : 'NULL'}, 
                  ${statusValue === 'delivered' ? '$5' : 'NULL'},
                  ${statusValue === 'read' ? '$5' : 'NULL'},
                  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, message_id) DO UPDATE SET
                  status = $4,
                  ${statusValue === 'sent' ? 'sent_at = COALESCE(campaign_logs.sent_at, $5),' : ''}
                  ${statusValue === 'delivered' ? 'delivered_at = COALESCE(campaign_logs.delivered_at, $5),' : ''}
                  ${statusValue === 'read' ? 'read_at = COALESCE(campaign_logs.read_at, $5),' : ''}
                  updated_at = CURRENT_TIMESTAMP
              `, [ubi.userId, id, recipient_id, statusValue, timestampValue]);
              
              console.log(`🔄 [WEBHOOK] Created campaign entry from webhook: ${id}`);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ [WEBHOOK] Error processing status updates:', error);
  } finally {
    client.release();
  }
}

// ====== INITIALIZE PROCESSORS ======

// Create processors instance with SSE broadcaster
const waProcessors = createProcessors({
  emitReport: (userId: string, payload: any) => sseHub.emitReport(userId, payload),
  emitTemplate: (userId: string, payload: any) => sseHub.emitTemplate(userId, payload)
});

console.log('✅ [WEBHOOK] WhatsApp processors initialized with SSE broadcasting');

// ===============================================================================

const metaWebhookRouter = Router();

// ====== In-memory log with simple rate-limit for debug endpoints ======
interface WebhookLogItem {
  ts: string;
  summary: string;
  headers: AnyObj;
  body: AnyObj;
  phoneNumberId?: string;
  userId?: string;
}

const LOG_MAX = 200;
const ring: WebhookLogItem[] = [];

function pushLog(item: WebhookLogItem) {
  ring.push(item);
  if (ring.length > LOG_MAX) ring.shift();
}

const rlMap = new Map<string, { count: number; ts: number }>();
function rateLimitOK(key: string, maxPerMin = 60) {
  const now = Date.now();
  const win = 60_000;
  const rec = rlMap.get(key) || { count: 0, ts: now };
  if (now - rec.ts > win) { rec.count = 0; rec.ts = now; }
  rec.count++;
  rlMap.set(key, rec);
  return rec.count <= maxPerMin;
}

// ====== Helpers ======
function env(name: string, required = true): string {
  const v = process.env[name];
  if (required && !v) throw new Error(`Missing env: ${name}`);
  return v || '';
}

function constantTimeEqual(a: string, b: string): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

function verifyMetaSignature(req: Request): boolean {
  // Skip signature verification ONLY in development mode for testing
  const isDev = process.env.NODE_ENV === 'development';
  const skip = isDev && (process.env.META_SKIP_SIGNATURE_VERIFY || '').toLowerCase() === 'true';
  
  if (skip) {
    console.log('🔓 [WEBHOOK] DEV MODE: Signature verification SKIPPED (META_SKIP_SIGNATURE_VERIFY=true)');
    return true;
  }
  
  const appSecret = env('META_APP_SECRET', true);
  const hdr = req.header('x-hub-signature-256') || req.header('X-Hub-Signature-256');
  
  if (!hdr || !hdr.startsWith('sha256=')) {
    console.log('❌ [WEBHOOK] Missing or invalid signature header');
    return false;
  }
  
  if (!req.rawBody) {
    console.log('❌ [WEBHOOK] No raw body available for signature verification');
    return false;
  }
  
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex');
  const isValid = constantTimeEqual(hdr, expected);
  
  if (!isValid) {
    console.log('❌ [WEBHOOK] Signature verification failed');
  } else {
    console.log('✅ [WEBHOOK] Signature verification passed');
  }
  
  return isValid;
}

function summarize(body: AnyObj): string {
  try {
    const change = body?.entry?.[0]?.changes?.[0];
    const field = change?.field;
    const val = change?.value;
    const pni = val?.metadata?.phone_number_id;
    
    if (Array.isArray(val?.messages) && val.messages[0]) {
      const m = val.messages[0];
      const from = m.from;
      const id = m.id;
      const type = m.type;
      const text = m.text?.body ?? 
                   m.interactive?.button_reply?.title ?? 
                   m.interactive?.list_reply?.title ?? 
                   '';
      return `field=${field} pni=${pni} msg from=${from} id=${id} type=${type} text="${text}"`;
    }
    
    if (Array.isArray(val?.statuses) && val.statuses[0]) {
      const s = val.statuses[0];
      return `field=${field} pni=${pni} status id=${s.id} status=${s.status} ts=${s.timestamp}`;
    }
    
    if (val?.message_template_id || field === 'message_template_status_update') {
      return `field=${field} template update`;
    }
    
    return `field=${field} (unparsed)`;
  } catch {
    return 'unparsed';
  }
}

// ====== Routes ======

// GET /webhooks/meta - Meta verification handshake
metaWebhookRouter.get('/meta', (req, res) => {
  try {
    console.log('🔍 [WEBHOOK] GET /meta - Verification handshake attempt');
    
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    const verifyToken = env('META_VERIFY_TOKEN', true);
    
    console.log('🔍 [WEBHOOK] Verification request:', {
      mode,
      tokenProvided: !!token,
      challengeProvided: !!challenge,
      tokensMatch: token === verifyToken
    });
    
    if (mode === 'subscribe' && token === verifyToken && challenge) {
      console.log('✅ [WEBHOOK] Verification successful, returning challenge');
      res.status(200).send(String(challenge));
    } else {
      console.log('❌ [WEBHOOK] Verification failed');
      res.sendStatus(403);
    }
  } catch (e) {
    console.error('❌ [WEBHOOK] Verification error:', e);
    res.sendStatus(500);
  }
});

// POST /webhooks/meta - Receive webhook events
metaWebhookRouter.post('/meta', async (req, res) => {
  try {
    console.log('📩 [WEBHOOK] POST /meta - Received webhook event');
    
    // Verify signature first
    if (!verifyMetaSignature(req)) {
      console.log('❌ [WEBHOOK] Signature verification failed');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    const body = req.body as AnyObj;
    console.log('✅ [WEBHOOK] Signature verified, processing event');
    
    // Always reply fast (within 20 seconds per Meta requirement)
    res.status(200).json({ received: true });
    
    // Try to map tenant from phone_number_id in payload
    const pni = body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id as string | undefined;
    let ubi: UserBusinessInfo | undefined;
    
    if (pni) {
      try {
        ubi = await lookupByPhoneNumberId(pni) ?? undefined;
        if (ubi) {
          console.log(`📱 [WEBHOOK] Mapped phone_number_id ${pni} to user ${ubi.userId}`);
        } else {
          console.log(`⚠️  [WEBHOOK] Could not map phone_number_id ${pni} to any user`);
        }
      } catch (e) {
        console.error(`❌ [WEBHOOK] Error looking up phone_number_id ${pni}:`, e);
      }
    }
    
    const logItem: WebhookLogItem = {
      ts: new Date().toISOString(),
      summary: summarize(body),
      headers: {
        'user-agent': req.header('user-agent'),
        'x-hub-signature-256': req.header('x-hub-signature-256'),
      },
      body,
      phoneNumberId: pni,
      userId: ubi?.userId,
    };
    
    pushLog(logItem);
    console.log(`📝 [WEBHOOK] Logged event: ${logItem.summary}`);
    
    // Process webhook events asynchronously using enhanced processors
    setImmediate(async () => {
      try {
        // Use new processors for template updates and message statuses
        await waProcessors.processWebhook(body);
        
        // 📤 NEW: Forward inbound WhatsApp messages to n8n webhooks
        try {
          const n8nStats = await processWebhookForN8n(body, lookupByPhoneNumberId, {
            enabled: true,
            logLevel: 'minimal' // Use 'detailed' for debugging
          });
          
          if (n8nStats.inboundMessages > 0) {
            console.log(`📤 [WEBHOOK] n8n forwarding stats:`, {
              inbound: n8nStats.inboundMessages,
              forwarded: n8nStats.forwardedToN8n,
              errors: n8nStats.errors
            });
          }
        } catch (n8nError) {
          console.error('❌ [WEBHOOK] Error in n8n forwarding (non-blocking):', n8nError);
          // Don't throw - we don't want n8n issues to break webhook processing
        }
        
        // Keep existing message processing for customer replies (if needed)
        if (ubi && body?.entry?.[0]?.changes?.[0]?.value) {
          const changeValue = body.entry[0].changes[0].value;
          
          // Handle incoming messages (customer replies) - existing functionality
          if (Array.isArray(changeValue.messages) && changeValue.messages.length > 0) {
            await processIncomingMessages(ubi, changeValue.messages);
          }
          
          // Note: Message status updates are now handled by waProcessors.processWebhook()
          // but we can keep the existing processStatusUpdates for backward compatibility
          if (Array.isArray(changeValue.statuses) && changeValue.statuses.length > 0) {
            await processStatusUpdates(ubi, changeValue.statuses);
          }
        }
      } catch (error) {
        console.error('❌ [WEBHOOK] Error in async processing:', error);
        // Don't throw - webhook already returned 200
      }
    });
    
  } catch (e) {
    console.error('❌ [WEBHOOK] Event processing error:', e);
    if (!res.headersSent) {
      res.sendStatus(500);
    }
  }
});

// GET /webhooks/meta/debug/log - View recent webhook events
metaWebhookRouter.get('/meta/debug/log', (req, res) => {
  const auth = req.header('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  
  if (!token || token !== env('WEBHOOK_DEBUG_TOKEN', true)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const ip = req.ip || 'unknown';
  if (!rateLimitOK(`log:${ip}`, 120)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  
  const limit = Math.max(1, Math.min(200, parseInt(String(req.query.limit ?? '50'), 10) || 50));
  const items = ring.slice(-limit);
  
  console.log(`🐛 [WEBHOOK] Debug log accessed by ${ip}, returning ${items.length} items`);
  
  res.json({ 
    count: items.length, 
    maxCapacity: LOG_MAX,
    items 
  });
});

// GET /webhooks/meta/health/subscribed-apps?userId=... - Check webhook subscription health
metaWebhookRouter.get('/meta/health/subscribed-apps', async (req, res) => {
  const auth = req.header('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  
  if (!token || token !== env('WEBHOOK_DEBUG_TOKEN', true)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const userId = String(req.query.userId || '');
    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter is required' });
    }
    
    console.log(`🏥 [WEBHOOK] Health check for user ${userId}`);
    
    const ubi = await getUserBusinessInfo(userId);
    
    if (!ubi.wabaId || !ubi.accessToken) {
      return res.status(400).json({ 
        error: 'User business info incomplete',
        missing: {
          wabaId: !ubi.wabaId,
          accessToken: !ubi.accessToken
        }
      });
    }
    
    const version = process.env.GRAPH_API_VERSION || 'v22.0';
    const url = `https://graph.facebook.com/${version}/${ubi.wabaId}/subscribed_apps`;
    
    console.log(`🔍 [WEBHOOK] Checking subscribed apps for WABA ${ubi.wabaId}`);
    
    const r = await axios.get(url, {
      headers: { Authorization: `Bearer ${ubi.accessToken}` },
      timeout: 10000
    });
    
    console.log(`✅ [WEBHOOK] Successfully retrieved subscribed apps for user ${userId}`);
    
    res.json({
      userId,
      wabaId: ubi.wabaId,
      subscribed: r.data
    });
    
  } catch (e: any) {
    console.error('❌ [WEBHOOK] Subscribed apps health check error:', e?.response?.data || e?.message);
    res.status(400).json({ 
      error: 'Graph API error', 
      detail: e?.response?.data || String(e?.message || e) 
    });
  }
});

// POST /webhooks/meta/self-test/send - Send a test message to trigger status webhooks
metaWebhookRouter.post('/meta/self-test/send', async (req, res) => {
  const auth = req.header('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  
  if (!token || token !== env('WEBHOOK_DEBUG_TOKEN', true)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const { userId, to } = req.body || {};
    
    if (!userId || !to) {
      return res.status(400).json({ error: 'userId and to fields are required in request body' });
    }
    
    console.log(`🧪 [WEBHOOK] Self-test send for user ${userId} to ${to}`);
    
    const ubi = await getUserBusinessInfo(String(userId));
    
    if (!ubi.whatsappNumberId || !ubi.accessToken) {
      return res.status(400).json({ 
        error: 'User business info incomplete',
        missing: {
          whatsappNumberId: !ubi.whatsappNumberId,
          accessToken: !ubi.accessToken
        }
      });
    }
    
    const version = process.env.GRAPH_API_VERSION || 'v22.0';
    const url = `https://graph.facebook.com/${version}/${ubi.whatsappNumberId}/messages`;
    
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: String(to),
      type: 'text',
      text: { 
        preview_url: false, 
        body: '🧪 Prime SMS self-test: webhook verification message' 
      },
    };
    
    console.log(`📤 [WEBHOOK] Sending test message via phone number ${ubi.whatsappNumberId}`);
    
    const r = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${ubi.accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000
    });
    
    const messageId = r.data?.messages?.[0]?.id || null;
    
    console.log(`✅ [WEBHOOK] Self-test message sent successfully, message ID: ${messageId}`);
    
    res.json({ 
      success: true, 
      messageId,
      instruction: `Watch /webhooks/meta/debug/log for status updates for message ID: ${messageId}`,
      raw: r.data 
    });
    
  } catch (e: any) {
    console.error('❌ [WEBHOOK] Self-test send error:', e?.response?.data || e?.message);
    res.status(400).json({ 
      success: false, 
      error: e?.response?.data || String(e?.message || e) 
    });
  }
});

export default metaWebhookRouter;