import { Router } from 'express';
import AutomationController from '../controllers/automation.controller.js';

const router = Router();

router.get('/config', AutomationController.getConfig);
router.put('/config', AutomationController.updateConfig);

export default router;
