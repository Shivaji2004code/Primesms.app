"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeTemplateComponents = sanitizeTemplateComponents;
exports.sanitizeTemplate = sanitizeTemplate;
exports.sanitizeTemplates = sanitizeTemplates;
exports.sanitizeTemplateResponse = sanitizeTemplateResponse;
function sanitizeTemplateComponents(components) {
    if (!Array.isArray(components)) {
        console.warn('[SANITIZER] Components is not an array, creating default body component');
        return [{ type: 'BODY', text: 'Default template content' }];
    }
    return components.map((component, index) => {
        try {
            if (!component || typeof component !== 'object') {
                console.warn(`[SANITIZER] Component ${index} is not an object, creating default`);
                return { type: 'BODY', text: 'Fixed component content' };
            }
            if (!component.type || typeof component.type !== 'string') {
                console.warn(`[SANITIZER] Component ${index} missing type, defaulting to BODY`);
                component.type = 'BODY';
            }
            if (component.type === 'HEADER') {
                if (!component.format) {
                    component.format = component.text ? 'TEXT' : 'NONE';
                }
                if (component.format === 'IMAGE') {
                    if (component.icon === undefined) {
                        console.warn(`[SANITIZER] Header component ${index} missing icon, setting to null`);
                        component.icon = null;
                    }
                    if (!component.example) {
                        component.example = { header_handle: [] };
                    }
                }
                if (component.format === 'TEXT' && !component.text) {
                    component.text = 'Header text';
                }
            }
            if (component.type === 'BODY') {
                if (!component.text || typeof component.text !== 'string') {
                    console.warn(`[SANITIZER] Body component ${index} missing text`);
                    component.text = 'Template content';
                }
            }
            if (component.type === 'FOOTER') {
                if (!component.text || typeof component.text !== 'string') {
                    component.text = 'Footer text';
                }
            }
            if (component.type === 'BUTTONS') {
                if (!Array.isArray(component.buttons)) {
                    console.warn(`[SANITIZER] Buttons component ${index} missing buttons array`);
                    component.buttons = [];
                }
                component.buttons = component.buttons.map((button, buttonIndex) => {
                    if (!button || typeof button !== 'object') {
                        return { type: 'QUICK_REPLY', text: `Button ${buttonIndex + 1}` };
                    }
                    if (!button.type) {
                        button.type = 'QUICK_REPLY';
                    }
                    if (!button.text || typeof button.text !== 'string') {
                        button.text = `Button ${buttonIndex + 1}`;
                    }
                    return button;
                });
            }
            return component;
        }
        catch (error) {
            console.error(`[SANITIZER] Error sanitizing component ${index}:`, error);
            return { type: 'BODY', text: 'Error: Component sanitization failed' };
        }
    }).filter(Boolean);
}
function sanitizeTemplate(template) {
    if (!template || typeof template !== 'object') {
        throw new Error('Template is not a valid object');
    }
    return {
        ...template,
        components: sanitizeTemplateComponents(template.components),
        name: template.name || 'Unnamed Template',
        category: template.category || 'UTILITY',
        language: template.language || 'en_US',
        status: template.status || 'DRAFT'
    };
}
function sanitizeTemplates(templates) {
    if (!Array.isArray(templates)) {
        console.warn('[SANITIZER] Templates is not an array, returning empty array');
        return [];
    }
    return templates.map((template, index) => {
        try {
            return sanitizeTemplate(template);
        }
        catch (error) {
            console.error(`[SANITIZER] Error sanitizing template ${index}:`, error);
            return null;
        }
    }).filter(Boolean);
}
function sanitizeTemplateResponse(req, res, next) {
    const originalJson = res.json;
    res.json = function (data) {
        try {
            if (data && data.data && Array.isArray(data.data)) {
                data.data = sanitizeTemplates(data.data);
            }
            else if (data && data.id && data.components) {
                data = sanitizeTemplate(data);
            }
        }
        catch (error) {
            console.error('[SANITIZER] Error in response sanitization:', error);
        }
        return originalJson.call(this, data);
    };
    next();
}
//# sourceMappingURL=templateSanitizer.js.map