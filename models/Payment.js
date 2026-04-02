import mongoose from 'mongoose'

const paymentSchema = new mongoose.Schema({
  user:                  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subscription:          { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
  amount:                { type: Number, required: true },
  currency:              { type: String, default: 'USD' },
  status:                { type: String, enum: ['pending', 'approved', 'rejected', 'refunded', 'cancelled'], default: 'pending' },
  method:                { type: String, enum: ['mercadopago', 'manual', 'trial', 'coupon'], default: 'manual' },
  mercadopagoPaymentId:  { type: String },
  mercadopagoOrderId:    { type: String },
  description:           { type: String },
  invoiceNumber:         { type: String },
  paidAt:                { type: Date },
  deletedAt:             { type: Date, default: null },
}, { timestamps: true })

export default mongoose.model('Payment', paymentSchema)
