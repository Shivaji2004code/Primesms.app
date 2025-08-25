"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCustomValidator = exports.adminSchemas = exports.messageSchemas = exports.templateSchemas = exports.authSchemas = exports.commonSchemas = exports.validateRequest = void 0;
const zod_1 = require("zod");
const errorHandler_1 = require("./errorHandler");
const formatZodError = (error) => {
    const errors = error.errors.map(err => {
        const path = err.path.join('.');
        return `${path}: ${err.message}`;
    });
    return `Validation failed: ${errors.join(', ')}`;
};
const validateRequest = (schemas) => {
    return (req, res, next) => {
        try {
            if (schemas.body) {
                const result = schemas.body.safeParse(req.body);
                if (!result.success) {
                    throw new errorHandler_1.ValidationError(formatZodError(result.error));
                }
                req.body = result.data;
            }
            if (schemas.query) {
                const result = schemas.query.safeParse(req.query);
                if (!result.success) {
                    throw new errorHandler_1.ValidationError(formatZodError(result.error));
                }
                req.query = result.data;
            }
            if (schemas.params) {
                const result = schemas.params.safeParse(req.params);
                if (!result.success) {
                    throw new errorHandler_1.ValidationError(formatZodError(result.error));
                }
                req.params = result.data;
            }
            if (schemas.headers) {
                const result = schemas.headers.safeParse(req.headers);
                if (!result.success) {
                    throw new errorHandler_1.ValidationError(formatZodError(result.error));
                }
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.validateRequest = validateRequest;
exports.commonSchemas = {
    uuidParam: zod_1.z.object({
        id: zod_1.z.string().uuid('Invalid UUID format')
    }),
    paginationQuery: zod_1.z.object({
        page: zod_1.z.string().optional().transform(val => val ? parseInt(val) : 1),
        limit: zod_1.z.string().optional().transform(val => val ? parseInt(val) : 20),
        sortBy: zod_1.z.string().optional(),
        sortOrder: zod_1.z.enum(['asc', 'desc']).optional().default('desc')
    }).refine(data => data.page >= 1, { message: 'Page must be >= 1' })
        .refine(data => data.limit >= 1 && data.limit <= 100, { message: 'Limit must be between 1 and 100' }),
    email: zod_1.z.string().email('Invalid email format').min(5).max(255),
    password: zod_1.z.string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
    username: zod_1.z.string()
        .min(3, 'Username must be at least 3 characters')
        .max(50, 'Username must be at most 50 characters')
        .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    phoneNumber: zod_1.z.string()
        .regex(/^\+[1-9]\d{10,14}$/, 'Phone number must be in international format (+1234567890)'),
    templateName: zod_1.z.string()
        .min(1, 'Template name is required')
        .max(255, 'Template name must be at most 255 characters')
        .regex(/^[a-z0-9_]+$/, 'Template name must be lowercase letters, numbers, or underscores only'),
    templateCategory: zod_1.z.enum(['UTILITY', 'MARKETING', 'AUTHENTICATION'], {
        errorMap: () => ({ message: 'Category must be UTILITY, MARKETING, or AUTHENTICATION' })
    }),
    languageCode: zod_1.z.string()
        .regex(/^[a-z]{2}(_[A-Z]{2})?$/, 'Language code must be in format: en or en_US')
        .default('en_US'),
    creditAmount: zod_1.z.number()
        .positive('Credit amount must be positive')
        .max(1000000, 'Credit amount cannot exceed 1,000,000'),
};
exports.authSchemas = {
    login: zod_1.z.object({
        username: exports.commonSchemas.username,
        password: zod_1.z.string().min(1, 'Password is required')
    }),
    signup: zod_1.z.object({
        name: zod_1.z.string().min(2, 'Name must be at least 2 characters').max(255),
        email: exports.commonSchemas.email,
        username: exports.commonSchemas.username,
        password: exports.commonSchemas.password,
        phoneNumber: exports.commonSchemas.phoneNumber.optional()
    }),
    updateProfile: zod_1.z.object({
        name: zod_1.z.string().min(2).max(255).optional(),
        email: exports.commonSchemas.email.optional(),
    }),
    changePassword: zod_1.z.object({
        currentPassword: zod_1.z.string().min(1, 'Current password is required'),
        newPassword: exports.commonSchemas.password
    })
};
exports.templateSchemas = {
    create: zod_1.z.object({
        name: exports.commonSchemas.templateName,
        category: exports.commonSchemas.templateCategory,
        language: exports.commonSchemas.languageCode,
        headerText: zod_1.z.string().max(60).optional(),
        bodyText: zod_1.z.string().min(1, 'Body text is required').max(1024),
        footerText: zod_1.z.string().max(60).optional(),
        buttons: zod_1.z.string().optional(),
        variableExamples: zod_1.z.string().optional(),
        submit_to_whatsapp: zod_1.z.boolean().optional().default(false)
    }),
    update: zod_1.z.object({
        name: exports.commonSchemas.templateName.optional(),
        category: exports.commonSchemas.templateCategory.optional(),
        language: exports.commonSchemas.languageCode.optional(),
        headerText: zod_1.z.string().max(60).optional(),
        bodyText: zod_1.z.string().min(1).max(1024).optional(),
        footerText: zod_1.z.string().max(60).optional()
    }),
    filter: zod_1.z.object({
        status: zod_1.z.enum(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED']).optional(),
        category: exports.commonSchemas.templateCategory.optional(),
        language: zod_1.z.string().optional()
    })
};
exports.messageSchemas = {
    send: zod_1.z.object({
        templateName: exports.commonSchemas.templateName,
        language: exports.commonSchemas.languageCode,
        phoneNumberId: zod_1.z.string().min(1, 'Phone number ID is required'),
        recipients: zod_1.z.array(zod_1.z.object({
            number: exports.commonSchemas.phoneNumber,
            variables: zod_1.z.record(zod_1.z.string()).optional()
        })).min(1, 'At least one recipient is required').max(1000, 'Maximum 1000 recipients allowed')
    }),
    quickSend: zod_1.z.object({
        templateName: exports.commonSchemas.templateName,
        language: exports.commonSchemas.languageCode,
        phoneNumberId: zod_1.z.string().min(1, 'Phone number ID is required'),
        variableMapping: zod_1.z.string().optional()
    })
};
exports.adminSchemas = {
    createUser: zod_1.z.object({
        name: zod_1.z.string().min(2).max(255),
        email: exports.commonSchemas.email,
        username: exports.commonSchemas.username,
        password: exports.commonSchemas.password,
        role: zod_1.z.enum(['user', 'admin']).default('user'),
        phoneNumber: exports.commonSchemas.phoneNumber.optional(),
        creditBalance: zod_1.z.number().min(0).default(1000)
    }),
    updateUser: zod_1.z.object({
        name: zod_1.z.string().min(2).max(255).optional(),
        email: exports.commonSchemas.email.optional(),
        role: zod_1.z.enum(['user', 'admin']).optional(),
        phoneNumber: exports.commonSchemas.phoneNumber.optional(),
        creditBalance: zod_1.z.number().min(0).optional()
    }),
    creditOperation: zod_1.z.object({
        userId: zod_1.z.string().uuid('Invalid user ID'),
        amount: exports.commonSchemas.creditAmount,
        description: zod_1.z.string().min(1).max(500)
    })
};
const createCustomValidator = (schema) => {
    return (req, res, next) => {
        try {
            const result = schema.safeParse(req.body);
            if (!result.success) {
                throw new errorHandler_1.ValidationError(formatZodError(result.error));
            }
            req.body = result.data;
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.createCustomValidator = createCustomValidator;
//# sourceMappingURL=validateRequest.js.map