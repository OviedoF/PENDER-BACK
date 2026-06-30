import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const archiver = require('archiver');
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import BackupConfig from '../models/BackupConfig.js';
import sendGenericEmail from '../utils/sendGenericEmail.js';
import nodemailer from 'nodemailer';
import env from '../env.js';

const BACKUPS_DIR = path.join(env.__dirname, 'backups');

if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

const verifyAdmin = async (req) => {
  const token = req.headers.authorization?.split(' ')[1] || req.query?.token;
  if (!token) throw new Error('Token requerido');
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(payload.id);
  if (!user || !['admin', 'moderator'].includes(user.role)) throw new Error('No tienes permisos de administrador');
  return user;
};

const BackupController = {};

BackupController.getConfig = async (req, res) => {
  try {
    await verifyAdmin(req);
    let config = await BackupConfig.findOne({ key: 'global' });
    if (!config) config = await BackupConfig.create({ key: 'global' });
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

BackupController.updateConfig = async (req, res) => {
  try {
    await verifyAdmin(req);
    const { autoEnabled, frequencyHours, retentionDays, maxBackups } = req.body;
    const update = {};
    if (autoEnabled !== undefined) update.autoEnabled = autoEnabled;
    if (frequencyHours !== undefined) update.frequencyHours = Math.max(1, Number(frequencyHours));
    if (retentionDays !== undefined) update.retentionDays = Math.max(1, Number(retentionDays));
    if (maxBackups !== undefined) update.maxBackups = Math.max(1, Number(maxBackups));

    const config = await BackupConfig.findOneAndUpdate(
      { key: 'global' },
      { $set: update },
      { new: true, upsert: true }
    );
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

BackupController.listBackups = async (req, res) => {
  try {
    await verifyAdmin(req);
    if (!fs.existsSync(BACKUPS_DIR)) return res.json([]);

    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.endsWith('.zip'))
      .map(f => {
        const stat = fs.statSync(path.join(BACKUPS_DIR, f));
        return { filename: f, size: stat.size, createdAt: stat.birthtime };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

BackupController.createBackup = async (req, res) => {
  try {
    const admin = await verifyAdmin(req);
    const result = await runBackup();

    const { sendEmail, emailTo } = req.body || {};
    if (sendEmail) {
      const recipient = emailTo || admin.email;
      if (recipient) {
        const filePath = path.join(BACKUPS_DIR, result.filename);
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: process.env.MAIL_USERNAME, pass: process.env.MAIL_PASSWORD },
        });
        await transporter.sendMail({
          from: `"Petnder" <${process.env.MAIL_USERNAME}>`,
          to: recipient,
          subject: `Backup Petnder — ${result.filename}`,
          html: `<p>Se adjunta el backup de la base de datos de Petnder generado el ${new Date().toLocaleString('es-AR')}.</p><p>Tamaño: ${(result.size / 1024 / 1024).toFixed(2)} MB</p>`,
          attachments: [{ filename: result.filename, path: filePath }],
        });
        result.emailSent = recipient;
      }
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

BackupController.downloadBackup = async (req, res) => {
  try {
    await verifyAdmin(req);
    const { filename } = req.params;
    const safeName = path.basename(filename);
    const filePath = path.join(BACKUPS_DIR, safeName);

    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Backup no encontrado' });

    res.download(filePath, safeName);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

BackupController.deleteBackup = async (req, res) => {
  try {
    await verifyAdmin(req);
    const { filename } = req.params;
    const safeName = path.basename(filename);
    const filePath = path.join(BACKUPS_DIR, safeName);

    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Backup no encontrado' });

    fs.unlinkSync(filePath);
    res.json({ message: 'Backup eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

BackupController.fullReport = async (req, res) => {
  try {
    await verifyAdmin(req);
    const collections = await mongoose.connection.db.listCollections().toArray();
    const report = {};

    for (const col of collections) {
      const name = col.name;
      if (name === 'agendaJobs') continue;
      const docs = await mongoose.connection.db.collection(name).find({}).toArray();
      const count = docs.length;

      const sample = docs[0] || {};
      const fields = Object.keys(sample).filter(k => k !== '_id' && k !== '__v');

      report[name] = {
        count,
        fields,
        docs: docs.map(d => {
          const flat = {};
          for (const f of fields) {
            const val = d[f];
            if (val instanceof Date) flat[f] = val.toISOString();
            else if (val && typeof val === 'object' && val._bsontype === 'ObjectId') flat[f] = val.toString();
            else if (val && typeof val === 'object') flat[f] = JSON.stringify(val);
            else flat[f] = val ?? '';
          }
          return flat;
        }),
      };
    }

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export async function runBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup_${timestamp}.zip`;
  const filePath = path.join(BACKUPS_DIR, filename);

  const collections = await mongoose.connection.db.listCollections().toArray();

  const output = fs.createWriteStream(filePath);
  const archive = archiver('zip', { zlib: { level: 6 } });

  await new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);

    const addCollections = async () => {
      for (const col of collections) {
        const name = col.name;
        if (name === 'agendaJobs') continue;
        const docs = await mongoose.connection.db.collection(name).find({}).toArray();
        archive.append(JSON.stringify(docs, null, 2), { name: `${name}.json` });
      }
      await archive.finalize();
    };

    addCollections().catch(reject);
  });

  const stat = fs.statSync(filePath);

  await BackupConfig.findOneAndUpdate(
    { key: 'global' },
    { $set: { lastBackupAt: new Date(), lastBackupSize: stat.size } },
    { upsert: true }
  );

  await cleanOldBackups();

  return { filename, size: stat.size, createdAt: new Date() };
}

async function cleanOldBackups() {
  const config = await BackupConfig.findOne({ key: 'global' });
  if (!config) return;

  const files = fs.readdirSync(BACKUPS_DIR)
    .filter(f => f.endsWith('.zip'))
    .map(f => ({ name: f, time: fs.statSync(path.join(BACKUPS_DIR, f)).birthtime }))
    .sort((a, b) => b.time.getTime() - a.time.getTime());

  const cutoff = new Date(Date.now() - config.retentionDays * 24 * 60 * 60 * 1000);

  for (let i = 0; i < files.length; i++) {
    if (i >= config.maxBackups || files[i].time < cutoff) {
      fs.unlinkSync(path.join(BACKUPS_DIR, files[i].name));
    }
  }
}

export default BackupController;
