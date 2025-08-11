"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const hpp_1 = __importDefault(require("hpp"));
const express_session_1 = __importDefault(require("express-session"));
const connect_pg_simple_1 = __importDefault(require("connect-pg-simple"));
const path_1 = __importDefault(require("path"));
const db_1 = __importDefault(require("./db"));
const env_1 = require("./utils/env");
const logger_1 = require("./utils/logger");
const errorHandler_1 = require("./middleware/errorHandler");
const health_1 = __importDefault(require("./health"));
const auth_1 = __importDefault(require("./routes/auth"));
const admin_1 = __importDefault(require("./routes/admin"));
const templates_1 = __importDefault(require("./routes/templates"));
const whatsapp_1 = __importDefault(require("./routes/whatsapp"));
const send_1 = __importDefault(require("./routes/send"));
const credits_1 = __importDefault(require("./routes/credits"));
const logs_1 = __importDefault(require("./routes/logs"));
const metaWebhook_1 = __importDefault(require("./routes/metaWebhook"));
const sseRoutes_1 = __importDefault(require("./routes/sseRoutes"));
const templatesSync_1 = __importDefault(require("./routes/templatesSync"));
const templatesDebug_1 = __importDefault(require("./routes/templatesDebug"));
const auth_2 = require("./middleware/auth");
const rateLimit_1 = require("./config/rateLimit");
(0, errorHandler_1.setupGlobalErrorHandlers)();
const app = (0, express_1.default)();
exports.app = app;
app.set('trust proxy', 1);
app.use(health_1.default);
console.log('[HEALTH] Health endpoints mounted FIRST - always accessible');
app.use('/webhooks', express_1.default.json({
    verify: (req, _res, buf) => {
        req.rawBody = Buffer.from(buf);
    }
}), metaWebhook_1.default);
console.log('[WEBHOOKS] Meta webhook routes mounted at /webhooks/*');
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
const allowedOrigins = [
    'https://primesms.app',
    'http://localhost:5173',
    'http://localhost:3000'
];
app.use((0, cors_1.default)({
    origin: (origin, cb) => {
        if (!origin)
            return cb(null, true);
        return cb(null, allowedOrigins.includes(origin));
    },
    credentials: true
}));
app.use((0, compression_1.default)());
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
        },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));
