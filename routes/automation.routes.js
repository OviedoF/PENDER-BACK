import { Router } from 'express';
import AutomationController from '../controllers/automation.controller.js';
import { requirePermission } from '../middlewares/roleMiddleware.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/config', requirePermission('automatizaciones', 'view'), AutomationController.getConfig);
router.put('/config', requirePermission('automatizaciones', 'manage'), AutomationController.updateConfig);

router.post('/survey', protect, AutomationController.submitSurvey);
router.get('/surveys', requirePermission('automatizaciones', 'view'), AutomationController.getSurveys);

export default router;
