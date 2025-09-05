import mongoose from 'mongoose';

const BalanceMovementSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['payment', 'withdrawal'], required: true },
  codeCoupon: { type: mongoose.Schema.Types.ObjectId, ref: 'CouponCode' },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  bank: { type: String, default: null },
  comments: { type: String, default: null },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

export default mongoose.model('BalanceMovement', BalanceMovementSchema);
