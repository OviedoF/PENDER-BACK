import Banner from '../models/Banner.js';
import PushCampaign from '../models/PushCampaign.js';
import EmailTemplate from '../models/EmailTemplate.js';
import EmailAutomation from '../models/EmailAutomation.js';
import EmailCampaign from '../models/EmailCampaign.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import sendGenericEmail from '../utils/sendGenericEmail.js';
import nodemailer from 'nodemailer';

const MarketingController = {};

// ═══════════════════════════════════════════════════════════════════════════════
//  BANNERS
// ═══════════════════════════════════════════════════════════════════════════════

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
    const { title, link, active, order, variant, startDate, endDate, departments, targetRoles, targetSubscriptions } = req.body;
    const image = req.file ? `/api/uploads/${req.file.filename}` : '';
    if (!image) return res.status(400).json({ error: 'Se requiere una imagen' });

    const banner = await Banner.create({
      title, image, link, active: active !== 'false',
      order: Number(order) || 0,
      variant: variant || 'A',
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
    const { title, link, active, order, variant, startDate, endDate, departments, targetRoles, targetSubscriptions } = req.body;
    const update = {
      title, link, active: active !== 'false',
      order: Number(order) || 0,
      variant: variant || 'A',
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

MarketingController.getActiveBanners = async (req, res) => {
  try {
    const now = new Date();
    const user = req.user || {};
    const role = user.role || 'user';
    const subscription = user.suscription || 'free';
    const department = user.department || '';

    const banners = await Banner.find({ active: true }).sort({ order: 1 }).lean();

    const filtered = banners.filter(b => {
      if (b.startDate && new Date(b.startDate) > now) return false;
      if (b.endDate && new Date(b.endDate) < now) return false;
      if (b.targetRoles?.length && !b.targetRoles.includes(role === 'enterprise' ? 'enterprise' : 'user')) return false;
      if (b.targetSubscriptions?.length && !b.targetSubscriptions.includes(subscription)) return false;
      if (b.departments?.length && department && !b.departments.includes(department)) return false;
      return true;
    });

    await Banner.updateMany(
      { _id: { $in: filtered.map(b => b._id) } },
      { $inc: { impressions: 1 } }
    );

    res.json({ banners: filtered });
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
    const campaign = await PushCampaign.create(req.body);
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

MarketingController.sendPushCampaign = async (req, res) => {
  try {
    const campaign = await PushCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' });
    if (campaign.status === 'sent') return res.status(400).json({ error: 'Campaña ya enviada' });

    const filter = { deletedAt: null };
    if (campaign.targetRoles?.length) {
      const roles = [];
      if (campaign.targetRoles.includes('user')) roles.push('user');
      if (campaign.targetRoles.includes('enterprise')) roles.push('enterprise');
      filter.role = { $in: roles };
    }
    if (campaign.targetSubscriptions?.length) filter.suscription = { $in: campaign.targetSubscriptions };
    if (campaign.targetDepartments?.length) filter.department = { $in: campaign.targetDepartments };

    const users = await User.find(filter).select('_id').lean();

    const notifications = users.map(u => ({
      title: campaign.title,
      text: campaign.body,
      link: campaign.link || null,
      user: u._id,
      readed: false,
    }));

    if (notifications.length) await Notification.insertMany(notifications);

    campaign.status = 'sent';
    campaign.sentAt = new Date();
    campaign.recipientCount = users.length;
    await campaign.save();

    res.json({ sent: users.length, campaign });
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
    const campaign = await EmailCampaign.findByIdAndUpdate(req.params.id, { $inc: { clickCount: 1 } });
    const redirect = req.query.url || '/';
    res.redirect(redirect);
  } catch {
    res.redirect('/');
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function buildEmailHtml(template, campaignId) {
  const baseUrl = process.env.API_URL || 'https://app.petnder.com/api';
  const trackPixel = campaignId ? `<img src="${baseUrl}/marketing/email/track/${campaignId}/open" width="1" height="1" style="display:none" />` : '';
  const color = template.headerColor || '#FF6B6B';
  const headerImg = template.headerImage ? `<img src="${baseUrl}${template.headerImage}" style="width:100%;max-height:200px;object-fit:cover" />` : '';

  const layouts = {
    basic: `
      <table style="max-width:600px;margin:0 auto;background:#fff;font-family:Arial,sans-serif" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="background:${color};padding:30px 20px;text-align:center;color:#fff"><h1 style="margin:0;font-size:22px">${template.subject}</h1></td></tr>
        ${headerImg ? `<tr><td>${headerImg}</td></tr>` : ''}
        <tr><td style="padding:30px 20px;font-size:15px;color:#333;line-height:1.6">${template.bodyHtml}</td></tr>
        <tr><td style="background:#f5f5f5;padding:20px;text-align:center;font-size:12px;color:#999">${template.footerText}${trackPixel}</td></tr>
      </table>`,
    'with-image': `
      <table style="max-width:600px;margin:0 auto;background:#fff;font-family:Arial,sans-serif" width="100%" cellpadding="0" cellspacing="0">
        ${headerImg ? `<tr><td>${headerImg}</td></tr>` : ''}
        <tr><td style="padding:25px 20px"><h1 style="margin:0 0 15px;font-size:22px;color:${color}">${template.subject}</h1><div style="font-size:15px;color:#333;line-height:1.6">${template.bodyHtml}</div></td></tr>
        <tr><td style="background:${color};padding:20px;text-align:center;font-size:12px;color:#fff">${template.footerText}${trackPixel}</td></tr>
      </table>`,
    colorful: `
      <table style="max-width:600px;margin:0 auto;background:linear-gradient(135deg,${color},#FF8E72);font-family:Arial,sans-serif" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:40px 30px;text-align:center;color:#fff"><h1 style="margin:0 0 20px;font-size:26px">${template.subject}</h1>${headerImg ? headerImg : ''}</td></tr>
        <tr><td style="background:#fff;padding:30px;margin:0 20px;border-radius:12px"><div style="font-size:15px;color:#333;line-height:1.6">${template.bodyHtml}</div></td></tr>
        <tr><td style="padding:20px;text-align:center;font-size:12px;color:rgba(255,255,255,0.8)">${template.footerText}${trackPixel}</td></tr>
      </table>`,
    minimal: `
      <table style="max-width:600px;margin:0 auto;background:#fff;font-family:Arial,sans-serif" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:40px 30px;border-bottom:3px solid ${color}"><h1 style="margin:0;font-size:20px;color:#111">${template.subject}</h1></td></tr>
        <tr><td style="padding:30px;font-size:15px;color:#444;line-height:1.7">${template.bodyHtml}</td></tr>
        <tr><td style="padding:20px 30px;font-size:11px;color:#aaa;border-top:1px solid #eee">${template.footerText}${trackPixel}</td></tr>
      </table>`,
  };

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:20px 0;background:#f4f4f4">${layouts[template.layout] || layouts.basic}</body></html>`;
}

export { buildEmailHtml };
export default MarketingController;
