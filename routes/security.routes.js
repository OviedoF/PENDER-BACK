import { Router } from 'express';
import SecurityController from '../controllers/security.controller.js';

const router = Router();

// PUBLIC
router.post('/report', SecurityController.submitReport);

// ADMIN: Reports
router.get('/admin/user-reports', SecurityController.adminGetUserReports);
router.get('/admin/enterprise-reports', SecurityController.adminGetEnterpriseReports);
router.put('/admin/reports/:id/resolve', SecurityController.adminResolveReport);

// ADMIN: Content Reports
router.get('/admin/content-reports', SecurityController.adminGetContentReports);
router.get('/admin/content-reports/stats', SecurityController.adminGetContentReportsStats);

// ADMIN: Anti-Fraud
router.get('/admin/fraud/dashboard', SecurityController.adminGetFraudDashboard);
router.get('/admin/fraud/suspicious-users', SecurityController.adminGetSuspiciousUsers);
router.put('/admin/fraud/flag-user/:userId', SecurityController.adminFlagUser);

// ADMIN: Spam
router.get('/admin/spam/detect', SecurityController.adminDetectSpam);
router.put('/admin/spam/:commentId/remove', SecurityController.adminRemoveSpam);

// ADMIN: IP Blacklist
router.get('/admin/ip-blacklist', SecurityController.adminGetIpBlacklist);
router.post('/admin/ip-blacklist', SecurityController.adminCreateIpBlacklist);
router.put('/admin/ip-blacklist/:id', SecurityController.adminUpdateIpBlacklist);
router.delete('/admin/ip-blacklist/:id', SecurityController.adminDeleteIpBlacklist);

// ADMIN: Activity Logs
router.get('/admin/logs', SecurityController.adminGetLogs);
router.get('/admin/logs/stats', SecurityController.adminGetLogsStats);

export default router;
