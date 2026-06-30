import { Router } from 'express';
import SystemController from '../controllers/system.controller.js';
import { requirePermission } from '../middlewares/roleMiddleware.js';

const router = Router();

router.get('/config', requirePermission('configuracion', 'view'), SystemController.getConfig);
router.put('/config', requirePermission('configuracion', 'manage'), SystemController.updateConfig);
router.get('/public', SystemController.getPublicConfig);
router.get('/maintenance', SystemController.getMaintenanceStatus);

export default router;
