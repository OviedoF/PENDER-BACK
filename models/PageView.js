import mongoose from 'mongoose';

// Visitas de la landing (analytics propio, sin cookies ni terceros).
const PageViewSchema = new mongoose.Schema({
  path:   { type: String, required: true },
  ref:    { type: String, default: '' },
  mobile: { type: Boolean, default: false },
  day:    { type: String, required: true, index: true }, // YYYY-MM-DD
}, { timestamps: true });

PageViewSchema.index({ day: 1, path: 1 });

export default mongoose.model('PageView', PageViewSchema);
