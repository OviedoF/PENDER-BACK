import mongoose from 'mongoose'

const scheduledTrialSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan:        { type: String, enum: ['basic', 'pro'], required: true },
  days:        { type: Number, required: true },
  scheduledAt: { type: Date, required: true },
  activatedAt: { type: Date, default: null },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

export default mongoose.model('ScheduledTrial', scheduledTrialSchema)
