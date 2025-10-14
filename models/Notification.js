import mongoose from 'mongoose';

const notification = new mongoose.Schema({
    title: { type: String, required: true },
    text: { type: String },
    readed: { type: Boolean, default: false },
    link: { type: String },
    paramsStringify: { type: String },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export default mongoose.model('Notification', notification);