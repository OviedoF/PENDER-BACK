import mongoose from 'mongoose';

const IpBlacklistSchema = new mongoose.Schema({
    ip: { type: String, required: true, unique: true },
    reason: { type: String, required: true },
    type: {
        type: String,
        enum: ['manual', 'automatic'],
        default: 'manual',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    expiresAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
    hitCount: { type: Number, default: 0 },
    lastHitAt: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.model('IpBlacklist', IpBlacklistSchema);
