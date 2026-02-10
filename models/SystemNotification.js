import mongoose from 'mongoose';

const systemNotification = new mongoose.Schema({
    title: { type: String, required: true },
    text: { type: String },
    readedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    link: { type: String },
    paramsStringify: { type: String },
    specificUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.model('SystemNotification', systemNotification);