import mongoose from 'mongoose';

const emailAutomationSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  event:      { type: String, required: true, enum: [
    'user_register',
    'enterprise_register',
    'password_reset',
    'pet_recovered',
    'adoption_approved',
    'adoption_completed',
    'subscription_expired',
    'subscription_reminder',
    'inactivity',
  ]},
  template:   { type: mongoose.Schema.Types.ObjectId, ref: 'EmailTemplate', required: true },
  delayMinutes: { type: Number, default: 0 },
  active:     { type: Boolean, default: true },
  sentCount:  { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model('EmailAutomation', emailAutomationSchema);
