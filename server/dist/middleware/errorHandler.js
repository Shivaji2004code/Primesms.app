"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createErrorResponse = exports.isOperationalError = exports.setupGlobalErrorHandlers = exports.notFoundHandler = exports.asyncHandler = exports.errorHandler = exports.RateLimitError = exports.AuthorizationError = exports.AuthenticationError = exports.DatabaseError = exports.ValidationError = exports.AppError = void 0;
const logger_1 = require("../utils/logger");
const env_1 = require("../utils/env");
class AppError extends Error {
    constructor(message, statusCode = 500, code) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message, details) {
        super(message, 400, 'VALIDATION_ERROR');
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class DatabaseError extends AppError {
    constructor(message, originalError) {
        super(message, 500, 'DATABASE_ERROR');
        this.name = 'DatabaseError';
    }
}
exports.DatabaseError = DatabaseError;
class AuthenticationError extends AppError {
    constructor(message = 'Authentication required') {
        super(message, 401, 'AUTH_ERROR');
        this.name = 'AuthenticationError';
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends AppError {
    constructor(message = 'Access denied') {
        super(message, 403, 'AUTHORIZATION_ERROR');
        this.name = 'AuthorizationError';
    }
}
exports.AuthorizationError = AuthorizationError;
class RateLimitError extends AppError {
    constructor(message = 'Too many requests') {
        super(message, 429, 'RATE_LIMIT_ERROR');
        this.name = 'RateLimitError';
    }
}
exports.RateLimitError = RateLimitError;
const isOperationalError = (error) => {
    if (error instanceof AppError) {
        return error.isOperational;
    }
    return false;
};
exports.isOperationalError = isOperationalError;
const createErrorResponse = (error, req) => {
    const response = {
        success: false,
        error: 'Internal Server Error',
        timestamp: new Date().toISOString(),
        path: req.originalUrl || req.url
    };
    if (error instanceof AppError) {
        response.error = error.message;
        response.code = error.code;
    }
    else if (error.name === 'ValidationError') {
        response.error = 'Validation failed';
        response.code = 'VALIDATION_ERROR';
    }
    else if (error.code === '23505') {
        response.error = 'Resource already exists';
        response.code = 'DUPLICATE_RESOURCE';
    }
    else if (error.code === '23503') {
        response.error = 'Referenced resource not found';
        response.code = 'FOREIGN_KEY_ERROR';
    }
    else if (error.name === 'JsonWebTokenError') {
        response.error = 'Invalid token';
        response.code = 'INVALID_TOKEN';
    }
    else if (error.name === 'TokenExpiredError') {
        response.error = 'Token expired';
        response.code = 'TOKEN_EXPIRED';
    }
    else if (error.type === 'entity.parse.failed') {
        response.error = 'Invalid JSON payload';
        response.code = 'INVALID_JSON';
    }
    else if (error.type === 'entity.too.large') {
        response.error = 'Payload too large';
        response.code = 'PAYLOAD_TOO_LARGE';
    }
    return response;
};
exports.createErrorResponse = createErrorResponse;
const errorHandler = (error, req, res, next) => {
    (0, logger_1.logError)('Application Error', error, {
        method: req.method,
        url: req.originalUrl || req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        body: req.body,
        params: req.params,
        query: req.query
    });
    let statusCode = 500;
    if (error instanceof AppError) {
        statusCode = error.statusCode;
    }
    else if (error.statusCode) {
        statusCode = error.statusCode;
    }
    else if (error.status) {
        statusCode = error.status;
    }
    const errorResponse = createErrorResponse(error, req);
    if (env_1.env.isDevelopment) {
        errorResponse.stack = error.stack;
        errorResponse.details = error;
    }
    res.status(statusCode).json(errorResponse);
};
exports.errorHandler = errorHandler;
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
const notFoundHandler = (req, res, next) => {
    const error = new AppError(`Route ${req.originalUrl} not found`, 404, 'ROUTE_NOT_FOUND');
    next(error);
};
exports.notFoundHandler = notFoundHandler;
const setupGlobalErrorHandlers = () => {
    process.on('uncaughtException', (error) => {
        (0, logger_1.logError)('Uncaught Exception - Server shutting down', error);
        setTimeout(() => {
            process.exit(1);
        }, 1000);
    });
    process.on('unhandledRejection', (reason, promise) => {
        (0, logger_1.logError)('Unhandled Rejection - Server shutting down', new Error(String(reason)), {
            promise: promise.toString()
        });
        setTimeout(() => {
            process.exit(1);
        }, 1000);
    });
    process.on('SIGTERM', () => {
        (0, logger_1.logError)('SIGTERM received - Server shutting down gracefully');
        process.exit(0);
    });
    process.on('SIGINT', () => {
        (0, logger_1.logError)('SIGINT received - Server shutting down gracefully');
        process.exit(0);
    });
};
exports.setupGlobalErrorHandlers = setupGlobalErrorHandlers;
//# sourceMappingURL=errorHandler.js.map