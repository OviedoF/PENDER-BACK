import { Router } from 'express';
import SecurityController from '../controllers/security.controller.js';
import { requirePermission } from '../middlewares/roleMiddleware.js';

const router = Router();

const view = requirePermission('seguridad', 'view');
const manage = requirePermission('seguridad', 'manage');

// PUBLIC
router.post('/report', SecurityController.submitReport);

// ADMIN: Export
router.get('/admin/export', view, SecurityController.adminExport);

// ADMIN: Reports
router.get('/admin/user-reports', view, SecurityController.adminGetUserReports);
router.get('/admin/enterprise-reports', view, SecurityController.adminGetEnterpriseReports);
router.put('/admin/reports/:id/resolve', manage, SecurityController.adminResolveReport);

// ADMIN: Content Reports
router.get('/admin/content-reports', view, SecurityController.adminGetContentReports);
router.get('/admin/content-reports/stats', view, SecurityController.adminGetContentReportsStats);

// ADMIN: Anti-Fraud
router.get('/admin/fraud/dashboard', view, SecurityController.adminGetFraudDashboard);
router.get('/admin/fraud/suspicious-users', view, SecurityController.adminGetSuspiciousUsers);
router.put('/admin/fraud/flag-user/:userId', manage, SecurityController.adminFlagUser);

// ADMIN: Spam
router.get('/admin/spam/detect', view, SecurityController.adminDetectSpam);
router.put('/admin/spam/:commentId/remove', manage, SecurityController.adminRemoveSpam);

// ADMIN: IP Recommendations
router.get('/admin/ip-recommendations', view, SecurityController.adminGetIpRecommendations);

// ADMIN: IP Blacklist
router.get('/admin/ip-blacklist', view, SecurityController.adminGetIpBlacklist);
router.post('/admin/ip-blacklist', manage, SecurityController.adminCreateIpBlacklist);
router.put('/admin/ip-blacklist/:id', manage, SecurityController.adminUpdateIpBlacklist);
router.delete('/admin/ip-blacklist/:id', manage, SecurityController.adminDeleteIpBlacklist);

// ADMIN: Activity Logs
router.get('/admin/logs', view, SecurityController.adminGetLogs);
router.get('/admin/logs/stats', view, SecurityController.adminGetLogsStats);

export default router;
