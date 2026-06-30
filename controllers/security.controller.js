import Report from '../models/Report.js';
import IpBlacklist from '../models/IpBlacklist.js';
import ActivityLog from '../models/ActivityLog.js';
import AdoptionReport from '../models/AdoptionReport.js';
import Adoption from '../models/Adoption.js';
import CommunityComment from '../models/CommunityComment.js';
import ForumComment from '../models/forumComment.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import createUserNotification from '../utils/createUserNotification.js';
dotenv.config();

const verifyAdmin = async (req) => {
    const token = req.headers.authorization.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ _id: payload.id });
    if (!user || !['admin', 'moderator'].includes(user.role)) throw new Error('No tienes permisos de administrador');
    return user;
};

const logActivity = async (actor, actorRole, action, targetType, targetId, targetLabel, details, ip) => {
    const log = new ActivityLog({ actor, actorRole, action, targetType, targetId, targetLabel, details, ip });
    await log.save();
};

const SecurityController = {};

// ─── PUBLIC: Submit report ───────────────────────────────────────────────────

SecurityController.submitReport = async (req, res) => {
    try {
        const { reportedEntity, reportedEntityType, reason, description, evidence } = req.body;
        if (!reportedEntity || !reportedEntityType || !reason) {
            return res.status(400).json({ message: 'Campos requeridos: reportedEntity, reportedEntityType, reason' });
        }

        let reportedBy = null;
        try {
            const token = req.headers.authorization?.split(' ')[1];
            if (token) {
                const payload = jwt.verify(token, process.env.JWT_SECRET);
                reportedBy = payload.id;
            }
        } catch (_) { /* anonymous report */ }

        const targetUser = await User.findById(reportedEntity);
        if (!targetUser) return res.status(404).json({ message: 'Entidad reportada no encontrada' });

        const report = new Report({
            reportedEntity,
            reportedEntityType,
            reportedBy,
            reason,
            description: description || null,
            evidence: evidence || [],
        });
        await report.save();

        await logActivity(reportedBy, reportedBy ? 'user' : 'system', 'submit_report', 'report', report._id.toString(), `${targetUser.firstName ?? ''} ${targetUser.lastName ?? ''}`.trim(), `Reporte: ${reason}`, req.ip);

        res.status(201).json({ message: 'Reporte enviado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─── ADMIN: User Reports ─────────────────────────────────────────────────────

SecurityController.adminGetUserReports = async (req, res) => {
    try {
        await verifyAdmin(req);
        const { page = 1, status, reason, search } = req.query;
        const limit = 20;
        const skip = (Number(page) - 1) * limit;

        const filter = { reportedEntityType: 'usuario' };
        if (status) filter.status = status;
        if (reason) filter.reason = reason;
        if (search && search.trim()) {
            filter.description = new RegExp(search, 'i');
        }

        const [reports, total] = await Promise.all([
            Report.find(filter)
                .populate('reportedEntity', 'firstName lastName email image role banned suspendedTo')
                .populate('reportedBy', 'firstName lastName email image')
                .populate('resolvedBy', 'firstName lastName email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Report.countDocuments(filter),
        ]);

        res.status(200).json({ reports, total, page: Number(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─── ADMIN: Enterprise Reports ───────────────────────────────────────────────

SecurityController.adminGetEnterpriseReports = async (req, res) => {
    try {
        await verifyAdmin(req);
        const { page = 1, status, reason, search } = req.query;
        const limit = 20;
        const skip = (Number(page) - 1) * limit;

        const filter = { reportedEntityType: 'empresa' };
        if (status) filter.status = status;
        if (reason) filter.reason = reason;
        if (search && search.trim()) {
            filter.description = new RegExp(search, 'i');
        }

        const [reports, total] = await Promise.all([
            Report.find(filter)
                .populate('reportedEntity', 'firstName lastName email image role commercialName banned suspendedTo')
                .populate('reportedBy', 'firstName lastName email image')
                .populate('resolvedBy', 'firstName lastName email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Report.countDocuments(filter),
        ]);

        res.status(200).json({ reports, total, page: Number(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─── ADMIN: Resolve Report ───────────────────────────────────────────────────

SecurityController.adminResolveReport = async (req, res) => {
    try {
        const admin = await verifyAdmin(req);
        const { status, resolution, action } = req.body;
        if (!['resolved', 'dismissed'].includes(status)) {
            return res.status(400).json({ message: 'Estado invalido. Usa resolved o dismissed' });
        }

        const report = await Report.findById(req.params.id).populate('reportedEntity', 'firstName lastName email');
        if (!report) return res.status(404).json({ message: 'Reporte no encontrado' });

        report.status = status;
        report.resolution = resolution || null;
        report.action = action || null;
        report.resolvedAt = new Date();
        report.resolvedBy = admin._id;
        await report.save();

        if (status === 'resolved' && action) {
            const targetUser = await User.findById(report.reportedEntity._id);
            if (targetUser) {
                if (action === 'banned') {
                    targetUser.banned = true;
                    await targetUser.save();
                    await createUserNotification(targetUser._id, 'Cuenta baneada', 'Tu cuenta ha sido baneada por violar las normas de la comunidad.', '');
                } else if (action === 'suspended') {
                    const suspendDate = new Date();
                    suspendDate.setDate(suspendDate.getDate() + 7);
                    targetUser.suspendedTo = suspendDate;
                    await targetUser.save();
                    await createUserNotification(targetUser._id, 'Cuenta suspendida', 'Tu cuenta ha sido suspendida temporalmente por 7 dias.', '');
                } else if (action === 'warned') {
                    await createUserNotification(targetUser._id, 'Advertencia', 'Has recibido una advertencia por comportamiento inapropiado. Por favor revisa las normas de la comunidad.', '');
                }
            }
        }

        await logActivity(admin._id, 'admin', 'resolve_report', 'report', report._id.toString(), report.reportedEntity?.email || '', `${status} - ${action || 'sin accion'}`, req.ip);

        res.status(200).json(report);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// ─── ADMIN: Content Reports (Unified) ────────────────────────────────────────

SecurityController.adminGetContentReports = async (req, res) => {
    try {
        await verifyAdmin(req);
        const { page = 1, source, reason } = req.query;
        const limit = 20;
        const skip = (Number(page) - 1) * limit;

        const results = [];

        if (!source || source === 'adoption') {
            const adoptionFilter = {};
            if (reason) adoptionFilter.reason = reason;
            const adoptionReports = await AdoptionReport.find(adoptionFilter)
                .populate('adoption', 'nombre especie imagen ciudad departamento status')
                .populate('reportedBy', 'firstName lastName email')
                .sort({ createdAt: -1 });

            for (const r of adoptionReports) {
                results.push({
                    _id: r._id.toString(),
                    source: 'adoption',
                    content: r.adoption ? `${r.adoption.nombre} (${r.adoption.especie})` : 'Eliminado',
                    reason: r.reason,
                    reportCount: 1,
                    reportedBy: r.reportedBy ? `${r.reportedBy.firstName ?? ''} ${r.reportedBy.lastName ?? ''}`.trim() : 'Anonimo',
                    createdAt: r.createdAt,
                    status: r.status,
                    originalId: r._id,
                });
            }
        }

        if (!source || source === 'community') {
            const communityComments = await CommunityComment.find({
                'reports.0': { $exists: true },
                deletedAt: null,
            })
                .populate('user', 'firstName lastName email')
                .populate('community', 'name')
                .sort({ createdAt: -1 });

            for (const c of communityComments) {
                const filteredReports = reason ? c.reports.filter(r => r.reason === reason) : c.reports;
                if (filteredReports.length === 0) continue;
                results.push({
                    _id: `community_${c._id.toString()}`,
                    source: 'community',
                    content: c.comment.substring(0, 100) + (c.comment.length > 100 ? '...' : ''),
                    reason: filteredReports[0].reason,
                    reportCount: filteredReports.length,
                    reportedBy: c.user ? `${c.user.firstName ?? ''} ${c.user.lastName ?? ''}`.trim() : 'Desconocido',
                    createdAt: filteredReports[filteredReports.length - 1].createdAt,
                    status: 'pending',
                    originalId: c._id,
                });
            }
        }

        if (!source || source === 'forum') {
            const forumComments = await ForumComment.find({
                'reports.0': { $exists: true },
                deletedAt: null,
            })
                .populate('user', 'firstName lastName email')
                .populate('forum', 'title')
                .sort({ createdAt: -1 });

            for (const f of forumComments) {
                const filteredReports = reason ? f.reports.filter(r => r.reason === reason) : f.reports;
                if (filteredReports.length === 0) continue;
                results.push({
                    _id: `forum_${f._id.toString()}`,
                    source: 'forum',
                    content: f.comment.substring(0, 100) + (f.comment.length > 100 ? '...' : ''),
                    reason: filteredReports[0].reason,
                    reportCount: filteredReports.length,
                    reportedBy: f.user ? `${f.user.firstName ?? ''} ${f.user.lastName ?? ''}`.trim() : 'Desconocido',
                    createdAt: filteredReports[filteredReports.length - 1].createdAt,
                    status: 'pending',
                    originalId: f._id,
                });
            }
        }

        results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const total = results.length;
        const paged = results.slice(skip, skip + limit);

        res.status(200).json({ reports: paged, total, page: Number(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

SecurityController.adminGetContentReportsStats = async (req, res) => {
    try {
        await verifyAdmin(req);

        const [adoptionCount, communityCount, forumCount] = await Promise.all([
            AdoptionReport.countDocuments({}),
            CommunityComment.countDocuments({ 'reports.0': { $exists: true }, deletedAt: null }),
            ForumComment.countDocuments({ 'reports.0': { $exists: true }, deletedAt: null }),
        ]);

        const adoptionByReason = await AdoptionReport.aggregate([
            { $group: { _id: '$reason', count: { $sum: 1 } } },
        ]);

        const bySource = { adoption: adoptionCount, community: communityCount, forum: forumCount };
        const byReason = {};
        for (const r of adoptionByReason) {
            byReason[r._id] = r.count;
        }

        res.status(200).json({ bySource, byReason, total: adoptionCount + communityCount + forumCount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─── ADMIN: Anti-Fraud ───────────────────────────────────────────────────────

SecurityController.adminGetFraudDashboard = async (req, res) => {
    try {
        await verifyAdmin(req);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [totalFraudFlags, recentFraudFlags, highReportAdoptions, fraudReports] = await Promise.all([
            Adoption.countDocuments({ fraudFlag: true, deletedAt: null }),
            Adoption.countDocuments({ fraudFlag: true, deletedAt: null, updatedAt: { $gte: thirtyDaysAgo } }),
            Adoption.find({ deletedAt: null, reportsCount: { $gte: 2 } })
                .populate('user', 'firstName lastName email')
                .sort({ reportsCount: -1 })
                .limit(20),
            AdoptionReport.countDocuments({ reason: 'fraude' }),
        ]);

        const suspiciousUsersCount = await User.countDocuments({
            banned: false,
            deletedAt: null,
            $or: [
                { suspendedTo: { $gte: new Date() } },
            ],
        });

        res.status(200).json({
            totalFraudFlags,
            recentFraudFlags,
            suspiciousUsersCount,
            fraudReports,
            highReportAdoptions,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

SecurityController.adminGetSuspiciousUsers = async (req, res) => {
    try {
        await verifyAdmin(req);
        const { page = 1 } = req.query;
        const limit = 20;
        const skip = (Number(page) - 1) * limit;

        const users = await User.find({ deletedAt: null, role: { $in: ['user', 'enterprise'] } }, 'firstName lastName email image role banned suspendedTo createdAt');

        const results = [];
        for (const user of users) {
            const adoptions = await Adoption.find({ user: user._id });
            const adoptadas = adoptions.filter(a => a.adopted).length;
            const rechazadas = adoptions.filter(a => a.status === 'rejected').length;
            const fraudes = adoptions.filter(a => a.fraudFlag).length;
            const totalReportes = adoptions.reduce((acc, a) => acc + (a.reportsCount || 0), 0);

            let score = 100;
            score += Math.min(adoptadas * 10, 50);
            score -= fraudes * 30;
            score -= Math.min(totalReportes * 5, 40);
            score -= rechazadas * 5;
            score = Math.max(0, Math.min(100, score));

            if (score < 60) {
                const nivel = score >= 50 ? 'Regular' : 'Sospechoso';
                results.push({
                    _id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    image: user.image,
                    role: user.role,
                    banned: user.banned,
                    suspendedTo: user.suspendedTo,
                    reputation: { score, nivel, fraudes, totalReportes, rechazadas, adoptadas },
                });
            }
        }

        results.sort((a, b) => a.reputation.score - b.reputation.score);
        const total = results.length;
        const paged = results.slice(skip, skip + limit);

        res.status(200).json({ users: paged, total, page: Number(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

SecurityController.adminFlagUser = async (req, res) => {
    try {
        const admin = await verifyAdmin(req);
        const { userId } = req.params;
        const { reason } = req.body;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

        await createUserNotification(user._id, 'Cuenta marcada para revision', 'Tu cuenta ha sido marcada para revision por actividad sospechosa.', '');

        await logActivity(admin._id, 'admin', 'flag_user', 'user', user._id.toString(), `${user.firstName} ${user.lastName}`, reason || 'Actividad sospechosa', req.ip);

        res.status(200).json({ message: 'Usuario marcado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─── ADMIN: Spam Detection ───────────────────────────────────────────────────

SecurityController.adminDetectSpam = async (req, res) => {
    try {
        await verifyAdmin(req);
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

        const rapidCommunity = await CommunityComment.aggregate([
            { $match: { createdAt: { $gte: tenMinutesAgo }, deletedAt: null } },
            { $group: { _id: '$user', count: { $sum: 1 } } },
            { $match: { count: { $gte: 5 } } },
            { $sort: { count: -1 } },
        ]);

        const rapidForum = await ForumComment.aggregate([
            { $match: { createdAt: { $gte: tenMinutesAgo }, deletedAt: null } },
            { $group: { _id: '$user', count: { $sum: 1 } } },
            { $match: { count: { $gte: 5 } } },
            { $sort: { count: -1 } },
        ]);

        const rapidUserIds = [...rapidCommunity, ...rapidForum].map(r => r._id);
        const rapidUsers = await User.find({ _id: { $in: rapidUserIds } }, 'firstName lastName email image');
        const rapidUsersMap = {};
        for (const u of rapidUsers) { rapidUsersMap[u._id.toString()] = u; }

        const rapidPosters = [...rapidCommunity, ...rapidForum].map(r => ({
            user: rapidUsersMap[r._id.toString()] || { _id: r._id, email: 'Desconocido' },
            count: r.count,
            period: '10 minutos',
        }));

        const duplicateCommunity = await CommunityComment.aggregate([
            { $match: { deletedAt: null } },
            { $group: { _id: '$comment', count: { $sum: 1 }, userIds: { $addToSet: '$user' } } },
            { $match: { count: { $gte: 3 } } },
            { $sort: { count: -1 } },
            { $limit: 20 },
        ]);

        const duplicateForum = await ForumComment.aggregate([
            { $match: { deletedAt: null } },
            { $group: { _id: '$comment', count: { $sum: 1 }, userIds: { $addToSet: '$user' } } },
            { $match: { count: { $gte: 3 } } },
            { $sort: { count: -1 } },
            { $limit: 20 },
        ]);

        const duplicateContent = [...duplicateCommunity, ...duplicateForum].map(d => ({
            text: d._id.substring(0, 100) + (d._id.length > 100 ? '...' : ''),
            count: d.count,
            userIds: d.userIds.map(id => id.toString()),
        }));

        const spamReportedCommunity = await CommunityComment.find({
            'reports.reason': 'spam',
            deletedAt: null,
        })
            .populate('user', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .limit(20);

        const spamReportedForum = await ForumComment.find({
            'reports.reason': 'spam',
            deletedAt: null,
        })
            .populate('user', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .limit(20);

        const spamReported = [
            ...spamReportedCommunity.map(c => ({
                _id: c._id,
                source: 'community',
                content: c.comment.substring(0, 100),
                user: c.user,
                reportCount: c.reports.filter(r => r.reason === 'spam').length,
                createdAt: c.createdAt,
            })),
            ...spamReportedForum.map(f => ({
                _id: f._id,
                source: 'forum',
                content: f.comment.substring(0, 100),
                user: f.user,
                reportCount: f.reports.filter(r => r.reason === 'spam').length,
                createdAt: f.createdAt,
            })),
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const suspiciousPattern = /(https?:\/\/[^\s]+|www\.[^\s]+|[\w.+-]+@[\w-]+\.[\w.]+|\+?\d[\d\s\-]{7,})/i;

        const suspiciousCommunity = await CommunityComment.find({
            deletedAt: null,
            comment: { $regex: suspiciousPattern },
        })
            .populate('user', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .limit(20);

        const suspiciousForum = await ForumComment.find({
            deletedAt: null,
            comment: { $regex: suspiciousPattern },
        })
            .populate('user', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .limit(20);

        const suspiciousContent = [
            ...suspiciousCommunity.map(c => ({
                _id: c._id,
                source: 'community',
                content: c.comment.substring(0, 150),
                user: c.user,
                createdAt: c.createdAt,
            })),
            ...suspiciousForum.map(f => ({
                _id: f._id,
                source: 'forum',
                content: f.comment.substring(0, 150),
                user: f.user,
                createdAt: f.createdAt,
            })),
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.status(200).json({ rapidPosters, duplicateContent, spamReported, suspiciousContent });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

SecurityController.adminRemoveSpam = async (req, res) => {
    try {
        const admin = await verifyAdmin(req);
        const { commentId } = req.params;
        const { source } = req.body;

        let comment;
        if (source === 'forum') {
            comment = await ForumComment.findOneAndUpdate({ _id: commentId }, { deletedAt: new Date() }, { new: true });
        } else {
            comment = await CommunityComment.findOneAndUpdate({ _id: commentId }, { deletedAt: new Date() }, { new: true });
        }

        if (!comment) return res.status(404).json({ message: 'Comentario no encontrado' });

        await logActivity(admin._id, 'admin', 'remove_spam', 'comment', commentId, comment.comment?.substring(0, 50) || '', `Eliminado como spam (${source || 'community'})`, req.ip);

        res.status(200).json({ message: 'Spam eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─── ADMIN: IP Recommendations ──────────────────────────────────────────────

SecurityController.adminGetIpRecommendations = async (req, res) => {
    try {
        await verifyAdmin(req);

        const reportedUserIds = await Report.aggregate([
            { $match: { status: { $in: ['pending', 'reviewing', 'resolved'] } } },
            { $group: { _id: '$reportedEntity', reportCount: { $sum: 1 } } },
            { $match: { reportCount: { $gte: 2 } } },
            { $sort: { reportCount: -1 } },
            { $limit: 20 },
        ]);

        const userIds = reportedUserIds.map(r => r._id);
        const Login = (await import('../models/Login.js')).default;

        const logins = await Login.find({
            user: { $in: userIds },
            ip: { $ne: null },
        })
            .populate('user', 'firstName lastName email')
            .sort({ createdAt: -1 });

        const ipMap = {};
        for (const login of logins) {
            if (!login.ip) continue;
            const key = login.ip;
            if (!ipMap[key]) {
                ipMap[key] = { ip: key, users: [], loginCount: 0 };
            }
            ipMap[key].loginCount++;
            const userId = login.user?._id?.toString();
            if (userId && !ipMap[key].users.some(u => u._id?.toString() === userId)) {
                const reportData = reportedUserIds.find(r => r._id.toString() === userId);
                ipMap[key].users.push({
                    ...login.user.toObject(),
                    reportCount: reportData?.reportCount || 0,
                });
            }
        }

        const existingBlacklist = await IpBlacklist.find({ active: true }, 'ip');
        const blacklistedIps = new Set(existingBlacklist.map(b => b.ip));

        const recommendations = Object.values(ipMap)
            .filter(r => !blacklistedIps.has(r.ip))
            .sort((a, b) => b.users.reduce((s, u) => s + u.reportCount, 0) - a.users.reduce((s, u) => s + u.reportCount, 0))
            .slice(0, 10);

        res.status(200).json({ recommendations });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─── ADMIN: IP Blacklist ─────────────────────────────────────────────────────

SecurityController.adminGetIpBlacklist = async (req, res) => {
    try {
        await verifyAdmin(req);
        const { page = 1, search } = req.query;
        const limit = 20;
        const skip = (Number(page) - 1) * limit;

        const filter = {};
        if (search && search.trim()) {
            filter.ip = new RegExp(search, 'i');
        }

        const [entries, total] = await Promise.all([
            IpBlacklist.find(filter)
                .populate('createdBy', 'firstName lastName email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            IpBlacklist.countDocuments(filter),
        ]);

        res.status(200).json({ entries, total, page: Number(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

SecurityController.adminCreateIpBlacklist = async (req, res) => {
    try {
        const admin = await verifyAdmin(req);
        const { ip, reason, expiresAt } = req.body;
        if (!ip || !reason) return res.status(400).json({ message: 'IP y razon son requeridos' });

        const existing = await IpBlacklist.findOne({ ip });
        if (existing) return res.status(409).json({ message: 'Esta IP ya esta en la lista negra' });

        const entry = new IpBlacklist({
            ip,
            reason,
            expiresAt: expiresAt || null,
            createdBy: admin._id,
        });
        await entry.save();

        await logActivity(admin._id, 'admin', 'blacklist_ip', 'ip', entry._id.toString(), ip, reason, req.ip);

        res.status(201).json(entry);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

SecurityController.adminUpdateIpBlacklist = async (req, res) => {
    try {
        const admin = await verifyAdmin(req);
        const { reason, expiresAt, active } = req.body;

        const entry = await IpBlacklist.findById(req.params.id);
        if (!entry) return res.status(404).json({ message: 'Entrada no encontrada' });

        if (reason !== undefined) entry.reason = reason;
        if (expiresAt !== undefined) entry.expiresAt = expiresAt;
        if (active !== undefined) entry.active = active;
        await entry.save();

        await logActivity(admin._id, 'admin', 'update_blacklist', 'ip', entry._id.toString(), entry.ip, `Actualizado: ${JSON.stringify(req.body)}`, req.ip);

        res.status(200).json(entry);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

SecurityController.adminDeleteIpBlacklist = async (req, res) => {
    try {
        const admin = await verifyAdmin(req);
        const entry = await IpBlacklist.findByIdAndDelete(req.params.id);
        if (!entry) return res.status(404).json({ message: 'Entrada no encontrada' });

        await logActivity(admin._id, 'admin', 'remove_blacklist', 'ip', req.params.id, entry.ip, 'Eliminado de lista negra', req.ip);

        res.status(200).json({ message: 'IP eliminada de la lista negra' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─── ADMIN: Activity Logs ────────────────────────────────────────────────────

SecurityController.adminGetLogs = async (req, res) => {
    try {
        await verifyAdmin(req);
        const { page = 1, action, actorRole, targetType, from, to } = req.query;
        const limit = 30;
        const skip = (Number(page) - 1) * limit;

        const filter = {};
        if (action) filter.action = action;
        if (actorRole) filter.actorRole = actorRole;
        if (targetType) filter.targetType = targetType;
        if (from || to) {
            filter.createdAt = {};
            if (from) filter.createdAt.$gte = new Date(from);
            if (to) filter.createdAt.$lte = new Date(to);
        }

        const [logs, total] = await Promise.all([
            ActivityLog.find(filter)
                .populate('actor', 'firstName lastName email image role')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            ActivityLog.countDocuments(filter),
        ]);

        res.status(200).json({ logs, total, page: Number(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

SecurityController.adminGetLogsStats = async (req, res) => {
    try {
        await verifyAdmin(req);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const [todayCount, weekCount, byAction] = await Promise.all([
            ActivityLog.countDocuments({ createdAt: { $gte: today } }),
            ActivityLog.countDocuments({ createdAt: { $gte: weekAgo } }),
            ActivityLog.aggregate([
                { $group: { _id: '$action', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),
        ]);

        res.status(200).json({ todayCount, weekCount, byAction });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

SecurityController.adminExport = async (req, res) => {
    try {
        await verifyAdmin(req);
        const reports = await Report.find()
            .populate('reporter', 'firstName lastName email')
            .populate('reported', 'firstName lastName email commercialName')
            .select('type reason status resolution createdAt resolvedAt')
            .sort({ createdAt: -1 })
            .limit(5000)
            .lean();
        res.json({ reports });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export default SecurityController;
