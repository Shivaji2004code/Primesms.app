"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.N8nWebhookProcessor = void 0;
exports.createN8nWebhookProcessor = createN8nWebhookProcessor;
exports.processWebhookForN8n = processWebhookForN8n;
exports.createTestUserBusinessInfo = createTestUserBusinessInfo;
exports.createTestLookupFunction = createTestLookupFunction;
const n8nForwarder_1 = require("./n8nForwarder");
const waToN8nInboundMapper_1 = require("./waToN8nInboundMapper");
class N8nWebhookProcessor {
    constructor(config = {}) {
        this.config = {
            enabled: config.enabled ?? true,
            logLevel: config.logLevel ?? 'minimal',
            skipValidation: config.skipValidation ?? false
        };
        this.stats = {
            totalEntries: 0,
            processedChanges: 0,
            inboundMessages: 0,
            forwardedToN8n: 0,
            errors: 0,
            startTime: new Date()
        };
    }
    async processWebhookForN8n(body, userBusinessLookupFn) {
        try {
            if (!this.config.enabled) {
                console.log('🔇 [N8N_WEBHOOK_PROCESSOR] n8n forwarding is disabled, skipping');
                return this.getStats();
            }
            this.stats = {
                totalEntries: 0,
                processedChanges: 0,
                inboundMessages: 0,
                forwardedToN8n: 0,
                errors: 0,
                startTime: new Date()
            };
            const entries = body?.entry || [];
            this.stats.totalEntries = entries.length;
            if (this.config.logLevel === 'detailed') {
                console.log(`🔄 [N8N_WEBHOOK_PROCESSOR] Starting processing of ${entries.length} webhook entries`);
            }
            for (const entry of entries) {
                const changes = entry?.changes || [];
                for (const change of changes) {
                    if (!change)
                        continue;
                    this.stats.processedChanges++;
                    if (change.field === 'messages') {
                        await this.processMessagesChange(change, userBusinessLookupFn);
                    }
                    else {
                        if (this.config.logLevel === 'detailed') {
                            console.log(`⏭️  [N8N_WEBHOOK_PROCESSOR] Skipping field: ${change.field} (not messages)`);
                        }
                    }
                }
            }
            this.stats.endTime = new Date();
            if (this.config.logLevel === 'detailed' || this.stats.inboundMessages > 0) {
                const duration = this.stats.endTime.getTime() - this.stats.startTime.getTime();
                console.log(`✅ [N8N_WEBHOOK_PROCESSOR] Completed processing in ${duration}ms:`, {
                    entries: this.stats.totalEntries,
                    changes: this.stats.processedChanges,
                    inboundMessages: this.stats.inboundMessages,
                    forwardedToN8n: this.stats.forwardedToN8n,
                    errors: this.stats.errors
                });
            }
            return this.getStats();
        }
        catch (error) {
            this.stats.errors++;
            this.stats.endTime = new Date();
            console.error('❌ [N8N_WEBHOOK_PROCESSOR] Critical error in processWebhookForN8n:', error);
            return this.getStats();
        }
    }
    async processMessagesChange(change, userBusinessLookupFn) {
        try {
            const value = change.value;
            if (!value)
                return;
            const messages = value.messages;
            const statuses = value.statuses;
            console.log(`🔍 [N8N_WEBHOOK_PROCESSOR] Webhook payload analysis:`, {
                hasMessages: Array.isArray(messages) && messages.length > 0,
                hasStatuses: Array.isArray(statuses) && statuses.length > 0,
                messageCount: Array.isArray(messages) ? messages.length : 0,
                statusCount: Array.isArray(statuses) ? statuses.length : 0,
                phoneNumberId: value?.metadata?.phone_number_id || 'not found'
            });
            if (!Array.isArray(messages) || messages.length === 0) {
                console.log('⏭️  [N8N_WEBHOOK_PROCESSOR] No inbound messages found, only status updates or other events');
                return;
            }
            this.stats.inboundMessages += messages.length;
            if (this.config.logLevel === 'detailed') {
                console.log(`📥 [N8N_WEBHOOK_PROCESSOR] Found ${messages.length} inbound message(s)`);
            }
            const phoneNumberId = value?.metadata?.phone_number_id;
            if (!phoneNumberId) {
                console.log('⚠️  [N8N_WEBHOOK_PROCESSOR] No phone_number_id in webhook payload, cannot resolve user');
                this.stats.errors++;
                return;
            }
            const userBusinessInfo = await userBusinessLookupFn(phoneNumberId);
            if (!userBusinessInfo) {
                console.log(`⚠️  [N8N_WEBHOOK_PROCESSOR] No user business info found for phone_number_id: ${phoneNumberId}`);
                this.stats.errors++;
                return;
            }
            if (!userBusinessInfo.webhookUrl || userBusinessInfo.webhookUrl.trim() === '') {
                console.log(`⚠️  [N8N_WEBHOOK_PROCESSOR] No webhook URL configured for user ${userBusinessInfo.userId}, skipping n8n forward`);
                return;
            }
            console.log(`🎯 [N8N_WEBHOOK_PROCESSOR] Found webhook URL for user ${userBusinessInfo.userId}: ${userBusinessInfo.webhookUrl}`);
            if (this.config.logLevel === 'detailed') {
                console.log(`📱 [N8N_WEBHOOK_PROCESSOR] Resolved phone_number_id ${phoneNumberId} to user ${userBusinessInfo.userId} with webhook URL`);
            }
            const mappedPayload = (0, waToN8nInboundMapper_1.mapInboundMessage)(value);
            if (!this.config.skipValidation) {
                const validation = (0, waToN8nInboundMapper_1.validateInboundMessage)(mappedPayload.message);
                if (!validation.isValid) {
                    console.error(`❌ [N8N_WEBHOOK_PROCESSOR] Invalid mapped message for user ${userBusinessInfo.userId}:`, validation.errors);
                    this.stats.errors++;
                    return;
                }
            }
            if (this.config.logLevel === 'detailed') {
                (0, waToN8nInboundMapper_1.logMappedMessage)(mappedPayload, `N8N_WEBHOOK_PROCESSOR:${userBusinessInfo.userId}`);
            }
            const forwardContext = {
                userId: userBusinessInfo.userId,
                wabaId: userBusinessInfo.wabaId || null,
                phoneNumberId: phoneNumberId,
                webhookUrl: userBusinessInfo.webhookUrl,
                webhookVerifyToken: userBusinessInfo.webhookVerifyToken || undefined
            };
            const contextValidation = (0, n8nForwarder_1.validateForwardContext)(forwardContext);
            if (!contextValidation.isValid) {
                console.error(`❌ [N8N_WEBHOOK_PROCESSOR] Invalid forward context for user ${userBusinessInfo.userId}:`, contextValidation.errors);
                this.stats.errors++;
                return;
            }
            const n8nEvent = {
                kind: 'message_in',
                payload: mappedPayload
            };
            await (0, n8nForwarder_1.forwardInboundToN8N)(forwardContext, n8nEvent);
            this.stats.forwardedToN8n++;
            console.log(`📤 [N8N_WEBHOOK_PROCESSOR] Successfully forwarded inbound message from ${mappedPayload.message.from} to n8n for user ${userBusinessInfo.userId}`);
        }
        catch (error) {
            this.stats.errors++;
            console.error('❌ [N8N_WEBHOOK_PROCESSOR] Error processing messages change:', error);
        }
    }
    getStats() {
        return { ...this.stats };
    }
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log(`🔧 [N8N_WEBHOOK_PROCESSOR] Config updated:`, this.config);
    }
    isEnabled() {
        return this.config.enabled;
    }
    resetStats() {
        this.stats = {
            totalEntries: 0,
            processedChanges: 0,
            inboundMessages: 0,
            forwardedToN8n: 0,
            errors: 0,
            startTime: new Date()
        };
        console.log('🔄 [N8N_WEBHOOK_PROCESSOR] Stats reset');
    }
}
exports.N8nWebhookProcessor = N8nWebhookProcessor;
function createN8nWebhookProcessor(config = {}) {
    return new N8nWebhookProcessor(config);
}
async function processWebhookForN8n(body, userBusinessLookupFn, config = {}) {
    const processor = createN8nWebhookProcessor(config);
    return await processor.processWebhookForN8n(body, userBusinessLookupFn);
}
function createTestUserBusinessInfo(userId = 'test_user', webhookUrl = 'https://n8n.example.com/webhook/test', phoneNumberId = 'test_phone_123') {
    return {
        id: 'test_business_info_123',
        userId,
        businessName: 'Test Business',
        whatsappNumber: '15551234567',
        whatsappNumberId: phoneNumberId,
        wabaId: 'test_waba_123',
        accessToken: 'test_access_token',
        webhookUrl,
        webhookVerifyToken: 'test_secret',
        isActive: true,
        appId: 'test_app_123',
        createdAt: new Date(),
        updatedAt: new Date()
    };
}
async function createTestLookupFunction(testUserBusinessInfo) {
    return async (phoneNumberId) => {
        if (phoneNumberId === testUserBusinessInfo.whatsappNumberId) {
            return testUserBusinessInfo;
        }
        return null;
    };
}
//# sourceMappingURL=n8nWebhookProcessor.js.map