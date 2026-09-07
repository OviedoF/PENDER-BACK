import mongoose from 'mongoose';

// Override editable desde el admin para los pop-ups de sistema generados por eventos.
// Si no hay documento para un evento, se usa el texto por defecto definido en
// utils/createSystemNotification.js (SYSTEM_NOTIFICATION_EVENTS).
const systemNotificationTemplate = new mongoose.Schema({
    event: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    text: { type: String, default: '' },
    active: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('SystemNotificationTemplate', systemNotificationTemplate);
