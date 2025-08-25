"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.logShutdown = exports.logStartup = exports.logSecurity = exports.logDatabase = exports.logDebug = exports.logWarn = exports.logError = exports.logInfo = exports.createHttpLogger = void 0;
const winston_1 = __importDefault(require("winston"));
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    if (stack) {
        logMessage += `\nStack: ${stack}`;
    }
    const metaStr = Object.keys(meta).length > 0 ? `\nMeta: ${JSON.stringify(meta, null, 2)}` : '';
    return logMessage + metaStr;
}));
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'prime-sms' },
    transports: [
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), logFormat)
        })
    ],
    exceptionHandlers: [
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), logFormat)
        })
    ],
    rejectionHandlers: [
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), logFormat)
        })
    ],
    exitOnError: true
});
exports.logger = logger;
const createHttpLogger = () => {
    return (req, res, next) => {
        const startTime = Date.now();
        const originalEnd = res.end;
        res.end = function (chunk, encoding) {
            const duration = Date.now() - startTime;
            logger.info('HTTP Request', {
                method: req.method,
                url: req.originalUrl || req.url,
                status: res.statusCode,
                duration: `${duration}ms`,
                ip: req.ip || req.connection?.remoteAddress,
                userAgent: req.get('User-Agent') || 'Unknown'
            });
            originalEnd.call(this, chunk, encoding);
        };
        next();
    };
};
exports.createHttpLogger = createHttpLogger;
const logInfo = (message, meta) => {
    logger.info(message, meta);
};
exports.logInfo = logInfo;
const logError = (message, error, meta) => {
    if (error instanceof Error) {
        logger.error(message, {
            error: error.message,
            stack: error.stack,
            ...meta
        });
    }
    else if (error && typeof error === 'object') {
        logger.error(message, { error, ...meta });
    }
    else {
        logger.error(message, meta);
    }
};
exports.logError = logError;
const logWarn = (message, meta) => {
    logger.warn(message, meta);
};
exports.logWarn = logWarn;
const logDebug = (message, meta) => {
    logger.debug(message, meta);
};
exports.logDebug = logDebug;
const logDatabase = (operation, query, duration, error) => {
    if (error) {
        logger.error(`Database Error - ${operation}`, {
            operation,
            query: query ? query.substring(0, 200) + (query.length > 200 ? '...' : '') : undefined,
            error: error.message,
            stack: error.stack
        });
    }
    else {
        logger.info(`Database Operation - ${operation}`, {
            operation,
            query: query ? query.substring(0, 100) + (query.length > 100 ? '...' : '') : undefined,
            duration: duration ? `${duration}ms` : undefined
        });
    }
};
exports.logDatabase = logDatabase;
const logSecurity = (event, details, severity = 'warn') => {
    logger[severity](`Security Event: ${event}`, {
        securityEvent: event,
        ...details
    });
};
exports.logSecurity = logSecurity;
const logStartup = (message, config) => {
    logger.info(`🚀 ${message}`, config);
};
exports.logStartup = logStartup;
const logShutdown = (message, reason) => {
    logger.info(`🔒 ${message}`, { reason });
};
exports.logShutdown = logShutdown;
exports.default = logger;
//# sourceMappingURL=logger.js.map