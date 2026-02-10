import SystemNotification from '../models/SystemNotification.js';
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
