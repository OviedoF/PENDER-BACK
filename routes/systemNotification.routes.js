import express from 'express';
import { getNotificationByUser } from '../controllers/systemNotifications.controller.js';

const router = express.Router();

// Obtener próxima notificación del usuario autenticado
router.get('/next', getNotificationByUser);

export default router;