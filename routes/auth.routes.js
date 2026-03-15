
import express from 'express';
import authController from '../controllers/authController.js';
import upload from '../config/multer.config.js'; // Configuración de Multer
import { onlyAdmin } from '../middlewares/roleMiddleware.js';

const router = express.Router();

router.get('/whoIam', authController.whoIam);
router.get('/sessions', authController.getUserLogins);
router.get('/notifications', authController.getNotifications);
router.put('/notification/:id', authController.readNotification);
router.put('/all-notifications', authController.readAllNotifications);
router.delete('/notification/:id', authController.deleteNotification);
router.post('/social-login', authController.socialLogin);
router.post("/register", upload.single('image'), authController.register);
router.post("/update", upload.single('image'), authController.updateUser);
router.post("/register-enterprise", upload.fields([
    { name: "image", maxCount: 1 },  // 📌 Campo para una imagen principal
    { name: "images", maxCount: 9 }, // 📌 Campo para imágenes adicionales
]), authController.registerEnterprise);
router.post('/getUsersByTokens', authController.getUsersByTokens);
router.post("/login", authController.login);
router.put('/edit', authController.editUser);
router.put('/changeUserSuscription', authController.changeUserSuscription);
router.get('/getModerators', authController.getModerators);
router.get('/verifyAuth', authController.verifyAdmin);
router.post("/requestPasswordReset", authController.requestPasswordReset);
router.post("/verifyPasswordResetCode", authController.verifyPasswordResetCode);
router.post("/resetPassword", authController.resetPassword);
router.delete('/deleteUser', authController.deleteAccount);

router.get('/bank-accounts', authController.getBankAccounts);
router.put('/add-bank', authController.saveBankAccount);
router.delete('/delete-bank/:bankId', authController.deleteBankAccount);

router.get('/users', onlyAdmin, authController.getUsersAdmin);
router.get('/users/export', onlyAdmin, authController.exportUsersAdmin);

router.get('/users/:id', onlyAdmin, authController.getUserProfile);
router.get('/users/:id/activity', onlyAdmin, authController.getUserActivity);
router.get('/users/:id/reports', onlyAdmin, authController.getUserReports);
router.put('/users/:id/role', onlyAdmin, authController.updateUserRole);
router.put('/users/:id/suspend', onlyAdmin, authController.suspendUser);
router.put('/users/:id/ban', onlyAdmin, authController.banUser);
router.put('/users/:id/reset-password', onlyAdmin, authController.resetUserPassword);
router.put('/users/:id/verify', onlyAdmin, authController.verifyUser);

router.put('/enterprises/bulk-disable', onlyAdmin, authController.bulkDisableEnterprises);
router.get('/enterprises', onlyAdmin, authController.getEnterprisesAdmin);
router.get('/enterprises/export', onlyAdmin, authController.exportEnterprisesAdmin);
router.get('/enterprises/pending', onlyAdmin, authController.getPendingEnterprises);
router.put('/enterprises/:id/approve', onlyAdmin, authController.approveEnterprise);
router.put('/enterprises/:id/deny', onlyAdmin, authController.denyEnterprise);
router.put('/enterprises/:id/featured', onlyAdmin, authController.toggleFeaturedEnterprise);
router.put('/enterprises/:id/priority', onlyAdmin, authController.setEnterprisePriority);
router.put('/enterprises/:id/active', onlyAdmin, authController.toggleEnterpriseActive);
router.get('/enterprises/:id/metrics', onlyAdmin, authController.getEnterpriseMetrics);
router.get('/enterprises/:id/history', onlyAdmin, authController.getEnterpriseHistory);

export default router;