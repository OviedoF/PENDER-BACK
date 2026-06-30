import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  image:       { type: String, required: true },
  link:        { type: String, default: '' },
  active:      { type: Boolean, default: true },
  order:       { type: Number, default: 0 },

  // A/B testing
  variant:     { type: String, enum: ['A', 'B'], default: 'A' },

  // Scheduling
  startDate:   { type: Date, default: null },
  endDate:     { type: Date, default: null },

  // Geographic targeting
  departments: [{ type: String }],

  // User targeting
  targetRoles:       [{ type: String, enum: ['user', 'enterprise'] }],
  targetSubscriptions: [{ type: String, enum: ['free', 'basic', 'pro'] }],

  impressions: { type: Number, default: 0 },
  clicks:      { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model('Banner', bannerSchema);
