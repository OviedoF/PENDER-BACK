import mongoose from 'mongoose';

const pushCampaignSchema = new mongoose.Schema({
  title:   { type: String, required: true },
  body:    { type: String, required: true },
  link:    { type: String, default: '' },

  // Segmentation
  targetDepartments:    [{ type: String }],
  targetRoles:          [{ type: String, enum: ['user', 'enterprise'] }],
  targetSubscriptions:  [{ type: String, enum: ['free', 'basic', 'pro'] }],
  targetInterests:      [{ type: String }],

  // Scheduling
  scheduledAt: { type: Date, default: null },
  sentAt:      { type: Date, default: null },

  status: { type: String, enum: ['draft', 'scheduled', 'sending', 'sent'], default: 'draft' },

  recipientCount: { type: Number, default: 0 }, // usuarios alcanzados (notificación in-app)
  pushDelivered:  { type: Number, default: 0 }, // push reales entregados a dispositivos
  readCount:      { type: Number, default: 0 }, // notificaciones in-app leídas
}, { timestamps: true });

export default mongoose.model('PushCampaign', pushCampaignSchema);
