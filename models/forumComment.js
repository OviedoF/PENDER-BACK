import mongoose from 'mongoose';

const ForumComment = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    respondsTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
    forum: { type: mongoose.Schema.Types.ObjectId, ref: 'Forum', required: true },
    comment: { type: String, required: true },
    date: { type: Date, default: Date.now },
    likes: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    dislikes: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    reports: [{
        user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reason:    { type: String, enum: ['spam', 'ofensivo', 'inapropiado', 'acoso', 'otro'], default: 'otro' },
        createdAt: { type: Date, default: Date.now },
    }],
    deletedAt: { type: Date, default: null }
}, { timestamps: true });

export default mongoose.model('ForumComment', ForumComment);
