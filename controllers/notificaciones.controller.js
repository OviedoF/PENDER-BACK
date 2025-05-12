import Notificacion from '../models/Notificaciones.js';
import jwt from "jsonwebtoken";

export const getUserNotifications = async (req, res) => {
    try {
        const token = req.headers.authorization.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const notifications = await Notificacion.find({ user: decoded.id });
        res.status(200).json(notifications);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: err.message });
    }
}