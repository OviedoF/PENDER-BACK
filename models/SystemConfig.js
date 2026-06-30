import mongoose from 'mongoose';

const SystemConfigSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },

    // Textos legales
    termsAndConditions: { type: String, default: '' },
    privacyPolicy: { type: String, default: '' },

    // Comisión por empresa
    commissionEnabled: { type: Boolean, default: true },
    commissionPercentage: { type: Number, default: 10, min: 0, max: 100 },
    commissionFixedFee: { type: Number, default: 0, min: 0 },

    // Tarifas premium
    premiumEnabled: { type: Boolean, default: true },
    premiumMonthlyPrice: { type: Number, default: 19.99 },
    premiumAnnualPrice: { type: Number, default: 199.90 },
    premiumTrialDays: { type: Number, default: 7 },
    basicMonthlyPrice: { type: Number, default: 9.99 },
    basicAnnualPrice: { type: Number, default: 99.90 },

    // Impuestos
    taxEnabled: { type: Boolean, default: true },
    taxPercentage: { type: Number, default: 18, min: 0, max: 100 },
    taxName: { type: String, default: 'IGV' },

    // Moneda
    currency: { type: String, default: 'PEN' },
    currencySymbol: { type: String, default: 'S/' },

    // Idioma
    defaultLanguage: { type: String, default: 'es' },
    availableLanguages: { type: [String], default: ['es'] },

    // Modo mantenimiento
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: { type: String, default: 'Estamos realizando mantenimiento. Volveremos pronto.' },
    maintenanceScheduledAt: { type: Date, default: null },
    maintenanceEstimatedEnd: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.model('SystemConfig', SystemConfigSchema);
