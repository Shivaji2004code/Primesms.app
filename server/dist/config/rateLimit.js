"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.noLimiter = exports.readLimiter = exports.writeLimiter = exports.resetLimiter = exports.otpLimiter = exports.loginLimiter = exports.adminLimiter = exports.authLimiter = exports.globalLimiter = void 0;
const express_rate_limit_1 = __importStar(require("express-rate-limit"));
const envN = (k, def) => {
    const v = process.env[k];
    if (!v)
        return def;
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
};
const WINDOW_MS = envN('RL_WINDOW_MS', 15 * 60 * 1000);
const GLOBAL_MAX = envN('RL_GLOBAL_MAX', 10000);
const AUTH_MAX = envN('RL_AUTH_MAX', 15000);
const ADMIN_MAX = envN('RL_ADMIN_MAX', 20000);
const LOGIN_MAX = envN('RL_LOGIN_MAX', 100);
const OTP_MAX = envN('RL_OTP_MAX', 50);
const RESET_MAX = envN('RL_RESET_MAX', 50);
const WRITE_MAX = envN('RL_WRITE_MAX', 2000);
const READ_MAX = envN('RL_READ_MAX', 5000);
const keyByUserOrIp = (req) => {
    const userId = req.session?.userId;
    return userId ? `user:${userId}` : (0, express_rate_limit_1.ipKeyGenerator)(req.ip || '127.0.0.1');
};
const isHealthPath = (path) => {
    return path === '/health' ||
        path === '/healthz' ||
        path === '/api/health' ||
        path === '/api/healthz' ||
        path.startsWith('/api/health/');
};
const stdOpts = {
    windowMs: WINDOW_MS,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true
};
exports.globalLimiter = (0, express_rate_limit_1.default)({
    ...stdOpts,
    max: GLOBAL_MAX,
    keyGenerator: keyByUserOrIp,
    skip: (req) => {
        const p = req.path;
        if (isHealthPath(p))
            return true;
        if (p.startsWith('/assets') ||
            p.startsWith('/static') ||
            p.startsWith('/favicon') ||
            p.startsWith('/_vite') ||
            p.includes('.'))
            return true;
        if (req.method === 'GET')
            return true;
        return false;
    },
    message: { error: 'TOO_MANY_REQUESTS_GLOBAL', retryAfter: Math.ceil(WINDOW_MS / 1000) }
});
exports.authLimiter = (0, express_rate_limit_1.default)({
    ...stdOpts,
    max: AUTH_MAX,
    keyGenerator: keyByUserOrIp,
    message: { error: 'TOO_MANY_REQUESTS_AUTH', retryAfter: Math.ceil(WINDOW_MS / 1000) }
});
exports.adminLimiter = (0, express_rate_limit_1.default)({
    ...stdOpts,
    max: ADMIN_MAX,
    keyGenerator: keyByUserOrIp,
    skipSuccessfulRequests: true,
    message: { error: 'TOO_MANY_REQUESTS_ADMIN', retryAfter: Math.ceil(WINDOW_MS / 1000) }
});
exports.loginLimiter = (0, express_rate_limit_1.default)({
    ...stdOpts,
    max: LOGIN_MAX,
    keyGenerator: (req) => (0, express_rate_limit_1.ipKeyGenerator)(req.ip || '127.0.0.1'),
    skipSuccessfulRequests: false,
    message: { error: 'TOO_MANY_LOGIN_ATTEMPTS', retryAfter: Math.ceil(WINDOW_MS / 1000) }
});
exports.otpLimiter = (0, express_rate_limit_1.default)({
    ...stdOpts,
    max: OTP_MAX,
    keyGenerator: (req) => (0, express_rate_limit_1.ipKeyGenerator)(req.ip || '127.0.0.1'),
    message: { error: 'TOO_MANY_OTP_REQUESTS', retryAfter: Math.ceil(WINDOW_MS / 1000) }
});
exports.resetLimiter = (0, express_rate_limit_1.default)({
    ...stdOpts,
    max: RESET_MAX,
    keyGenerator: (req) => (0, express_rate_limit_1.ipKeyGenerator)(req.ip || '127.0.0.1'),
    message: { error: 'TOO_MANY_PASSWORD_RESETS', retryAfter: Math.ceil(WINDOW_MS / 1000) }
});
exports.writeLimiter = (0, express_rate_limit_1.default)({
    ...stdOpts,
    max: WRITE_MAX,
    keyGenerator: keyByUserOrIp,
    message: { error: 'TOO_MANY_WRITES', retryAfter: Math.ceil(WINDOW_MS / 1000) }
});
exports.readLimiter = (0, express_rate_limit_1.default)({
    ...stdOpts,
    max: READ_MAX,
    keyGenerator: keyByUserOrIp,
    skipSuccessfulRequests: true,
    message: { error: 'TOO_MANY_READS', retryAfter: Math.ceil(WINDOW_MS / 1000) }
});
const noLimiter = (req, res, next) => next();
exports.noLimiter = noLimiter;
console.log('[RATE LIMIT CONFIG]', {
    windowMs: WINDOW_MS,
    global: GLOBAL_MAX,
    auth: AUTH_MAX,
    admin: ADMIN_MAX,
    login: LOGIN_MAX,
    writes: WRITE_MAX,
    reads: READ_MAX
});
//# sourceMappingURL=rateLimit.js.map