import { Router } from 'express';
import MarketingController from '../controllers/marketing.controller.js';
import { requirePermission } from '../middlewares/roleMiddleware.js';
import { protect } from '../middlewares/authMiddleware.js';
import upload from '../config/multer.config.js';

const router = Router();

const view = requirePermission('marketing', 'view');
const manage = requirePermission('marketing', 'manage');

// ─── BANNERS (public, before :id to avoid capture) ──────────────────────────
router.get('/banners/active',   MarketingController.getActiveBanners);
router.post('/banners/:id/click', MarketingController.clickBanner);

// ─── BANNERS (admin) ─────────────────────────────────────────────────────────
router.get('/banners',          view,   MarketingController.getBanners);
router.post('/banners',         manage, upload.single('image'), MarketingController.createBanner);
router.put('/banners/reorder',  manage, MarketingController.reorderBanners);
router.put('/banners/:id',      manage, upload.single('image'), MarketingController.updateBanner);
router.delete('/banners/:id',   manage, MarketingController.deleteBanner);

// ─── PUSH CAMPAIGNS ─────────────────────────────────────────────────────────
router.get('/push',             view,   MarketingController.getPushCampaigns);
router.post('/push',            manage, MarketingController.createPushCampaign);
router.post('/push/:id/send',   manage, MarketingController.sendPushCampaign);
router.delete('/push/:id',      manage, MarketingController.deletePushCampaign);

// ─── EMAIL TEMPLATES ─────────────────────────────────────────────────────────
router.get('/email/templates',          view,   MarketingController.getEmailTemplates);
router.post('/email/templates',         manage, upload.single('headerImage'), MarketingController.createEmailTemplate);
router.put('/email/templates/:id',      manage, upload.single('headerImage'), MarketingController.updateEmailTemplate);
router.delete('/email/templates/:id',   manage, MarketingController.deleteEmailTemplate);
router.get('/email/templates/:id/preview', view, MarketingController.previewEmailTemplate);

// ─── EMAIL AUTOMATIONS ───────────────────────────────────────────────────────
router.get('/email/automations',        view,   MarketingController.getEmailAutomations);
router.post('/email/automations',       manage, MarketingController.createEmailAutomation);
router.put('/email/automations/:id',    manage, MarketingController.updateEmailAutomation);
router.delete('/email/automations/:id', manage, MarketingController.deleteEmailAutomation);

// ─── EMAIL CAMPAIGNS ─────────────────────────────────────────────────────────
router.get('/email/campaigns',          view,   MarketingController.getEmailCampaigns);
router.post('/email/campaigns',         manage, MarketingController.createEmailCampaign);
router.post('/email/campaigns/:id/send', manage, MarketingController.sendEmailCampaign);
router.delete('/email/campaigns/:id',   manage, MarketingController.deleteEmailCampaign);

// ─── EMAIL TRACKING (public, no auth) ────────────────────────────────────────
router.get('/email/track/:id/open',  MarketingController.trackOpen);
router.get('/email/track/:id/click', MarketingController.trackClick);

export default router;
