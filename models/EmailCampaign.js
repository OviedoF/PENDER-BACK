import mongoose from 'mongoose';

const emailCampaignSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  template: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailTemplate', required: true },
  subject:  { type: String, required: true },

  // Segmentation
  targetDepartments:   [{ type: String }],
  targetRoles:         [{ type: String, enum: ['user', 'enterprise'] }],
  targetSubscriptions: [{ type: String, enum: ['free', 'basic', 'pro'] }],

  status:   { type: String, enum: ['draft', 'sent'], default: 'draft' },
  sentAt:   { type: Date, default: null },

  recipientCount: { type: Number, default: 0 },
  openCount:      { type: Number, default: 0 },
  clickCount:     { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model('EmailCampaign', emailCampaignSchema);
