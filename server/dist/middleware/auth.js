"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = exports.requireAuthWithRedirect = exports.requireAuth = void 0;
const db_1 = __importDefault(require("../db"));
const getUserFromSession = async (req) => {
    const session = req.session;
    if (!session?.userId)
        return null;
    try {
        const result = await db_1.default.query('SELECT id, name, email, username, role, credit_balance FROM users WHERE id = $1 LIMIT 1', [session.userId]);
        return result.rows[0] || null;
    }
    catch (error) {
        console.error('Error fetching user from session:', error);
        return null;
    }
};
const requireAuth = async (req, res, next) => {
    const session = req.session;
    console.log('🔐 AUTH CHECK:', {
        path: req.path,
        method: req.method,
        hasSession: Boolean(req.session),
        sessionId: req.sessionID,
        userId: session?.userId,
        hasCookie: Boolean(req.get('Cookie')),
        userAgent: req.get('User-Agent')?.substring(0, 50)
    });
    if (!session?.userId) {
        console.log('❌ AUTH FAILED: No session or userId');
        return res.status(401).json({
            error: 'Authentication required',
            debug: {
                hasSession: Boolean(req.session),
                sessionId: req.sessionID,
                hasCookie: Boolean(req.get('Cookie'))
            }
        });
    }
    const user = await getUserFromSession(req);
    if (!user) {
        console.log('❌ AUTH FAILED: User not found in database for userId:', session.userId);
        return res.status(401).json({
            error: 'Authentication required',
            debug: {
                userId: session.userId,
                userFound: false
            }
        });
    }
    console.log('✅ AUTH SUCCESS:', { userId: user.id, username: user.username });
    req.session.user = user;
    next();
};
exports.requireAuth = requireAuth;
const requireAuthWithRedirect = async (req, res, next) => {
    const session = req.session;
    if (!session?.userId) {
        const isPageRoute = req.headers.accept?.includes('text/html');
        return isPageRoute
            ? res.redirect('/login')
            : res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const user = await getUserFromSession(req);
    if (!user) {
        const isPageRoute = req.headers.accept?.includes('text/html');
        return isPageRoute
            ? res.redirect('/login')
            : res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    req.session.user = user;
    next();
};
exports.requireAuthWithRedirect = requireAuthWithRedirect;
const requireAdmin = async (req, res, next) => {
    const session = req.session;
    if (!session?.userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    const user = await getUserFromSession(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    req.session.user = user;
    next();
};
exports.requireAdmin = requireAdmin;
//# sourceMappingURL=auth.js.map