import mongoose from "mongoose";

const featuredRequestSchema = new mongoose.Schema({
  comments: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Cupon', required: true },
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  status: { type: String, required: true, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
}, { timestamps: true });

const featuredRequest = mongoose.model('featuredRequest', featuredRequestSchema);

export default featuredRequest;