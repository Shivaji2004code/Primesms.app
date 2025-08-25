"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.forwardInboundToN8N = forwardInboundToN8N;
exports.validateForwardContext = validateForwardContext;
exports.createTestForwardContext = createTestForwardContext;
exports.createTestInboundEvent = createTestInboundEvent;
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
const N8N_TIMEOUT_MS = parseInt(process.env.N8N_TIMEOUT_MS || '5000', 10);
const N8N_MAX_RETRIES = parseInt(process.env.N8N_MAX_RETRIES || '3', 10);
function hmacSha256Hex(secret, body) {
    return crypto_1.default.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}
async function forwardInboundToN8N(ctx, event) {
    const userIdStr = typeof ctx.userId === 'number' ? ctx.userId.toString() : ctx.userId;
    try {
        console.log(`📤 [N8N_FORWARDER] Preparing to forward inbound message to n8n for user ${userIdStr}`);
        const bodyObj = {
            source: 'whatsapp',
            event: 'message_in',
            tenant: {
                userId: userIdStr,
                wabaId: ctx.wabaId || null,
                phoneNumberId: ctx.phoneNumberId
            },
            ...event.payload,
            receivedAt: new Date().toISOString()
        };
        const body = JSON.stringify(bodyObj);
        const headers = {
            'Content-Type': 'application/json',
            'X-Prime-UserId': userIdStr,
            'X-Prime-PhoneNumberId': ctx.phoneNumberId,
            'X-Prime-Event': 'message_in',
            'User-Agent': 'PrimeSMS-n8n-Forwarder/1.0'
        };
        if (ctx.webhookVerifyToken && ctx.webhookVerifyToken.trim() !== '') {
            const signature = hmacSha256Hex(ctx.webhookVerifyToken, body);
            headers['X-PrimeSig'] = `sha256=${signature}`;
            console.log(`🔐 [N8N_FORWARDER] Added HMAC signature for user ${userIdStr}`);
        }
        else {
            console.log(`ℹ️  [N8N_FORWARDER] No webhook verify token configured for user ${userIdStr}, proceeding without signature`);
        }
        console.log(`📋 [N8N_FORWARDER] Payload preview for user ${userIdStr}:`, {
            source: bodyObj.source,
            event: bodyObj.event,
            tenant: bodyObj.tenant,
            messageType: bodyObj.message?.type || 'unknown',
            from: bodyObj.message?.from || 'unknown',
            textPreview: bodyObj.message?.text ? bodyObj.message.text.substring(0, 50) + '...' : 'no text',
            receivedAt: bodyObj.receivedAt
        });
        await forwardWithRetry(ctx.webhookUrl, body, headers, userIdStr);
        console.log(`✅ [N8N_FORWARDER] Successfully forwarded inbound message to n8n for user ${userIdStr}`);
    }
    catch (error) {
        console.error(`❌ [N8N_FORWARDER] Critical error forwarding inbound message for user ${userIdStr}:`, {
            error: error instanceof Error ? error.message : String(error),
            webhookUrl: ctx.webhookUrl,
            phoneNumberId: ctx.phoneNumberId
        });
    }
}
async function forwardWithRetry(webhookUrl, body, headers, userId) {
    let attempt = 0;
    let delay = 500;
    while (attempt < N8N_MAX_RETRIES) {
        try {
            attempt++;
            console.log(`🔄 [N8N_FORWARDER] Attempt ${attempt}/${N8N_MAX_RETRIES} to forward to n8n for user ${userId}`);
            const response = await axios_1.default.post(webhookUrl, body, {
                headers,
                timeout: N8N_TIMEOUT_MS,
                maxRedirects: 0
            });
            console.log(`✅ [N8N_FORWARDER] n8n responded with status ${response.status} for user ${userId}`);
            if (response.data) {
                const responsePreview = typeof response.data === 'string'
                    ? response.data.substring(0, 200)
                    : JSON.stringify(response.data).substring(0, 200);
                console.log(`📥 [N8N_FORWARDER] n8n response preview: ${responsePreview}${responsePreview.length >= 200 ? '...' : ''}`);
            }
            return;
        }
        catch (err) {
            const status = err?.response?.status;
            const isNetworkError = !status;
            const isServerError = status && status >= 500 && status <= 599;
            const isTimeout = err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT';
            const retriable = isNetworkError || isServerError || isTimeout;
            console.log(`⚠️  [N8N_FORWARDER] Attempt ${attempt} failed for user ${userId}:`, {
                status,
                error: err?.response?.data ?
                    (typeof err.response.data === 'string' ? err.response.data.substring(0, 200) : JSON.stringify(err.response.data).substring(0, 200)) :
                    err?.message || String(err),
                retriable,
                isNetworkError,
                isServerError,
                isTimeout
            });
            if (!retriable || attempt >= N8N_MAX_RETRIES) {
                console.error(`❌ [N8N_FORWARDER] Failed to forward to n8n for user ${userId} after ${attempt} attempts:`, {
                    finalStatus: status,
                    finalError: err?.response?.data || err?.message || String(err),
                    webhookUrl: webhookUrl.substring(0, 50) + '...'
                });
                return;
            }
            if (attempt < N8N_MAX_RETRIES) {
                console.log(`⏳ [N8N_FORWARDER] Waiting ${delay}ms before retry ${attempt + 1} for user ${userId}`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay = Math.min(delay * 2, 5000);
            }
        }
    }
}
function validateForwardContext(ctx) {
    const errors = [];
    const userIdStr = typeof ctx.userId === 'number' ? ctx.userId.toString() : ctx.userId;
    if (!userIdStr || typeof userIdStr !== 'string' || userIdStr.trim() === '') {
        errors.push('userId is required and must be a non-empty string or number');
    }
    if (!ctx.phoneNumberId || typeof ctx.phoneNumberId !== 'string' || ctx.phoneNumberId.trim() === '') {
        errors.push('phoneNumberId is required and must be a non-empty string');
    }
    if (!ctx.webhookUrl || typeof ctx.webhookUrl !== 'string' || ctx.webhookUrl.trim() === '') {
        errors.push('webhookUrl is required and must be a non-empty string');
    }
    if (ctx.webhookUrl && ctx.webhookUrl.trim() !== '') {
        try {
            const url = new URL(ctx.webhookUrl);
            if (!['http:', 'https:'].includes(url.protocol)) {
                errors.push('webhookUrl must use http or https protocol');
            }
        }
        catch (e) {
            errors.push('webhookUrl must be a valid URL');
        }
    }
    return {
        isValid: errors.length === 0,
        errors
    };
}
function createTestForwardContext(userId = 'test_user', webhookUrl = 'https://n8n.example.com/webhook/test', phoneNumberId = 'test_phone_123') {
    return {
        userId,
        phoneNumberId,
        webhookUrl,
        webhookVerifyToken: 'test_secret',
        wabaId: 'test_waba_123'
    };
}
function createTestInboundEvent(from = '15550001111', text = 'Hello from test') {
    return {
        kind: 'message_in',
        payload: {
            message: {
                wamid: `wamid.test.${Date.now()}`,
                from,
                to: '15551234567',
                type: 'text',
                text,
                interactive: null
            },
            raw: {
                messaging_product: 'whatsapp',
                metadata: {
                    display_phone_number: '15551234567',
                    phone_number_id: 'test_phone_123'
                },
                contacts: [{ profile: { name: 'Test User' }, wa_id: from }],
                messages: [{
                        from,
                        id: `wamid.test.${Date.now()}`,
                        timestamp: Math.floor(Date.now() / 1000).toString(),
                        type: 'text',
                        text: { body: text }
                    }]
            }
        }
    };
}
//# sourceMappingURL=n8nForwarder.js.map