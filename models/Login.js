import mongoose from 'mongoose';

const loginSchema = new mongoose.Schema({
    device: { type: String, required: true },
    date: { type: Date, default: Date.now },
    status: { type: String, enum: ['connected', 'failed'], required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ip: { type: String, default: null },
}, { timestamps: true });

export default mongoose.model('Login', loginSchema);