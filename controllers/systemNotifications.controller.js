import SystemNotification from '../models/SystemNotification.js';
import SystemNotificationTemplate from '../models/SystemNotificationTemplate.js';
import { SYSTEM_NOTIFICATION_EVENTS } from '../utils/createSystemNotification.js';
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

export const getNotificationByUser = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.status(401).json({ error: "Token requerido" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = new mongoose.Types.ObjectId(decoded.id);

        // 🔥 1. Buscar específicas
        let notification = await SystemNotification.findOne({
            specificUser: userId,
            readedBy: { $ne: userId }
        }).sort({ createdAt: 1 });

        // 🔥 2. Buscar globales
        if (!notification) {
            notification = await SystemNotification.findOne({
                $or: [
                    { specificUser: null },
                    { specificUser: { $exists: false } }
                ],
                readedBy: { $ne: userId }
            }).sort({ createdAt: 1 });
        }

        if (!notification) {
            return res.status(204).send();
        }

        // ✅ Marcar como leída para este usuario
        await SystemNotification.updateOne(
            { _id: notification._id },
            { $addToSet: { readedBy: userId } } // evita duplicados
        );

        return res.status(200).json(notification);

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
};

// ─── Admin: historial de pop-ups ─────────────────────────────────────────────

export const adminGetNotifications = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
        const search = (req.query.search || '').trim();

        const filter = {};
        if (search) {
            const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [{ title: regex }, { text: regex }];
        }

        const [notifications, total] = await Promise.all([
            SystemNotification.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('specificUser', 'username email')
                .lean(),
            SystemNotification.countDocuments(filter),
        ]);

        res.status(200).json({
            notifications: notifications.map(({ readedBy, ...n }) => ({
                ...n,
                readCount: readedBy?.length || 0,
            })),
            total,
            page,
            pages: Math.max(Math.ceil(total / limit), 1),
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const adminCreateNotification = async (req, res) => {
    try {
        const { title, text, link } = req.body;
        if (!title?.trim()) return res.status(400).json({ message: 'El título es requerido' });

        const notification = new SystemNotification({
            title: title.trim(),
            text: (text || '').trim(),
            link: link?.trim() || null,
            readedBy: [],
        });
        await notification.save();

        res.status(201).json({ notification });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const adminDeleteNotification = async (req, res) => {
    try {
        const deleted = await SystemNotification.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Not found' });
        res.status(200).json({ message: 'Notificación eliminada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─── Admin: plantillas por evento ────────────────────────────────────────────
// Devuelve el catálogo completo de eventos con el texto vigente
// (override guardado, o el default del código si no fue personalizado).

export const adminGetTemplates = async (req, res) => {
    try {
        const overrides = await SystemNotificationTemplate.find().lean();
        const byEvent = new Map(overrides.map((o) => [o.event, o]));

        const templates = Object.entries(SYSTEM_NOTIFICATION_EVENTS).map(([event, def]) => {
            const override = byEvent.get(event);
            return {
                event,
                label: def.label,
                description: def.description,
                audience: def.audience,
                variables: def.variables,
                defaultTitle: def.title,
                defaultText: def.text,
                title: override?.title ?? def.title,
                text: override?.text ?? def.text,
                active: override?.active ?? true,
                customized: Boolean(override),
            };
        });

        res.status(200).json({ templates });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const adminUpdateTemplate = async (req, res) => {
    try {
        const { event } = req.params;
        const def = SYSTEM_NOTIFICATION_EVENTS[event];
        if (!def) return res.status(404).json({ message: 'Evento desconocido' });

        const { title, text, active } = req.body;
        const current = await SystemNotificationTemplate.findOne({ event });

        const update = {
            title: title !== undefined ? String(title).trim() : (current?.title ?? def.title),
            text: text !== undefined ? String(text).trim() : (current?.text ?? def.text),
            active: active !== undefined ? Boolean(active) : (current?.active ?? true),
        };
        if (!update.title) return res.status(400).json({ message: 'El título no puede quedar vacío' });

        const template = await SystemNotificationTemplate.findOneAndUpdate(
            { event },
            update,
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.status(200).json({ template });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Elimina el override → el evento vuelve al texto por defecto (y queda activo).
export const adminResetTemplate = async (req, res) => {
    try {
        const { event } = req.params;
        if (!SYSTEM_NOTIFICATION_EVENTS[event]) return res.status(404).json({ message: 'Evento desconocido' });

        await SystemNotificationTemplate.findOneAndDelete({ event });
        res.status(200).json({ message: 'Plantilla restaurada al texto original' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
