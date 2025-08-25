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
const send360dialog_1 = __importDefault(require("./routes/send360dialog"));
const bulk360dialog_1 = __importDefault(require("./routes/bulk360dialog"));
const credits_1 = __importDefault(require("./routes/credits"));
const logs_1 = __importDefault(require("./routes/logs"));
const metaWebhook_1 = __importDefault(require("./routes/metaWebhook"));
const webhook360dialog_1 = __importDefault(require("./routes/webhook360dialog"));
const whatsapp360dialog_1 = __importDefault(require("./routes/whatsapp360dialog"));
const sseRoutes_1 = __importDefault(require("./routes/sseRoutes"));
const templatesSync_1 = __importDefault(require("./routes/templatesSync"));
const templatesSync360Dialog_1 = __importDefault(require("./routes/templatesSync360Dialog"));
const templatesDebug_1 = __importDefault(require("./routes/templatesDebug"));
const templatesSyncDirect_1 = __importDefault(require("./routes/templatesSyncDirect"));
const payments_razorpay_routes_1 = __importDefault(require("./routes/payments.razorpay.routes"));
const pricing_routes_1 = __importDefault(require("./routes/pricing.routes"));
const auth_2 = require("./middleware/auth");
const rateLimit_1 = require("./config/rateLimit");
(0, errorHandler_1.setupGlobalErrorHandlers)();
const app = (0, express_1.default)();
exports.app = app;
app.set('trust proxy', 1);
app.use(health_1.default);
console.log('[HEALTH] Health endpoints mounted FIRST - always accessible');
const localClientBuildDir = path_1.default.resolve(__dirname, '../client-build');
const prodClientBuildDir = path_1.default.resolve(process.cwd(), 'client-build');
const staticFallbackDir = path_1.default.resolve(__dirname, '../static-fallback');
let clientDir = staticFallbackDir;
try {
    const fs = require('fs');
    logger_1.logger.info(`🔍 Finding client-build directory:`);
    logger_1.logger.info(`   Working dir: ${process.cwd()}`);
    logger_1.logger.info(`   __dirname: ${__dirname}`);
    const hasAssets = (dir) => {
        const assetsDir = path_1.default.join(dir, 'assets');
        if (!fs.existsSync(assetsDir))
            return false;
        const files = fs.readdirSync(assetsDir);
        return files.some((f) => f.endsWith('.js')) && files.some((f) => f.endsWith('.css'));
    };
    const candidates = [
        { name: 'local client-build', path: localClientBuildDir },
        { name: 'prod client-build', path: prodClientBuildDir }
    ];
    for (const candidate of candidates) {
        logger_1.logger.info(`   Checking ${candidate.name}: ${candidate.path}`);
        if (fs.existsSync(candidate.path) && hasAssets(candidate.path)) {
            clientDir = candidate.path;
            const assetFiles = fs.readdirSync(path_1.default.join(clientDir, 'assets'));
            logger_1.logger.info(`✅ FOUND client-build: ${clientDir}`);
            logger_1.logger.info(`📦 Assets: ${assetFiles.join(', ')}`);
            break;
        }
        else {
            logger_1.logger.info(`   ❌ Not found or no assets`);
        }
    }
    if (clientDir === staticFallbackDir) {
        logger_1.logger.error(`❌ CLIENT-BUILD NOT FOUND! Using fallback.`);
        logger_1.logger.error(`   Make sure to build the client first: npm run build:client`);
    }
}
catch (error) {
    logger_1.logger.error(`❌ Error finding client-build: ${error}`);
}
app.use((req, res, next) => {
    if (req.path.startsWith('/assets')) {
        const fs = require('fs');
        const requestedFile = path_1.default.join(clientDir, req.path);
        const assetsDir = path_1.default.join(clientDir, 'assets');
        logger_1.logger.info(`🎯 Asset request: ${req.method} ${req.path}`);
        logger_1.logger.info(`   Requested file path: ${requestedFile}`);
        logger_1.logger.info(`   Client dir: ${clientDir}`);
        logger_1.logger.info(`   Assets dir exists: ${fs.existsSync(assetsDir)}`);
        logger_1.logger.info(`   Requested file exists: ${fs.existsSync(requestedFile)}`);
        if (fs.existsSync(assetsDir)) {
            const assetFiles = fs.readdirSync(assetsDir);
            logger_1.logger.info(`   Available assets: ${assetFiles.join(', ')}`);
        }
    }
    next();
});
const assetsPath = path_1.default.join(clientDir, 'assets');
const fs = require('fs');
logger_1.logger.info(`🔧 Setting up /assets route with path: ${assetsPath}`);
logger_1.logger.info(`🔧 Assets directory exists: ${fs.existsSync(assetsPath)}`);
app.use('/assets', (req, res, next) => {
    const requestedFile = path_1.default.join(assetsPath, req.path);
    logger_1.logger.info(`📁 /assets middleware: ${req.path} -> ${requestedFile}`);
    if (!fs.existsSync(assetsPath)) {
        logger_1.logger.error(`❌ Assets directory not found: ${assetsPath}`);
        return res.status(404).json({
            error: 'Assets directory not found',
            path: req.path,
            assetsPath: assetsPath
        });
    }
    const fileExt = path_1.default.extname(req.path);
    if (!fs.existsSync(requestedFile) && (fileExt === '.js' || fileExt === '.css')) {
        logger_1.logger.warn(`⚠️ Asset not found: ${req.path}. Trying to find a matching file...`);
        try {
            const files = fs.readdirSync(assetsPath);
            const matchingFile = files.find((file) => path_1.default.extname(file) === fileExt);
            if (matchingFile) {
                logger_1.logger.info(`✅ Found matching ${fileExt} file: ${matchingFile}`);
                return res.sendFile(path_1.default.join(assetsPath, matchingFile), {
                    headers: {
                        'Content-Type': fileExt === '.js' ? 'application/javascript; charset=utf-8' : 'text/css; charset=utf-8',
                        'Cache-Control': 'public, max-age=31536000, immutable'
                    }
                });
            }
        }
        catch (error) {
            logger_1.logger.error(`❌ Error finding matching file: ${error}`);
        }
    }
    next();
}, express_1.default.static(assetsPath, {
    maxAge: '1y',
    immutable: true,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            logger_1.logger.info(`✅ Serving JS asset: ${path_1.default.basename(filePath)}`);
        }
        else if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css; charset=utf-8');
            logger_1.logger.info(`✅ Serving CSS asset: ${path_1.default.basename(filePath)}`);
        }
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
}));
console.log('[STATIC] Asset serving mounted SECOND - before all other middleware');
app.use('/webhooks', express_1.default.json({
    verify: (req, _res, buf) => {
        req.rawBody = Buffer.from(buf);
    }
}), metaWebhook_1.default);
console.log('[WEBHOOKS] Meta webhook routes mounted at /webhooks/*');
app.use('/webhooks', webhook360dialog_1.default);
console.log('[WEBHOOKS] 360dialog webhook routes mounted at /webhooks/360dialog/*');
app.use('/api/payments/razorpay/webhook', payments_razorpay_routes_1.default);
console.log('[PAYMENTS] Razorpay webhook route mounted with raw body parsing');
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
            scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
            frameSrc: ["'self'", 'https://api.razorpay.com'],
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
        maxAge: 10 * 60 * 1000
    }
}));
app.use((req, res, next) => {
    const skipPaths = ['/health', '/webhooks', '/api/debug', '.js', '.css', '.png', '.jpg', '.ico'];
    const shouldSkip = skipPaths.some(path => req.path.includes(path));
    if (shouldSkip) {
        return next();
    }
    if (req.session && req.session.user) {
        const sessionData = req.session;
        if (sessionData.lastActivity && (Date.now() - sessionData.lastActivity) > (10 * 60 * 1000)) {
            console.log(`🕐 Session expired for user ${sessionData.user?.username || 'unknown'} after 10 minutes of inactivity`);
            req.session.destroy((err) => {
                if (err) {
                    console.error('Session destruction error:', err);
                }
                res.status(401).json({
                    error: 'Session expired due to inactivity',
                    code: 'SESSION_EXPIRED',
                    redirect: '/login'
                });
            });
            return;
        }
    }
    next();
});
app.use('/api/auth/login', rateLimit_1.loginLimiter);
app.use('/api/auth/forgot-password', rateLimit_1.otpLimiter);
app.use('/api/auth/verify-otp', rateLimit_1.otpLimiter);
app.use('/api/auth/reset-password', rateLimit_1.resetLimiter);
app.use('/api/auth', rateLimit_1.authLimiter, auth_1.default);
app.get('/api/debug/files', rateLimit_1.noLimiter, (req, res) => {
    const fs = require('fs');
    const debugInfo = {
        clientDir,
        directories: {},
        files: {}
    };
    const dirsToCheck = [
        { name: 'clientStaticDir', path: path_1.default.resolve(__dirname, './client-static') },
        { name: 'clientBuildDir', path: path_1.default.resolve(__dirname, '../client-build') },
        { name: 'cwdClientStaticDir', path: path_1.default.resolve(process.cwd(), 'dist/client-static') },
        { name: 'cwdClientBuildDir', path: path_1.default.resolve(process.cwd(), 'client-build') },
        { name: 'preBuiltClientDir', path: path_1.default.resolve(__dirname, '../pre-built-client') },
        { name: 'staticFallbackDir', path: path_1.default.resolve(__dirname, '../static-fallback') },
        { name: 'currentClientDir', path: clientDir }
    ];
    for (const dir of dirsToCheck) {
        debugInfo.directories[dir.name] = {
            path: dir.path,
            exists: fs.existsSync(dir.path),
            contents: fs.existsSync(dir.path) ? fs.readdirSync(dir.path) : []
        };
        const assetsPath = path_1.default.join(dir.path, 'assets');
        if (fs.existsSync(assetsPath)) {
            debugInfo.files[`${dir.name}_assets`] = fs.readdirSync(assetsPath);
        }
    }
    res.json(debugInfo);
});
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
app.use('/api/admin/pricing', rateLimit_1.adminLimiter, pricing_routes_1.default);
app.use('/api/admin/whatsapp', rateLimit_1.adminLimiter, whatsapp360dialog_1.default);
app.use('/api/templates', rateLimit_1.readLimiter, templates_1.default);
app.use('/api/logs', rateLimit_1.readLimiter, logs_1.default);
app.use('/api/credits', rateLimit_1.readLimiter, credits_1.default);
app.use('/', rateLimit_1.writeLimiter, templatesSync_1.default);
app.use('/', rateLimit_1.writeLimiter, templatesSync360Dialog_1.default);
app.use('/', rateLimit_1.writeLimiter, templatesSyncDirect_1.default);
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEBUG_ROUTES === 'true') {
    app.use('/', rateLimit_1.noLimiter, templatesDebug_1.default);
    console.log('🐛 [DEBUG] Template debug routes enabled');
}
app.use('/api/whatsapp', rateLimit_1.writeLimiter, whatsapp_1.default);
app.use('/api/send', rateLimit_1.writeLimiter, send_1.default);
app.use('/api/send360dialog', rateLimit_1.writeLimiter, send360dialog_1.default);
app.use('/api/bulk360dialog', rateLimit_1.writeLimiter, bulk360dialog_1.default);
app.use('/api/payments/razorpay', rateLimit_1.writeLimiter, payments_razorpay_routes_1.default);
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
app.get('/refresh', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const indexPath = path_1.default.join(clientDir, 'index.html');
    try {
        let indexContent = fs.readFileSync(indexPath, 'utf8');
        const assetsDir = path_1.default.join(clientDir, 'assets');
        if (fs.existsSync(assetsDir)) {
            const files = fs.readdirSync(assetsDir);
            const jsFile = files.find((file) => file.endsWith('.js'));
            const cssFile = files.find((file) => file.endsWith('.css'));
            if (jsFile && cssFile) {
                indexContent = indexContent
                    .replace(/src="\/assets\/.*?\.js"/g, `src="/assets/${jsFile}"`)
                    .replace(/href="\/assets\/.*?\.css"/g, `href="/assets/${cssFile}"`);
                logger_1.logger.info(`✅ Modified refresh index.html to use available assets: JS=${jsFile}, CSS=${cssFile}`);
            }
        }
        res.send(indexContent);
    }
    catch (error) {
        logger_1.logger.error(`❌ Error serving modified index.html: ${error}`);
        res.sendFile(indexPath);
    }
});
app.get('/debug-assets', (req, res) => {
    const assetsDir = path_1.default.join(clientDir, 'assets');
    const indexPath = path_1.default.join(clientDir, 'index.html');
    const result = {
        clientDir,
        assetsPath,
        assetsExists: fs.existsSync(assetsDir),
        indexExists: fs.existsSync(indexPath),
        availableAssets: [],
        indexContents: '',
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
    };
    if (result.assetsExists) {
        result.availableAssets = fs.readdirSync(assetsDir);
    }
    if (result.indexExists) {
        result.indexContents = fs.readFileSync(indexPath, 'utf8');
    }
    res.json(result);
});
app.use('/api', (req, res) => {
    return res.status(404).json({ error: 'ROUTE_NOT_FOUND', path: req.originalUrl });
});
app.get('/templates', auth_2.requireAuthWithRedirect, (req, res) => {
    res.redirect('/api/templates');
});
const assetsDir = path_1.default.join(__dirname, '../public/assets');
app.use('/assets', express_1.default.static(assetsDir, {
    maxAge: '7d',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
            res.setHeader('Content-Type', 'image/jpeg');
        }
        else if (filePath.endsWith('.pdf')) {
            res.setHeader('Content-Type', 'application/pdf');
        }
        else if (filePath.endsWith('.mp4')) {
            res.setHeader('Content-Type', 'video/mp4');
        }
        res.setHeader('Cache-Control', 'public, max-age=604800');
    }
}));
app.use(express_1.default.static(clientDir, {
    index: false,
    maxAge: '1y',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        else if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css; charset=utf-8');
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        else if (filePath.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
        else if (filePath.endsWith('.svg')) {
            res.setHeader('Content-Type', 'image/svg+xml');
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        else if (filePath.endsWith('.png')) {
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        else if (filePath.endsWith('.ico')) {
            res.setHeader('Content-Type', 'image/x-icon');
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        else {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
}));
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') ||
        req.path.startsWith('/health') ||
        req.path.startsWith('/assets') ||
        req.path.includes('.js') ||
        req.path.includes('.css') ||
        req.path.includes('.svg') ||
        req.path.includes('.png') ||
        req.path.includes('.jpg') ||
        req.path.includes('.ico')) {
        logger_1.logger.info(`Skipping SPA fallback for: ${req.path}`);
        return next();
    }
    logger_1.logger.info(`Serving SPA fallback for: ${req.path}`);
    const indexPath = path_1.default.join(clientDir, 'index.html');
    try {
        let indexContent = fs.readFileSync(indexPath, 'utf8');
        const assetsDir = path_1.default.join(clientDir, 'assets');
        if (fs.existsSync(assetsDir)) {
            const files = fs.readdirSync(assetsDir);
            const jsFile = files.find((file) => file.endsWith('.js'));
            const cssFile = files.find((file) => file.endsWith('.css'));
            if (jsFile && cssFile) {
                indexContent = indexContent
                    .replace(/src="\/assets\/.*?\.js"/g, `src="/assets/${jsFile}"`)
                    .replace(/href="\/assets\/.*?\.css"/g, `href="/assets/${cssFile}"`);
                logger_1.logger.info(`✅ Modified index.html to use available assets: JS=${jsFile}, CSS=${cssFile}`);
            }
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.send(indexContent);
    }
    catch (error) {
        logger_1.logger.error(`❌ Error serving modified index.html: ${error}`);
        res.sendFile(indexPath);
    }
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