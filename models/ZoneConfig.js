import mongoose from 'mongoose';

const ZoneConfigSchema = new mongoose.Schema({
    zona: { type: String, required: true, unique: true },
    radio: { type: Number, required: true, default: 5 }, // km
    activo: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('ZoneConfig', ZoneConfigSchema);
