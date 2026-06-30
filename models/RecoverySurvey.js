import mongoose from 'mongoose';

const recoverySurveySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  report: { type: mongoose.Schema.Types.ObjectId, ref: 'FindMe', required: true },
  petName: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  experience: {
    type: String,
    enum: ['excelente', 'buena', 'regular', 'mala'],
    required: true,
  },
  comment: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('RecoverySurvey', recoverySurveySchema);
