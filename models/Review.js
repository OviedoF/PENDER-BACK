import mongoose from 'mongoose';

const ReviewResponseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  comment: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const ReviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: '' },
  responses: [ReviewResponseSchema],
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

export const ReviewResponse = mongoose.model('ReviewResponse', ReviewResponseSchema);

export default mongoose.model('Review', ReviewSchema);
