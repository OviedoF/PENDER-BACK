import IpBlacklist from '../models/IpBlacklist.js';

let cache = new Map();
let lastRefresh = 0;
const CACHE_TTL = 60_000;

async function refreshCache() {
    const now = Date.now();
    if (now - lastRefresh < CACHE_TTL) return;
    lastRefresh = now;
    const entries = await IpBlacklist.find({ active: true }).select('ip expiresAt');
    cache = new Map();
    for (const e of entries) {
        if (e.expiresAt && new Date(e.expiresAt) < new Date()) continue;
        cache.set(e.ip, e);
    }
}

export default async function ipBlacklistMiddleware(req, res, next) {
    try {
        await refreshCache();
        const clientIp = req.ip || req.connection?.remoteAddress || '';
        const normalizedIp = clientIp.replace(/^::ffff:/, '');

        if (cache.has(normalizedIp)) {
            await IpBlacklist.updateOne(
                { ip: normalizedIp },
                { $inc: { hitCount: 1 }, lastHitAt: new Date() }
            );
            return res.status(403).json({ message: 'Acceso denegado' });
        }
        next();
    } catch {
        next();
    }
}
