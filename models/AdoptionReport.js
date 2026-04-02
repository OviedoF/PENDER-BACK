import mongoose from 'mongoose';

const AdoptionReportSchema = new mongoose.Schema({
    adoption: { type: mongoose.Schema.Types.ObjectId, ref: 'Adoption', required: true },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reason: {
        type: String,
        required: true,
        enum: ['fraude', 'contenido_inapropiado', 'spam', 'datos_falsos', 'maltrato', 'otro'],
    },
    description: { type: String, default: null },
    status: { type: String, enum: ['pending', 'resolved', 'dismissed'], default: 'pending' },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

export default mongoose.model('AdoptionReport', AdoptionReportSchema);
