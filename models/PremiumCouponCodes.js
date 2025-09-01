import mongoose from 'mongoose';

const CouponCodesSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  coupon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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