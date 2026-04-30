import { Router } from 'express';
import SystemController from '../controllers/system.controller.js';

const router = Router();

router.get('/config', SystemController.getConfig);
router.put('/config', SystemController.updateConfig);
router.get('/public', SystemController.getPublicConfig);
router.get('/maintenance', SystemController.getMaintenanceStatus);

export default router;
