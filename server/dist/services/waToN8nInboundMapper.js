"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapInboundMessage = mapInboundMessage;
exports.validateInboundMessage = validateInboundMessage;
exports.createTestWhatsAppMessage = createTestWhatsAppMessage;
exports.logMappedMessage = logMappedMessage;
function mapInboundMessage(value) {
    try {
        console.log('🔄 [WA_TO_N8N_MAPPER] Starting message mapping');
        const messages = value?.messages;
        const message = Array.isArray(messages) && messages.length > 0 ? messages[0] : null;
        if (!message) {
            console.log('⚠️  [WA_TO_N8N_MAPPER] No message found in webhook payload');
            return {
                message: createEmptyMessage(),
                raw: value
            };
        }
        const to = value?.metadata?.display_phone_number ||
            value?.metadata?.phone_number ||
            null;
        const mappedMessage = mapMessageByType(message, to);
        console.log(`✅ [WA_TO_N8N_MAPPER] Successfully mapped ${message.type || 'unknown'} message from ${message.from || 'unknown'}`);
        return {
            message: mappedMessage,
            raw: value
        };
    }
    catch (error) {
        console.error('❌ [WA_TO_N8N_MAPPER] Error mapping inbound message:', error);
        return {
            message: createEmptyMessage(),
            raw: value
        };
    }
}
function mapMessageByType(message, to) {
    const baseMessage = {
        wamid: message.id || null,
        from: message.from || null,
        to,
        type: message.type || null,
        text: null,
        interactive: null,
        media: null,
        location: null,
        contacts: null,
        sticker: null
    };
    switch (message.type) {
        case 'text':
            return mapTextMessage(message, baseMessage);
        case 'interactive':
            return mapInteractiveMessage(message, baseMessage);
        case 'image':
        case 'video':
        case 'audio':
        case 'document':
            return mapMediaMessage(message, baseMessage);
        case 'location':
            return mapLocationMessage(message, baseMessage);
        case 'contacts':
            return mapContactsMessage(message, baseMessage);
        case 'sticker':
            return mapStickerMessage(message, baseMessage);
        default:
            console.log(`🤷 [WA_TO_N8N_MAPPER] Unknown message type: ${message.type}, mapping as generic`);
            return baseMessage;
    }
}
function mapTextMessage(message, baseMessage) {
    return {
        ...baseMessage,
        text: message.text?.body || null
    };
}
function mapInteractiveMessage(message, baseMessage) {
    const interactive = message.interactive || {};
    let interactiveType = 'unknown';
    let title = null;
    if (interactive.button_reply) {
        interactiveType = 'button';
        title = interactive.button_reply.title || interactive.button_reply.id || null;
    }
    else if (interactive.list_reply) {
        interactiveType = 'list';
        title = interactive.list_reply.title || interactive.list_reply.id || null;
    }
    else if (interactive.nfm_reply) {
        interactiveType = 'nfm';
        title = interactive.nfm_reply.name || 'flow_response';
    }
    else {
        const keys = Object.keys(interactive);
        if (keys.length > 0) {
            interactiveType = keys[0];
            const interactiveData = interactive[keys[0]];
            title = interactiveData?.title || interactiveData?.name || interactiveData?.id || null;
        }
    }
    return {
        ...baseMessage,
        text: title,
        interactive: {
            type: interactiveType,
            title
        }
    };
}
function mapMediaMessage(message, baseMessage) {
    const mediaType = message.type;
    const media = message[mediaType] || {};
    return {
        ...baseMessage,
        text: media.caption || null,
        media: {
            id: media.id || null,
            mime_type: media.mime_type || null,
            sha256: media.sha256 || null,
            caption: media.caption || null,
            filename: media.filename || null
        }
    };
}
function mapLocationMessage(message, baseMessage) {
    const location = message.location || {};
    return {
        ...baseMessage,
        text: location.name || location.address || `Location: ${location.latitude}, ${location.longitude}`,
        location: {
            latitude: location.latitude || null,
            longitude: location.longitude || null,
            name: location.name || null,
            address: location.address || null
        }
    };
}
function mapContactsMessage(message, baseMessage) {
    const contacts = message.contacts || [];
    let contactSummary = '';
    if (Array.isArray(contacts) && contacts.length > 0) {
        const names = contacts.map(contact => contact?.name?.formatted_name ||
            contact?.name?.first_name ||
            'Unknown Contact');
        contactSummary = `Shared ${contacts.length} contact(s): ${names.join(', ')}`;
    }
    return {
        ...baseMessage,
        text: contactSummary,
        contacts: contacts.length > 0 ? contacts : null
    };
}
function mapStickerMessage(message, baseMessage) {
    const sticker = message.sticker || {};
    return {
        ...baseMessage,
        text: 'Sticker message',
        sticker: {
            id: sticker.id || null,
            mime_type: sticker.mime_type || null,
            sha256: sticker.sha256 || null,
            animated: sticker.animated || false
        }
    };
}
function createEmptyMessage() {
    return {
        wamid: null,
        from: null,
        to: null,
        type: null,
        text: null,
        interactive: null,
        media: null,
        location: null,
        contacts: null,
        sticker: null
    };
}
function validateInboundMessage(message) {
    const errors = [];
    if (!message.wamid) {
        errors.push('wamid is required');
    }
    if (!message.from) {
        errors.push('from is required');
    }
    if (!message.type) {
        errors.push('type is required');
    }
    if (message.type === 'text' && !message.text) {
        errors.push('text is required for text messages');
    }
    if (message.type === 'interactive' && !message.interactive) {
        errors.push('interactive data is required for interactive messages');
    }
    if (['image', 'video', 'audio', 'document'].includes(message.type || '') && !message.media?.id) {
        errors.push(`media.id is required for ${message.type} messages`);
    }
    if (message.type === 'location' && !message.location) {
        errors.push('location data is required for location messages');
    }
    return {
        isValid: errors.length === 0,
        errors
    };
}
function createTestWhatsAppMessage(type = 'text', from = '15550001111', text = 'Hello from test') {
    const basePayload = {
        messaging_product: 'whatsapp',
        metadata: {
            display_phone_number: '15551234567',
            phone_number_id: 'test_phone_123'
        },
        contacts: [{
                profile: { name: 'Test User' },
                wa_id: from
            }],
        messages: []
    };
    const messageBase = {
        from,
        id: `wamid.test.${Date.now()}.${Math.random()}`,
        timestamp: Math.floor(Date.now() / 1000).toString(),
        type
    };
    switch (type) {
        case 'text':
            basePayload.messages.push({
                ...messageBase,
                text: { body: text }
            });
            break;
        case 'interactive':
            basePayload.messages.push({
                ...messageBase,
                interactive: {
                    button_reply: {
                        id: 'btn_1',
                        title: text
                    }
                }
            });
            break;
        case 'image':
            basePayload.messages.push({
                ...messageBase,
                image: {
                    id: 'media_123',
                    mime_type: 'image/jpeg',
                    caption: text
                }
            });
            break;
        case 'location':
            basePayload.messages.push({
                ...messageBase,
                location: {
                    latitude: 37.7749,
                    longitude: -122.4194,
                    name: text,
                    address: 'San Francisco, CA'
                }
            });
            break;
        default:
            basePayload.messages.push(messageBase);
    }
    return basePayload;
}
function logMappedMessage(mapped, context = '') {
    const { message } = mapped;
    const logPrefix = context ? `[${context}] ` : '';
    console.log(`📋 ${logPrefix}Mapped message details:`, {
        wamid: message.wamid,
        type: message.type,
        from: message.from,
        to: message.to,
        textPreview: message.text ? message.text.substring(0, 100) + (message.text.length > 100 ? '...' : '') : null,
        hasInteractive: !!message.interactive,
        hasMedia: !!message.media,
        hasLocation: !!message.location,
        contactCount: message.contacts ? message.contacts.length : 0,
        hasSticker: !!message.sticker
    });
}
//# sourceMappingURL=waToN8nInboundMapper.js.map