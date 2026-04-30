import mongoose from 'mongoose';

const AutomationConfigSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },

    // 1. Encuesta post-recuperación
    surveyEnabled: { type: Boolean, default: true },
    surveyMessage: { type: String, default: '¡Nos alegra que {nombre} haya vuelto! ¿Podrías contarnos cómo fue tu experiencia en Petnder?' },
    surveyDelayMinutes: { type: Number, default: 60 },

    // 2. Notificación premium vencido
    premiumExpiredEnabled: { type: Boolean, default: true },
    premiumExpiredMessage: { type: String, default: 'Tu suscripción {plan} ha vencido. Renueva para seguir disfrutando de los beneficios exclusivos.' },
    premiumReminderEnabled: { type: Boolean, default: true },
    premiumReminderDaysBefore: { type: Number, default: 3 },
    premiumReminderMessage: { type: String, default: 'Tu suscripción {plan} vence en {dias} días. Renueva a tiempo para no perder tus beneficios.' },

    // 3. Reactivación de usuario inactivo
    inactiveEnabled: { type: Boolean, default: true },
    inactiveDays: { type: Number, default: 30 },
    inactiveMessage: { type: String, default: '¡Te extrañamos! Han pasado {dias} días desde tu última visita. Hay novedades esperándote en Petnder.' },
    inactiveRepeatDays: { type: Number, default: 15 },

    // 4. Matching automático (complementa GeoConfig)
    matchingNotifyEnabled: { type: Boolean, default: true },
    matchingMessage: { type: String, default: 'Encontramos una posible coincidencia ({score}%) con tu reporte de {nombre}. ¡Revisala!' },
}, { timestamps: true });

export default mongoose.model('AutomationConfig', AutomationConfigSchema);
