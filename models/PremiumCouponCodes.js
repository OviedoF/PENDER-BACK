import mongoose from 'mongoose';

const CouponCodesSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  coupon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cupon',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  usedDate: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['created', 'pending', 'approved', 'rejected'],
    default: 'created'
  },
  amount: {
    type: Number,
    default: 0
  },
  attachment: {
    type: String,
    default: null
  },
  reference: {
    type: String,
    default: null
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
    timestamps: true
});

const CouponCode = mongoose.model('CouponCode', CouponCodesSchema);
export default CouponCode;