"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePhoneNumber = validatePhoneNumber;
exports.sanitizeInput = sanitizeInput;
exports.extractVariables = extractVariables;
exports.validateTemplateComponents = validateTemplateComponents;
exports.countTemplateVariables = countTemplateVariables;
exports.validateVariableCount = validateVariableCount;
exports.formatErrorResponse = formatErrorResponse;
exports.logApiRequest = logApiRequest;
exports.generateRateLimitKey = generateRateLimitKey;
exports.validateTemplateCompatibility = validateTemplateCompatibility;
function validatePhoneNumber(phoneNumber) {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
        return false;
    }
    const cleaned = phoneNumber.trim();
    const phoneRegex = /^[1-9]\d{7,14}$/;
    return phoneRegex.test(cleaned);
}
function sanitizeInput(input) {
    if (input === null || input === undefined) {
        return undefined;
    }
    if (typeof input !== 'string') {
        input = String(input);
    }
    return input
        .replace(/[<>\"'&]/g, '')
        .replace(/\x00/g, '')
        .trim();
}
function extractVariables(source) {
    const variables = {};
    if (!source || typeof source !== 'object') {
        return variables;
    }
    Object.keys(source).forEach(key => {
        if (/^var\d+$/.test(key)) {
            const value = sanitizeInput(source[key]);
            if (value !== undefined && value !== '') {
                variables[key] = value;
            }
        }
    });
    return variables;
}
function validateTemplateComponents(components) {
    if (!Array.isArray(components)) {
        return false;
    }
    return components.every(component => {
        return component &&
            typeof component === 'object' &&
            typeof component.type === 'string';
    });
}
function countTemplateVariables(templateComponents) {
    const bodyComponent = templateComponents.find(c => c.type === 'BODY');
    if (!bodyComponent || !bodyComponent.text) {
        return 0;
    }
    const variableMatches = bodyComponent.text.match(/\{\{[^}]+\}\}/g);
    return variableMatches ? variableMatches.length : 0;
}
function validateVariableCount(params, templateComponents) {
    const expectedCount = countTemplateVariables(templateComponents);
    const providedVars = Object.keys(params)
        .filter(key => /^var\d+$/.test(key) && params[key] !== undefined && params[key] !== '')
        .length;
    if (providedVars !== expectedCount) {
        return {
            isValid: false,
            expectedCount,
            providedCount: providedVars,
            message: `Template requires ${expectedCount} variables, but ${providedVars} were provided`
        };
    }
    return {
        isValid: true,
        expectedCount,
        providedCount: providedVars
    };
}
function formatErrorResponse(statusCode, error, message, details) {
    const response = {
        error,
        message,
        timestamp: new Date().toISOString()
    };
    if (details) {
        response.details = details;
    }
    return response;
}
function logApiRequest(method, username, templatename, recipient, status, error) {
    const logData = {
        timestamp: new Date().toISOString(),
        method,
        username,
        templatename,
        recipient: recipient ? `${recipient.slice(0, 3)}***${recipient.slice(-2)}` : 'unknown',
        status,
        error: error || undefined
    };
    if (status === 'error') {
        console.error('Send API Request Failed:', logData);
    }
    else {
        console.log('Send API Request Success:', logData);
    }
}
function generateRateLimitKey(req) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const username = req.body?.username || req.query?.username || 'anonymous';
    return `${ip}:${username}`;
}
function validateTemplateCompatibility(template) {
    const issues = [];
    if (!template.components || !Array.isArray(template.components)) {
        issues.push('Template has invalid components structure');
        return { isValid: false, issues };
    }
    const headerComponent = template.components.find((c) => c.type === 'HEADER');
    if (headerComponent && headerComponent.format && headerComponent.format !== 'TEXT') {
        issues.push('Only TEXT headers are supported via the Send API');
    }
    const bodyComponent = template.components.find((c) => c.type === 'BODY');
    if (!bodyComponent) {
        issues.push('Template must have a BODY component');
    }
    const buttonComponents = template.components.filter((c) => c.type === 'BUTTONS');
    buttonComponents.forEach((button) => {
        if (button.buttons) {
            button.buttons.forEach((btn) => {
                if (btn.type && btn.type !== 'QUICK_REPLY') {
                    issues.push(`Button type '${btn.type}' is not supported via Send API`);
                }
            });
        }
    });
    return {
        isValid: issues.length === 0,
        issues: issues.length > 0 ? issues : undefined
    };
}
//# sourceMappingURL=sendApiHelpers.js.map