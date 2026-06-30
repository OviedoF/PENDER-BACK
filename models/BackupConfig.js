import mongoose from 'mongoose';

const backupConfigSchema = new mongoose.Schema({
  key: { type: String, default: 'global', unique: true },

  autoEnabled:    { type: Boolean, default: false },
  frequencyHours: { type: Number, default: 24 },
  retentionDays:  { type: Number, default: 30 },
  maxBackups:     { type: Number, default: 10 },

  lastBackupAt:   { type: Date, default: null },
  lastBackupSize: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model('BackupConfig', backupConfigSchema);
