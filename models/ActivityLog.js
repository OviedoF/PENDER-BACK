import mongoose from 'mongoose';

const ActivityLogSchema = new mongoose.Schema({
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: {
        type: String,
        enum: ['user', 'moderator', 'admin', 'enterprise', 'system'],
    },
    action: { type: String, required: true },
    targetType: {
        type: String,
        enum: ['user', 'enterprise', 'adoption', 'community', 'forum', 'comment', 'report', 'ip', 'system'],
    },
    targetId: { type: String, default: null },
    targetLabel: { type: String, default: null },
    details: { type: String, default: null },
    ip: { type: String, default: null },
}, { timestamps: true });

ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ action: 1 });

export default mongoose.model('ActivityLog', ActivityLogSchema);
