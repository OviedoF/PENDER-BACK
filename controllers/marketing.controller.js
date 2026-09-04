import Banner from '../models/Banner.js';
import PushCampaign from '../models/PushCampaign.js';
import EmailTemplate from '../models/EmailTemplate.js';
import EmailAutomation from '../models/EmailAutomation.js';
import EmailCampaign from '../models/EmailCampaign.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { buildEmailHtml, safeRedirectUrl } from '../utils/emailHtml.js';
import { dispatchPushCampaign, buildAudienceFilter, resolveInterestUserIds } from '../utils/pushCampaign.js';
import { AUTOMATION_VARIABLES } from '../utils/emailAutomations.js';

const MarketingController = {};

// ═══════════════════════════════════════════════════════════════════════════════
//  BANNERS
// ═══════════════════════════════════════════════════════════════════════════════

const BANNER_SECTIONS = ['home', 'adopcion', 'encuentrame'];

MarketingController.getBanners = async (_req, res) => {
  try {
    const banners = await Banner.find().sort({ order: 1, createdAt: -1 }).lean();
    res.json({ banners });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

MarketingController.createBanner = async (req, res) => {
  try {
    const { title, link, active, order, duration, variant, abGroup, startDate, endDate, departments, targetRoles, targetSubscriptions, section } = req.body;
    const image = req.file ? `/api/uploads/${req.file.filename}` : '';
    if (!image) return res.status(400).json({ error: 'Se requiere una imagen' });

    const banner = await Banner.create({
      title, image, link, active: active !== 'false',
      section: BANNER_SECTIONS.includes(section) ? section : 'home',
      order: Number(order) || 0,
      duration: Number(duration) || 3,
      variant: variant || 'A',
      abGroup: (abGroup || '').trim(),
      startDate: startDate || null,
      endDate: endDate || null,
      departments: departments ? JSON.parse(departments) : [],
      targetRoles: targetRoles ? JSON.parse(targetRoles) : [],
      targetSubscriptions: targetSubscriptions ? JSON.parse(targetSubscriptions) : [],
    });
    res.json(banner);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

MarketingController.updateBanner = async (req, res) => {
  try {
    const { title, link, active, order, duration, variant, abGroup, startDate, endDate, departments, targetRoles, targetSubscriptions, section } = req.body;
    const update = {
      title, link, active: active !== 'false',
      section: BANNER_SECTIONS.includes(section) ? section : 'home',
      order: Number(order) || 0,
      duration: Number(duration) || 3,
      variant: variant || 'A',
      abGroup: (abGroup || '').trim(),
      startDate: startDate || null,
      endDate: endDate || null,
      departments: departments ? JSON.parse(departments) : [],
      targetRoles: targetRoles ? JSON.parse(targetRoles) : [],
      targetSubscriptions: targetSubscriptions ? JSON.parse(targetSubscriptions) : [],
    };
    if (req.file) update.image = `/api/uploads/${req.file.filename}`;
    const banner = await Banner.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!banner) return res.status(404).json({ error: 'Banner no encontrado' });
    res.json(banner);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

MarketingController.deleteBanner = async (req, res) => {
  try {
    await Banner.findByIdAndDelete(req.params.id);
    res.json({ message: 'Banner eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

MarketingController.reorderBanners = async (req, res) => {
  try {
    const { order } = req.body;
    for (let i = 0; i < order.length; i++) {
      await Banner.findByIdAndUpdate(order[i], { order: i });
    }
    res.json({ message: 'Orden actualizado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Asigna de forma estable a un usuario/dispositivo al grupo A o B (50/50).
 * Usa el id de usuario si hay sesión; si no, el header x-device-id que manda la app.
 */
function abBucket(seed) {
  if (!seed) return Math.random() < 0.5 ? 'A' : 'B';
  const hash = crypto.createHash('md5').update(String(seed)).digest();
  return hash[0] % 2 === 0 ? 'A' : 'B';
}

MarketingController.getActiveBanners = async (req, res) => {
  try {
    const now = new Date();

    // Con optionalAuth, req.user trae { id, role } del JWT. Cargamos suscripción y zona desde la DB.
    let role = 'user', subscription = 'free', department = '';
    if (req.user?.id) {
      const dbUser = await User.findById(req.user.id).select('role suscription department').lean();
      if (dbUser) {
        role = dbUser.role || 'user';
        subscription = dbUser.suscription || 'free';
        department = dbUser.department || '';
      }
    }
    const bucket = abBucket(req.user?.id || req.headers['x-device-id']);

    // Sección de la app que pide los banners (home por defecto; los banners
    // viejos sin sección cuentan como home)
    const section = BANNER_SECTIONS.includes(req.query.section) ? req.query.section : 'home';

    const banners = await Banner.find({ active: true }).sort({ order: 1, createdAt: -1 }).lean();

    const filtered = banners.filter(b => {
      if ((b.section || 'home') !== section) return false;
      if (b.startDate && new Date(b.startDate) > now) return false;
      if (b.endDate && new Date(b.endDate) < now) return false;
      if (b.targetRoles?.length && !b.targetRoles.includes(role === 'enterprise' ? 'enterprise' : 'user')) return false;
      if (b.targetSubscriptions?.length && !b.targetSubscriptions.includes(subscription)) return false;
      if (b.departments?.length && department && !b.departments.includes(department)) return false;
      // A/B: solo aplica a banners que pertenecen a un grupo de prueba
      if (b.abGroup && (b.variant || 'A') !== bucket) return false;
      return true;
    });

    if (filtered.length) {
      await Banner.updateMany(
        { _id: { $in: filtered.map(b => b._id) } },
        { $inc: { impressions: 1 } }
      );
    }

    res.json({ banners: filtered, bucket });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

MarketingController.clickBanner = async (req, res) => {
  try {
    await Banner.findByIdAndUpdate(req.params.id, { $inc: { clicks: 1 } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  PUSH CAMPAIGNS
// ═══════════════════════════════════════════════════════════════════════════════

MarketingController.getPushCampaigns = async (_req, res) => {
  try {
    const campaigns = await PushCampaign.find().sort({ createdAt: -1 }).lean();
    res.json({ campaigns });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

MarketingController.createPushCampaign = async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.scheduledAt) {
      const when = new Date(data.scheduledAt);
      if (isNaN(when.getTime())) return res.status(400).json({ error: 'Fecha de programación inválida' });
      data.scheduledAt = when;
      data.status = 'scheduled';
    } else {
      data.scheduledAt = null;
      data.status = 'draft';
    }
    const campaign = await PushCampaign.create(data);
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Reprogramar / cancelar programación (solo campañas no enviadas)
MarketingController.updatePushCampaign = async (req, res) => {
  try {
    const campaign = await PushCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' });
    if (campaign.status === 'sent' || campaign.status === 'sending') return res.status(400).json({ error: 'La campaña ya fue enviada' });

    const { scheduledAt, ...rest } = req.body;
    Object.assign(campaign, rest);
    if (scheduledAt) {
      const when = new Date(scheduledAt);
      if (isNaN(when.getTime())) return res.status(400).json({ error: 'Fecha de programación inválida' });
      campaign.scheduledAt = when;
      campaign.status = 'scheduled';
    } else if (scheduledAt === null || scheduledAt === '') {
      campaign.scheduledAt = null;
      campaign.status = 'draft';
    }
    await campaign.save();
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Vista previa de audiencia: cuántos usuarios y cuántos dispositivos alcanzaría
MarketingController.previewPushAudience = async (req, res) => {
  try {
    const filter = buildAudienceFilter(req.body);
    const interestIds = await resolveInterestUserIds(req.body.targetInterests);
    if (interestIds) filter._id = { $in: [...interestIds] };
    const users = await User.find(filter).select('pushTokens').lean();
    const devices = users.reduce((acc, u) => acc + (u.pushTokens?.length || 0), 0);
    res.json({ users: users.length, devices });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

MarketingController.sendPushCampaign = async (req, res) => {
  try {
    const campaign = await PushCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' });
    if (campaign.status === 'sent' || campaign.status === 'sending') return res.status(400).json({ error: 'Campaña ya enviada' });

    const result = await dispatchPushCampaign(campaign);
    res.json({ sent: result.recipients, pushDelivered: result.pushDelivered, campaign });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── Tokens de dispositivo (los registra la app móvil) ───────────────────────

MarketingController.registerPushToken = async (req, res) => {
  try {
    const { token, platform } = req.body;
    if (!token || typeof token !== 'string') return res.status(400).json({ error: 'Token requerido' });

    // Un token pertenece a un solo usuario: si otro lo tenía (cambio de cuenta en el mismo dispositivo), se lo quitamos
    await User.updateMany(
      { _id: { $ne: req.user.id }, 'pushTokens.token': token },
      { $pull: { pushTokens: { token } } }
    );
    await User.updateOne({ _id: req.user.id }, { $pull: { pushTokens: { token } } });
    await User.updateOne(
      { _id: req.user.id },
      { $push: { pushTokens: { token, platform: platform || 'unknown', updatedAt: new Date() } } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

MarketingController.unregisterPushToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token requerido' });
    await User.updateOne({ _id: req.user.id }, { $pull: { pushTokens: { token } } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

MarketingController.deletePushCampaign = async (req, res) => {
  try {
    await PushCampaign.findByIdAndDelete(req.params.id);
    res.json({ message: 'Campaña eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  EMAIL TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

MarketingController.getEmailTemplates = async (_req, res) => {
  try {
    const templates = await EmailTemplate.find().sort({ createdAt: -1 }).lean();
    res.json({ templates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

MarketingController.createEmailTemplate = async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.headerImage = `/api/uploads/${req.file.filename}`;
    const template = await EmailTemplate.create(data);
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

MarketingController.updateEmailTemplate = async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.headerImage = `/api/uploads/${req.file.filename}`;
    const template = await EmailTemplate.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!template) return res.status(404).json({ error: 'Plantilla no encontrada' });
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

MarketingController.deleteEmailTemplate = async (req, res) => {
  try {
    await EmailTemplate.findByIdAndDelete(req.params.id);
    res.json({ message: 'Plantilla eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

MarketingController.previewEmailTemplate = async (req, res) => {
  try {
    const template = await EmailTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ error: 'Plantilla no encontrada' });
    const html = buildEmailHtml(template);
    res.json({ html });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  EMAIL AUTOMATIONS
// ═══════════════════════════════════════════════════════════════════════════════

MarketingController.getAutomationVariables = (_req, res) => {
  res.json({ variables: AUTOMATION_VARIABLES });
};

MarketingController.getEmailAutomations = async (_req, res) => {
  try {
    const automations = await EmailAutomation.find().populate('template', 'name layout').sort({ createdAt: -1 }).lean();
    res.json({ automations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

MarketingController.createEmailAutomation = async (req, res) => {
  try {
    const automation = await EmailAutomation.create(req.body);
    const populated = await EmailAutomation.findById(automation._id).populate('template', 'name layout');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

MarketingController.updateEmailAutomation = async (req, res) => {
  try {
    const automation = await EmailAutomation.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('template', 'name layout');
    if (!automation) return res.status(404).json({ error: 'Automatización no encontrada' });
    res.json(automation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

MarketingController.deleteEmailAutomation = async (req, res) => {
  try {
    await EmailAutomation.findByIdAndDelete(req.params.id);
    res.json({ message: 'Automatización eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  EMAIL CAMPAIGNS
// ═══════════════════════════════════════════════════════════════════════════════

MarketingController.getEmailCampaigns = async (_req, res) => {
  try {
    const campaigns = await EmailCampaign.find().populate('template', 'name layout').sort({ createdAt: -1 }).lean();
    res.json({ campaigns });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

MarketingController.createEmailCampaign = async (req, res) => {
  try {
    const campaign = await EmailCampaign.create(req.body);
    const populated = await EmailCampaign.findById(campaign._id).populate('template', 'name layout');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

MarketingController.sendEmailCampaign = async (req, res) => {
  try {
    const campaign = await EmailCampaign.findById(req.params.id).populate('template');
    if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' });
    if (campaign.status === 'sent') return res.status(400).json({ error: 'Campaña ya enviada' });

    const filter = { deletedAt: null, email: { $exists: true, $ne: '' } };
    if (campaign.targetRoles?.length) {
      const roles = [];
      if (campaign.targetRoles.includes('user')) roles.push('user');
      if (campaign.targetRoles.includes('enterprise')) roles.push('enterprise');
      filter.role = { $in: roles };
    }
    if (campaign.targetSubscriptions?.length) filter.suscription = { $in: campaign.targetSubscriptions };
    if (campaign.targetDepartments?.length) filter.department = { $in: campaign.targetDepartments };

    const users = await User.find(filter).select('email firstName').lean();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.MAIL_USERNAME, pass: process.env.MAIL_PASSWORD },
    });

    const html = buildEmailHtml(campaign.template, campaign._id.toString());

    let sentCount = 0;
    for (const user of users) {
      try {
        await transporter.sendMail({
          from: `"Petnder" <${process.env.MAIL_USERNAME}>`,
          to: user.email,
          subject: campaign.subject,
          html: html.replace(/\{\{nombre\}\}/g, user.firstName || ''),
        });
        sentCount++;
      } catch { /* skip failed emails */ }
    }

    campaign.status = 'sent';
    campaign.sentAt = new Date();
    campaign.recipientCount = sentCount;
    await campaign.save();

    res.json({ sent: sentCount, campaign });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

MarketingController.deleteEmailCampaign = async (req, res) => {
  try {
    await EmailCampaign.findByIdAndDelete(req.params.id);
    res.json({ message: 'Campaña eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

MarketingController.trackOpen = async (req, res) => {
  try {
    await EmailCampaign.findByIdAndUpdate(req.params.id, { $inc: { openCount: 1 } });
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.set('Content-Type', 'image/gif');
    res.send(pixel);
  } catch {
    res.status(204).end();
  }
};

MarketingController.trackClick = async (req, res) => {
  try {
    await EmailCampaign.findByIdAndUpdate(req.params.id, { $inc: { clickCount: 1 } });
    res.redirect(safeRedirectUrl(req.query.url));
  } catch {
    res.redirect(safeRedirectUrl(req.query.url));
  }
};

export default MarketingController;
