
import express from 'express';
import authController from '../controllers/authController.js';
import upload from '../config/multer.config.js'; // Configuración de Multer
import { requirePermission } from '../middlewares/roleMiddleware.js';

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
router.post("/update-location", authController.updateLocation);
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

// ─── ADMIN: Usuarios ─────────────────────────────────────────────────────────
const viewUsuarios = requirePermission('usuarios', 'view');
const editUsuarios = requirePermission('usuarios', 'edit');
const suspendUsuarios = requirePermission('usuarios', 'suspend');
const deleteUsuarios = requirePermission('usuarios', 'delete');

router.get('/users', viewUsuarios, authController.getUsersAdmin);
router.get('/users/export', viewUsuarios, authController.exportUsersAdmin);
router.get('/users/:id', viewUsuarios, authController.getUserProfile);
router.get('/users/:id/activity', viewUsuarios, authController.getUserActivity);
router.get('/users/:id/reports', viewUsuarios, authController.getUserReports);
router.put('/users/:id', editUsuarios, authController.adminUpdateUser);
router.put('/users/:id/role', editUsuarios, authController.updateUserRole);
router.put('/users/:id/suspend', suspendUsuarios, authController.suspendUser);
router.put('/users/:id/ban', suspendUsuarios, authController.banUser);
router.put('/users/:id/reset-password', editUsuarios, authController.resetUserPassword);
router.put('/users/:id/verify', editUsuarios, authController.verifyUser);

// ─── ADMIN: Empresas ─────────────────────────────────────────────────────────
const viewEmpresas = requirePermission('empresas', 'view');
const editEmpresas = requirePermission('empresas', 'edit');
const approveEmpresas = requirePermission('empresas', 'approve');
const deleteEmpresas = requirePermission('empresas', 'delete');

router.get('/enterprises', viewEmpresas, authController.getEnterprisesAdmin);
router.get('/enterprises/export', viewEmpresas, authController.exportEnterprisesAdmin);
router.get('/enterprises/pending', viewEmpresas, authController.getPendingEnterprises);
router.get('/enterprises/:id/metrics', viewEmpresas, authController.getEnterpriseMetrics);
router.get('/enterprises/:id/history', viewEmpresas, authController.getEnterpriseHistory);
router.put('/enterprises/bulk-disable', deleteEmpresas, authController.bulkDisableEnterprises);
router.put('/enterprises/:id/approve', approveEmpresas, authController.approveEnterprise);
router.put('/enterprises/:id/deny', approveEmpresas, authController.denyEnterprise);
router.put('/enterprises/:id/featured', editEmpresas, authController.toggleFeaturedEnterprise);
router.put('/enterprises/:id/verified', editEmpresas, authController.toggleVerifiedEnterprise);
router.put('/enterprises/:id/priority', editEmpresas, authController.setEnterprisePriority);
router.put('/enterprises/:id/active', editEmpresas, authController.toggleEnterpriseActive);

export default router;
