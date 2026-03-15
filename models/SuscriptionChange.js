import mongoose from 'mongoose';

const SuscriptionChangeSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    from: { type: String, required: true },
    to:   { type: String, required: true },
}, { timestamps: true });

export default mongoose.model('SuscriptionChange', SuscriptionChangeSchema);
