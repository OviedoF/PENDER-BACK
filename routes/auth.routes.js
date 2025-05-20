
import express from 'express';
import authController from '../controllers/authController.js';
import upload from '../config/multer.config.js'; // Configuración de Multer

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

export default router;