app.use(rateLimit_1.globalLimiter);
app.use((0, hpp_1.default)({
    whitelist: ['tags', 'categories']
}));
app.use((0, logger_1.createHttpLogger)());
const connectDatabase = async (retries = 5) => {
    try {
        const client = await db_1.default.connect();
        await client.query('SELECT NOW()');
        client.release();
        (0, logger_1.logStartup)('Database connected successfully', {
            host: env_1.env.database.host,
            port: env_1.env.database.port,
            database: env_1.env.database.database
        });
        await createAdminUser();
    }
    catch (error) {
        (0, logger_1.logError)('Database connection failed', error, { retries });
        if (retries > 0) {
            (0, logger_1.logStartup)(`Retrying database connection in 5 seconds... (${retries} attempts left)`);
            setTimeout(() => connectDatabase(retries - 1), 5000);
        }
        else {
            (0, logger_1.logError)('Database connection failed after all retries');
            process.exit(1);
        }
    }
};
const createAdminUser = async () => {
    try {
        const client = await db_1.default.connect();
        const adminCheck = await client.query('SELECT id FROM users WHERE username = $1 LIMIT 1', ['primesms']);
        if (adminCheck.rows.length === 0) {
            await client.query('INSERT INTO users (name, email, username, password, role, credit_balance) VALUES ($1, $2, $3, $4, $5, $6)', ['Prime SMS Admin', 'admin@primesms.app', 'primesms', 'Primesms', 'admin', 999999]);
            (0, logger_1.logStartup)('✅ Admin user created successfully', {
                username: 'primesms',
                email: 'admin@primesms.app'
            });
        }
        else {
            (0, logger_1.logStartup)('ℹ️  Admin user already exists');
        }
        client.release();
    }
    catch (error) {
        (0, logger_1.logError)('Failed to create admin user', error);
    }
};
const ConnectPgSimple = (0, connect_pg_simple_1.default)(express_session_1.default);
const isProd = process.env.NODE_ENV === 'production';
app.use((0, express_session_1.default)({
    store: new ConnectPgSimple({
        pool: db_1.default,
        tableName: 'session',
        createTableIfMissing: true
    }),
    name: 'psid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: isProd ? 'lax' : 'lax',
        secure: isProd,
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
}));
app.use('/api/auth/login', rateLimit_1.loginLimiter);
app.use('/api/auth/forgot-password', rateLimit_1.otpLimiter);
app.use('/api/auth/verify-otp', rateLimit_1.otpLimiter);
app.use('/api/auth/reset-password', rateLimit_1.resetLimiter);
app.use('/api/auth', rateLimit_1.authLimiter, auth_1.default);
app.get('/api/debug/session', rateLimit_1.noLimiter, (req, res) => {
    const s = req.session;
    const sessionData = {
        hasSession: Boolean(req.session),
        userId: s?.userId ?? null,
        sessionId: req.sessionID,
        sessionStore: Boolean(req.sessionStore),
        cookieName: req.session?.cookie ? 'psid' : 'no-cookie',
        cookieSettings: req.session?.cookie,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        headers: {
            authorization: req.get('Authorization'),
            cookie: req.get('Cookie') ? 'present' : 'missing'
        },
        timestamp: new Date().toISOString()
    };
    console.log('🐛 DEBUG SESSION REQUEST:', sessionData);
    res.json(sessionData);
});
app.use('/api/admin', rateLimit_1.adminLimiter, admin_1.default);
app.use('/api/templates', rateLimit_1.readLimiter, templates_1.default);
app.use('/api/logs', rateLimit_1.readLimiter, logs_1.default);
app.use('/api/credits', rateLimit_1.readLimiter, credits_1.default);
app.use('/', rateLimit_1.writeLimiter, templatesSync_1.default);
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEBUG_ROUTES === 'true') {
    app.use('/', rateLimit_1.noLimiter, templatesDebug_1.default);
    console.log('🐛 [DEBUG] Template debug routes enabled');
}
app.use('/api/whatsapp', rateLimit_1.writeLimiter, whatsapp_1.default);
app.use('/api/send', rateLimit_1.writeLimiter, send_1.default);
app.use('/api', sseRoutes_1.default);
app.get('/api', (req, res) => {
    res.json({
        message: 'Prime SMS API',
        version: '1.0.0',
        status: 'operational',
        timestamp: new Date().toISOString(),
        documentation: '/api/health'
    });
});
app.use('/api', (req, res) => {
    return res.status(404).json({ error: 'ROUTE_NOT_FOUND', path: req.originalUrl });
});
app.get('/templates', auth_2.requireAuthWithRedirect, (req, res) => {
    res.redirect('/api/templates');
});
const clientDir = path_1.default.resolve(__dirname, './client-static');
app.use(express_1.default.static(clientDir, {
    index: false,
    maxAge: '1y',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
        else {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
}));
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') ||
        req.path.startsWith('/health')) {
        return next();
    }
    res.sendFile(path_1.default.join(clientDir, 'index.html'));
});
app.use('*', errorHandler_1.notFoundHandler);
app.use(errorHandler_1.errorHandler);
const gracefulShutdown = async (signal) => {
    (0, logger_1.logStartup)(`Received ${signal}. Starting graceful shutdown...`);
    try {
        server.close(async () => {
            (0, logger_1.logStartup)('HTTP server closed');
            try {
                await db_1.default.end();
                (0, logger_1.logStartup)('Database connections closed');
            }
            catch (error) {
                (0, logger_1.logError)('Error closing database connections', error);
            }
            try {
                (0, logger_1.logStartup)('Log cleanup service stopped');
            }
            catch (error) {
                (0, logger_1.logError)('Error stopping cleanup service', error);
            }
            (0, logger_1.logStartup)('Graceful shutdown completed');
            process.exit(0);
        });
        setTimeout(() => {
            (0, logger_1.logError)('Forcing shutdown after timeout');
            process.exit(1);
        }, 10000);
    }
    catch (error) {
        (0, logger_1.logError)('Error during graceful shutdown', error);
        process.exit(1);
    }
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
function printRoutes() {
    const out = [];
    try {
        app._router?.stack?.forEach((layer) => {
            if (layer.route?.path) {
                const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
                out.push(`${methods} ${layer.route.path}`);
            }
            else if (layer.regexp && layer.handle?.stack) {
                const match = layer.regexp.toString().match(/\/\^\\?\/(.*?)\\?\$\//);
                if (match) {
                    out.push(`ROUTER ${match[1].replace(/\\\//g, '/')}`);
                }
            }
        });
        console.log('[ROUTES]', out.slice(0, 20));
    }
    catch (error) {
        console.log('[ROUTES] Error listing routes:', error);
    }
}
const startServer = async () => {
    try {
        await connectDatabase();
        try {
            (0, logger_1.logStartup)('Log cleanup service started');
        }
        catch (error) {
            (0, logger_1.logError)('Error starting cleanup service', error);
        }
        const server = app.listen(env_1.env.port, '0.0.0.0', () => {
            (0, logger_1.logStartup)(`Server started successfully`, {
                host: '0.0.0.0',
                port: env_1.env.port,
                environment: env_1.env.nodeEnv,
                processId: process.pid,
                nodeVersion: process.version,
                memory: process.memoryUsage(),
                corsOrigins: env_1.env.corsOrigins,
                rateLimit: env_1.env.rateLimit,
                healthEndpoints: ['GET /health', 'GET /healthz', 'GET /api/health', 'GET /api/healthz', 'GET /api/health/db']
            });
            console.log(`🏥 Health endpoints available at:`);
            console.log(`   http://0.0.0.0:${env_1.env.port}/health`);
            console.log(`   http://0.0.0.0:${env_1.env.port}/healthz`);
            console.log(`   http://0.0.0.0:${env_1.env.port}/api/health`);
            console.log(`   http://0.0.0.0:${env_1.env.port}/api/healthz`);
            console.log(`   http://0.0.0.0:${env_1.env.port}/api/health/db (deep check)`);
            printRoutes();
        });
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                (0, logger_1.logError)(`Port ${env_1.env.port} is already in use`);
                process.exit(1);
            }
            else {
                (0, logger_1.logError)('Server error', error);
                process.exit(1);
            }
        });
        global.server = server;
    }
    catch (error) {
        (0, logger_1.logError)('Failed to start server', error);
        process.exit(1);
    }
};
const server = global.server;
startServer();
exports.default = app;
//# sourceMappingURL=index.js.map