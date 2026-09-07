import express from 'express';
import {
    getNotificationByUser,
    adminGetNotifications,
    adminCreateNotification,
    adminDeleteNotification,
    adminGetTemplates,
    adminUpdateTemplate,
    adminResetTemplate,
} from '../controllers/systemNotifications.controller.js';
import { requirePermission } from '../middlewares/roleMiddleware.js';

const router = express.Router();

const view = requirePermission('marketing', 'view');
const manage = requirePermission('marketing', 'manage');

// Obtener próxima notificación del usuario autenticado
router.get('/next', getNotificationByUser);

// ─── Admin: plantillas por evento (antes de /admin/:id para no capturarlas) ──
router.get('/admin/templates', view, adminGetTemplates);
router.put('/admin/templates/:event', manage, adminUpdateTemplate);
router.delete('/admin/templates/:event', manage, adminResetTemplate);

// ─── Admin: historial y envío manual ─────────────────────────────────────────
router.get('/admin', view, adminGetNotifications);
router.post('/admin', manage, adminCreateNotification);
router.delete('/admin/:id', manage, adminDeleteNotification);

export default router;
