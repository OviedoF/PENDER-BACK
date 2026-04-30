import mongoose from 'mongoose';

const GeoConfigSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },

    // Radio de notificación
    notificationRadiusKm: { type: Number, default: 10 },
    notificationEnabled: { type: Boolean, default: true },

    // Prioridad por cercanía
    proximityEnabled: { type: Boolean, default: true },
    proximityMaxDistanceKm: { type: Number, default: 50 },
    proximityWeight: { type: Number, default: 0.7, min: 0, max: 1 },

    // Matching automático
    matchingEnabled: { type: Boolean, default: true },
    matchingRadiusKm: { type: Number, default: 15 },
    matchingMinScore: { type: Number, default: 60, min: 0, max: 100 },
    matchingSpeciesWeight: { type: Number, default: 40 },
    matchingBreedWeight: { type: Number, default: 25 },
    matchingLocationWeight: { type: Number, default: 20 },
    matchingSizeWeight: { type: Number, default: 15 },
    matchingAutoNotify: { type: Boolean, default: true },
    matchingDaysWindow: { type: Number, default: 30 },
}, { timestamps: true });

export default mongoose.model('GeoConfig', GeoConfigSchema);
