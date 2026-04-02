import mongoose from 'mongoose'

const subscriptionSchema = new mongoose.Schema({
  user:                      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan:                      { type: String, enum: ['free', 'basic', 'pro'], default: 'free' },
  status:                    { type: String, enum: ['active', 'cancelled', 'trial', 'expired', 'paused'], default: 'active' },
  startDate:                 { type: Date, default: Date.now },
  endDate:                   { type: Date },
  trialEnd:                  { type: Date },
  cancelAt:                  { type: Date },
  reactivatedAt:             { type: Date },
  cancelledAt:               { type: Date },
  price:                     { type: Number, default: 0 },
  billingCycle:              { type: String, enum: ['monthly', 'annual'], default: 'monthly' },
  mercadopagoSubscriptionId: { type: String },
  adminNotes:                { type: String },
  deletedAt:                 { type: Date, default: null },
}, { timestamps: true })

export default mongoose.model('Subscription', subscriptionSchema)
