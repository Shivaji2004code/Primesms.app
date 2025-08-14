"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
const db_1 = __importDefault(require("../db"));
const waProcessors_1 = require("../services/waProcessors");
const sseBroadcaster_1 = require("../services/sseBroadcaster");
const n8nWebhookProcessor_1 = require("../services/n8nWebhookProcessor");
async function getUserBusinessInfo(userId) {
    const client = await db_1.default.connect();
    try {
        const result = await client.query('SELECT * FROM user_business_info WHERE user_id = $1 AND is_active = true LIMIT 1', [userId]);
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
            appSecret: row.app_secret,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
    finally {
        client.release();
    }
}
async function lookupByPhoneNumberId(phoneNumberId) {
    const client = await db_1.default.connect();
    try {
        const result = await client.query('SELECT * FROM user_business_info WHERE whatsapp_number_id = $1 AND is_active = true LIMIT 1', [phoneNumberId]);
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
            appSecret: row.app_secret,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
    finally {
        client.release();
    }
}
async function lookupByTemplateName(templateName) {
    const client = await db_1.default.connect();
    try {
        const templateResult = await client.query('SELECT user_id FROM templates WHERE name = $1 AND status = $2 LIMIT 1', [templateName, 'PENDING']);
        if (templateResult.rows.length === 0) {
            console.log(`🔍 [WEBHOOK] No pending template found with name: ${templateName}`);
            return null;
        }
        const userId = templateResult.rows[0].user_id;
        console.log(`🔍 [WEBHOOK] Found template ${templateName} belongs to user ${userId}`);
        const businessResult = await client.query('SELECT * FROM user_business_info WHERE user_id = $1 AND is_active = true LIMIT 1', [userId]);
        if (businessResult.rows.length === 0) {
            console.log(`🔍 [WEBHOOK] No active business info found for user ${userId}`);
            return null;
        }
        const row = businessResult.rows[0];
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
            appSecret: row.app_secret,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
    finally {
        client.release();
    }
}
async function processIncomingMessages(ubi, messages) {
    try {
        console.log(`📥 [WEBHOOK] Processing ${messages.length} incoming message(s) for user ${ubi.userId}`);
        for (const message of messages) {
            const { from, id, timestamp, type } = message;
            const text = message.text?.body || message.interactive?.button_reply?.title || '';
            console.log(`📥 [WEBHOOK] Incoming message: ${type} from ${from} - "${text}"`);
            console.log(`📥 [WEBHOOK] Message details:`, {
                messageId: id,
                from,
                type,
                text: text.substring(0, 100),
                timestamp: new Date(parseInt(timestamp) * 1000).toISOString(),
                phoneNumberId: ubi.whatsappNumberId
            });
        }
    }
    catch (error) {
        console.error('❌ [WEBHOOK] Error processing incoming messages:', error);
    }
}
async function processStatusUpdates(ubi, statuses) {
    const client = await db_1.default.connect();
    try {
        console.log(`📊 [WEBHOOK] Processing ${statuses.length} status update(s) for user ${ubi.userId}`);
        for (const status of statuses) {
            const { id, status: statusValue, timestamp, recipient_id } = status;
            console.log(`📊 [WEBHOOK] Status update: message ${id} -> ${statusValue} for ${recipient_id}`);
            if (statusValue && id) {
                let updateQuery = '';
                let timestampValue = new Date(parseInt(timestamp) * 1000);
                let errorMessage = '';
                if (statusValue === 'sent') {
                    updateQuery = `
            UPDATE campaign_logs 
            SET status = $1, sent_at = COALESCE(sent_at, $2), updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $3 AND message_id = $4`;
                }
                else if (statusValue === 'delivered') {
                    updateQuery = `
            UPDATE campaign_logs 
            SET status = $1, delivered_at = COALESCE(delivered_at, $2), updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $3 AND message_id = $4`;
                }
                else if (statusValue === 'read') {
                    updateQuery = `
            UPDATE campaign_logs 
            SET status = $1, read_at = COALESCE(read_at, $2), updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $3 AND message_id = $4`;
                }
                else if (statusValue === 'failed') {
                    errorMessage = 'Delivery failed';
                    if (status.errors && Array.isArray(status.errors) && status.errors.length > 0) {
                        const error = status.errors[0];
                        const code = error.code || 'Unknown';
                        const title = error.title || 'Unknown Error';
                        const details = error.details || '';
                        errorMessage = `${code}: ${title}${details ? ' - ' + details : ''}`;
                    }
                    else if (status.error) {
                        const code = status.error.code || 'Unknown';
                        const message = status.error.message || status.error.title || 'Unknown Error';
                        errorMessage = `${code}: ${message}`;
                    }
                    console.log(`❌ [WEBHOOK] Message ${id} failed with error: ${errorMessage}`);
                    updateQuery = `
            UPDATE campaign_logs 
            SET status = 'failed', error_message = $5, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $3 AND message_id = $4`;
                }
                if (updateQuery) {
                    const params = statusValue === 'failed'
                        ? [statusValue, timestampValue, ubi.userId, id, errorMessage]
                        : [statusValue, timestampValue, ubi.userId, id];
                    const updateResult = await client.query(updateQuery, params);
                    if (updateResult.rowCount && updateResult.rowCount > 0) {
                        console.log(`✅ [WEBHOOK] Updated campaign status: ${id} -> ${statusValue} for user ${ubi.userId}`);
                    }
                    else {
                        console.log(`⚠️  [WEBHOOK] No campaign found for message ID: ${id} user ${ubi.userId}`);
                        if (statusValue === 'failed') {
                            await client.query(`
                INSERT INTO campaign_logs (
                  user_id, message_id, recipient_number, status, campaign_name, 
                  template_used, error_message, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, 'webhook_only', 'unknown', $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, message_id) DO UPDATE SET
                  status = $4,
                  error_message = $5,
                  updated_at = CURRENT_TIMESTAMP
              `, [ubi.userId, id, recipient_id, statusValue, errorMessage]);
                            console.log(`🔄 [WEBHOOK] Created failed campaign entry from webhook: ${id} - ${errorMessage}`);
                        }
                        else {
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
    }
    catch (error) {
        console.error('❌ [WEBHOOK] Error processing status updates:', error);
    }
    finally {
        client.release();
    }
}
const waProcessors = (0, waProcessors_1.createProcessors)({
    emitReport: (userId, payload) => sseBroadcaster_1.sseHub.emitReport(userId, payload),
    emitTemplate: (userId, payload) => sseBroadcaster_1.sseHub.emitTemplate(userId, payload)
});
console.log('✅ [WEBHOOK] WhatsApp processors initialized with SSE broadcasting');
const metaWebhookRouter = (0, express_1.Router)();
const LOG_MAX = 200;
const ring = [];
function pushLog(item) {
    ring.push(item);
    if (ring.length > LOG_MAX)
        ring.shift();
}
const rlMap = new Map();
function rateLimitOK(key, maxPerMin = 60) {
    const now = Date.now();
    const win = 60000;
    const rec = rlMap.get(key) || { count: 0, ts: now };
    if (now - rec.ts > win) {
        rec.count = 0;
        rec.ts = now;
    }
    rec.count++;
    rlMap.set(key, rec);
    return rec.count <= maxPerMin;
}
function env(name, required = true) {
    const v = process.env[name];
    if (required && !v)
        throw new Error(`Missing env: ${name}`);
    return v || '';
}
function constantTimeEqual(a, b) {
    const A = Buffer.from(a);
    const B = Buffer.from(b);
    return A.length === B.length && crypto_1.default.timingSafeEqual(A, B);
}
async function verifyMetaSignature(req, ubi) {
    const isDev = process.env.NODE_ENV === 'development';
    const skip = isDev && (process.env.META_SKIP_SIGNATURE_VERIFY || '').toLowerCase() === 'true';
    if (skip) {
        console.log('🔓 [WEBHOOK] DEV MODE: Signature verification SKIPPED (META_SKIP_SIGNATURE_VERIFY=true)');
        return true;
    }
    const hdr = req.header('x-hub-signature-256') || req.header('X-Hub-Signature-256');
    console.log('🔍 [WEBHOOK] DEBUG: Signature header received:', hdr ? `${hdr.substring(0, 20)}...` : 'MISSING');
    console.log('🔍 [WEBHOOK] DEBUG: Raw body length:', req.rawBody ? req.rawBody.length : 'NO RAW BODY');
    console.log('🔍 [WEBHOOK] DEBUG: User business info available:', ubi ? `userId=${ubi.userId}, hasAppSecret=${!!ubi.appSecret}` : 'NO UBI');
    if (!hdr || !hdr.startsWith('sha256=')) {
        console.log('❌ [WEBHOOK] Missing or invalid signature header:', hdr);
        return false;
    }
    if (!req.rawBody) {
        console.log('❌ [WEBHOOK] No raw body available for signature verification');
        console.log('🔍 [WEBHOOK] DEBUG: Request body type:', typeof req.body, 'length:', JSON.stringify(req.body).length);
        return false;
    }
    if (ubi && ubi.appSecret) {
        console.log(`🔍 [WEBHOOK] DEBUG: Trying user ${ubi.userId} app secret (length: ${ubi.appSecret.length})`);
        const expected = 'sha256=' + crypto_1.default.createHmac('sha256', ubi.appSecret).update(req.rawBody).digest('hex');
        const isValid = constantTimeEqual(hdr, expected);
        console.log(`🔍 [WEBHOOK] DEBUG: User signature - Expected: ${expected.substring(0, 20)}..., Received: ${hdr.substring(0, 20)}...`);
        if (isValid) {
            console.log(`✅ [WEBHOOK] Signature verification passed for user ${ubi.userId}`);
            return true;
        }
        else {
            console.log(`❌ [WEBHOOK] Signature verification failed for user ${ubi.userId} with their app secret`);
        }
    }
    else if (ubi) {
        console.log(`⚠️ [WEBHOOK] User ${ubi.userId} found but no app secret configured`);
    }
    else {
        console.log('🔍 [WEBHOOK] DEBUG: No user business info found, will try global app secret only');
    }
    const globalAppSecrets = [
        env('META_APP_SECRET', false),
        env('META_APP_SECRET_2', false)
    ].filter(Boolean);
    if (globalAppSecrets.length > 0) {
        console.log(`🔍 [WEBHOOK] DEBUG: Trying ${globalAppSecrets.length} global app secret(s)`);
        for (let i = 0; i < globalAppSecrets.length; i++) {
            const secret = globalAppSecrets[i];
            const secretLabel = i === 0 ? 'META_APP_SECRET' : `META_APP_SECRET_${i + 1}`;
            console.log(`🔍 [WEBHOOK] DEBUG: Trying ${secretLabel} (length: ${secret.length})`);
            const expected = 'sha256=' + crypto_1.default.createHmac('sha256', secret).update(req.rawBody).digest('hex');
            const isValid = constantTimeEqual(hdr, expected);
            console.log(`🔍 [WEBHOOK] DEBUG: ${secretLabel} signature - Expected: ${expected.substring(0, 20)}..., Received: ${hdr.substring(0, 20)}...`);
            if (isValid) {
                console.log(`✅ [WEBHOOK] Signature verification passed with ${secretLabel}`);
                return true;
            }
            else {
                console.log(`❌ [WEBHOOK] Signature verification failed with ${secretLabel}`);
            }
        }
    }
    else {
        console.log('⚠️ [WEBHOOK] No global app secret environment variables found (META_APP_SECRET, META_APP_SECRET_2)');
    }
    console.log('❌ [WEBHOOK] Signature verification failed - no valid app secret found');
    return false;
}
function summarize(body) {
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
            const templateName = val?.message_template_name || 'unknown';
            const event = val?.event || 'unknown';
            return `field=${field} template=${templateName} event=${event}`;
        }
        return `field=${field} (unparsed)`;
    }
    catch {
        return 'unparsed';
    }
}
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
        }
        else {
            console.log('❌ [WEBHOOK] Verification failed');
            res.sendStatus(403);
        }
    }
    catch (e) {
        console.error('❌ [WEBHOOK] Verification error:', e);
        res.sendStatus(500);
    }
});
metaWebhookRouter.post('/meta', async (req, res) => {
    try {
        console.log('📩 [WEBHOOK] POST /meta - Received webhook event');
        const body = req.body;
        const change = body?.entry?.[0]?.changes?.[0];
        const field = change?.field;
        const value = change?.value;
        const pni = value?.metadata?.phone_number_id;
        const templateName = value?.message_template_name;
        let ubi;
        console.log('🔍 [WEBHOOK] DEBUG: Webhook details:', JSON.stringify({
            field: field || 'missing',
            phone_number_id: pni || 'NOT FOUND',
            template_name: templateName || 'NOT FOUND',
            payload_structure: {
                entry: body?.entry ? `Array(${body.entry.length})` : 'missing',
                changes: body?.entry?.[0]?.changes ? `Array(${body.entry[0].changes.length})` : 'missing',
                value: body?.entry?.[0]?.changes?.[0]?.value ? 'present' : 'missing',
                metadata: body?.entry?.[0]?.changes?.[0]?.value?.metadata ? 'present' : 'missing'
            }
        }));
        if (field === 'message_template_status_update' && templateName) {
            try {
                console.log(`🔍 [WEBHOOK] DEBUG: Template webhook - looking up template: ${templateName}`);
                ubi = await lookupByTemplateName(templateName) ?? undefined;
                if (ubi) {
                    console.log(`📋 [WEBHOOK] Mapped template ${templateName} to user ${ubi.userId} (app_secret: ${ubi.appSecret ? 'PRESENT' : 'MISSING'})`);
                }
                else {
                    console.log(`⚠️  [WEBHOOK] Could not map template ${templateName} to any user - check templates table`);
                }
            }
            catch (e) {
                console.error(`❌ [WEBHOOK] Error looking up template ${templateName}:`, e);
            }
        }
        else if (pni) {
            try {
                console.log(`🔍 [WEBHOOK] DEBUG: Message webhook - looking up phone_number_id: ${pni}`);
                ubi = await lookupByPhoneNumberId(pni) ?? undefined;
                if (ubi) {
                    console.log(`📱 [WEBHOOK] Mapped phone_number_id ${pni} to user ${ubi.userId} (app_secret: ${ubi.appSecret ? 'PRESENT' : 'MISSING'})`);
                }
                else {
                    console.log(`⚠️  [WEBHOOK] Could not map phone_number_id ${pni} to any user - check user_business_info table`);
                }
            }
            catch (e) {
                console.error(`❌ [WEBHOOK] Error looking up phone_number_id ${pni}:`, e);
            }
        }
        else {
            console.log('⚠️  [WEBHOOK] No phone_number_id or template_name found in webhook payload - cannot lookup user business info');
        }
        if (!(await verifyMetaSignature(req, ubi))) {
            console.log('❌ [WEBHOOK] Signature verification failed');
            return res.status(401).json({ error: 'Invalid signature' });
        }
        console.log('✅ [WEBHOOK] Signature verified, processing event');
        res.status(200).json({ received: true });
        const logItem = {
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
        setImmediate(async () => {
            try {
                await waProcessors.processWebhook(body);
                try {
                    console.log('🔄 [WEBHOOK] Starting n8n forwarding process...');
                    const n8nStats = await (0, n8nWebhookProcessor_1.processWebhookForN8n)(body, lookupByPhoneNumberId, {
                        enabled: true,
                        logLevel: 'detailed'
                    });
                    console.log(`📤 [WEBHOOK] n8n forwarding stats:`, {
                        inbound: n8nStats.inboundMessages,
                        forwarded: n8nStats.forwardedToN8n,
                        errors: n8nStats.errors,
                        totalEntries: n8nStats.totalEntries,
                        processedChanges: n8nStats.processedChanges
                    });
                }
                catch (n8nError) {
                    console.error('❌ [WEBHOOK] Error in n8n forwarding (non-blocking):', n8nError);
                }
                if (ubi && body?.entry?.[0]?.changes?.[0]?.value) {
                    const changeValue = body.entry[0].changes[0].value;
                    if (Array.isArray(changeValue.messages) && changeValue.messages.length > 0) {
                        await processIncomingMessages(ubi, changeValue.messages);
                    }
                    if (Array.isArray(changeValue.statuses) && changeValue.statuses.length > 0) {
                        await processStatusUpdates(ubi, changeValue.statuses);
                    }
                }
            }
            catch (error) {
                console.error('❌ [WEBHOOK] Error in async processing:', error);
            }
        });
    }
    catch (e) {
        console.error('❌ [WEBHOOK] Event processing error:', e);
        if (!res.headersSent) {
            res.sendStatus(500);
        }
    }
});
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
        const r = await axios_1.default.get(url, {
            headers: { Authorization: `Bearer ${ubi.accessToken}` },
            timeout: 10000
        });
        console.log(`✅ [WEBHOOK] Successfully retrieved subscribed apps for user ${userId}`);
        res.json({
            userId,
            wabaId: ubi.wabaId,
            subscribed: r.data
        });
    }
    catch (e) {
        console.error('❌ [WEBHOOK] Subscribed apps health check error:', e?.response?.data || e?.message);
        res.status(400).json({
            error: 'Graph API error',
            detail: e?.response?.data || String(e?.message || e)
        });
    }
});
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
        const r = await axios_1.default.post(url, payload, {
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
    }
    catch (e) {
        console.error('❌ [WEBHOOK] Self-test send error:', e?.response?.data || e?.message);
        res.status(400).json({
            success: false,
            error: e?.response?.data || String(e?.message || e)
        });
    }
});
exports.default = metaWebhookRouter;
//# sourceMappingURL=metaWebhook.js.map