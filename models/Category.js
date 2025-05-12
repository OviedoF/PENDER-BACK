import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    image: { type: String, required: true },
    deletedAt: { type: Date, default: null }
}, { timestamps: true });

export default mongoose.model('Category', CategorySchema);
