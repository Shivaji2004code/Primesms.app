"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSendAcknowledgment = handleSendAcknowledgment;
exports.simulateWebhookEvent = simulateWebhookEvent;
exports.getUserSSEStatus = getUserSSEStatus;
const sseBroadcaster_1 = require("../services/sseBroadcaster");
const waProcessors_1 = require("../services/waProcessors");
const processors = (0, waProcessors_1.createProcessors)({
    emitReport: (userId, payload) => sseBroadcaster_1.sseHub.emitReport(userId, payload),
    emitTemplate: (userId, payload) => sseBroadcaster_1.sseHub.emitTemplate(userId, payload)
});
async function handleSendAcknowledgment(userId, messageId, recipientNumber, campaignId, metadata) {
    try {
        console.log(`📤 [SEND-ACK] Handling send acknowledgment: ${messageId} for user ${userId}`);
        const mockWebhookBody = {
            entry: [{
                    changes: [{
                            field: 'send_ack',
                            value: {
                                metadata: { phone_number_id: 'from_send_ack' },
                                send_acknowledgment: {
                                    message_id: messageId,
                                    recipient: recipientNumber,
                                    user_id: userId,
                                    campaign_id: campaignId,
                                    metadata
                                }
                            }
                        }]
                }]
        };
        sseBroadcaster_1.sseHub.emitReport(userId, {
            type: 'report_update',
            status: 'sent',
            messageId,
            recipientNumber,
            campaignId,
            at: new Date().toISOString(),
            meta: {
                source: 'send_ack',
                ...metadata
            }
        });
        console.log(`✅ [SEND-ACK] Send acknowledgment processed for ${messageId}`);
    }
    catch (error) {
        console.error(`❌ [SEND-ACK] Error handling send acknowledgment for ${messageId}:`, error);
    }
}
function simulateWebhookEvent(type, userId, eventData) {
    if (type === 'status_update') {
        sseBroadcaster_1.sseHub.emitReport(userId, {
            type: 'report_update',
            ...eventData,
            at: new Date().toISOString(),
            meta: { source: 'simulation', ...eventData.meta }
        });
    }
    else if (type === 'template_update') {
        sseBroadcaster_1.sseHub.emitTemplate(userId, {
            type: 'template_update',
            ...eventData,
            at: new Date().toISOString(),
            meta: { source: 'simulation', ...eventData.meta }
        });
    }
    console.log(`🧪 [SIMULATE] Sent ${type} event to user ${userId}:`, eventData);
}
function getUserSSEStatus(userId) {
    const hasReportConnections = sseBroadcaster_1.sseHub['reports'].has(userId) && sseBroadcaster_1.sseHub['reports'].get(userId).size > 0;
    const hasTemplateConnections = sseBroadcaster_1.sseHub['templates'].has(userId) && sseBroadcaster_1.sseHub['templates'].get(userId).size > 0;
    return {
        hasReportConnections,
        hasTemplateConnections,
        hasAnyConnections: hasReportConnections || hasTemplateConnections
    };
}
