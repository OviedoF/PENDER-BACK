import mongoose from 'mongoose';

const CommunityComment = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    respondsTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
    community: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true },
    comment: { type: String, required: true },
    date: { type: Date, default: Date.now },
    likes: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    dislikes: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    deletedAt: { type: Date, default: null }
}, { timestamps: true });

export default mongoose.model('CommunityComment', CommunityComment);
