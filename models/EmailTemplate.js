import mongoose from 'mongoose';

const emailTemplateSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  subject:   { type: String, required: true },
  layout:    { type: String, enum: ['basic', 'with-image', 'colorful', 'minimal'], default: 'basic' },
  headerColor:  { type: String, default: '#FF6B6B' },
  headerImage:  { type: String, default: '' },
  bodyHtml:     { type: String, default: '' },
  footerText:   { type: String, default: '© 2025 Petnder. Todos los derechos reservados.' },
  isDefault:    { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model('EmailTemplate', emailTemplateSchema);
