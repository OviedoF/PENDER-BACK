import mongoose from 'mongoose';

const ReportSchema = new mongoose.Schema({
    reportedEntity: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reportedEntityType: {
        type: String,
        required: true,
        enum: ['usuario', 'empresa'],
    },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reason: {
        type: String,
        required: true,
        enum: ['comportamiento_abusivo', 'fraude', 'contenido_inapropiado', 'spam', 'suplantacion', 'datos_falsos', 'acoso', 'otro'],
    },
    description: { type: String, default: null },
    evidence: [{ type: String }],
    status: {
        type: String,
        enum: ['pending', 'reviewing', 'resolved', 'dismissed'],
        default: 'pending',
    },
    resolution: { type: String, default: null },
    action: {
        type: String,
        enum: [null, 'warned', 'suspended', 'banned'],
        default: null,
    },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

export default mongoose.model('Report', ReportSchema);
