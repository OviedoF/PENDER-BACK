
import express from 'express';
import { register, registerEnterprise, login, getModerators, editUser, deleteUser, verifyAdmin, requestPasswordReset, resetPassword, whoIam, socialLogin, verifyPasswordResetCode, changeUserSuscription, getUsersByTokens } from '../controllers/authController.js';
import upload from '../config/multer.config.js'; // Configuración de Multer

const router = express.Router();

router.get('/whoIam', whoIam);
router.post('/social-login', socialLogin);
router.post("/register", upload.single('image'), register);
router.post("/register-enterprise", upload.fields([
    { name: "image", maxCount: 1 },  // 📌 Campo para una imagen principal
    { name: "images", maxCount: 9 }, // 📌 Campo para imágenes adicionales
]), registerEnterprise);
router.post('/getUsersByTokens', getUsersByTokens);
router.post("/login", login);
router.put('/edit', editUser);
router.put('/changeUserSuscription', changeUserSuscription);
router.delete('/deleteUser/:id', deleteUser);
router.get('/getModerators', getModerators);
router.get('/verifyAuth', verifyAdmin);
router.post("/requestPasswordReset", requestPasswordReset);
router.post("/verifyPasswordResetCode", verifyPasswordResetCode);
router.post("/resetPassword", resetPassword);

export default router;