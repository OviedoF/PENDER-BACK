import { Router } from 'express';
import analyticsController from '../controllers/analytics.controller.js';
import { requirePermission } from '../middlewares/roleMiddleware.js';

const router = Router();

const view = requirePermission('dashboard', 'view');

router.get('/sessions',        view, analyticsController.getSessionMetrics);
router.get('/cohort-retention', view, analyticsController.getCohortRetention);
router.get('/top-categories',   view, analyticsController.getTopCategories);
router.get('/top-enterprises',  view, analyticsController.getTopEnterprises);
router.get('/zone-activity',    view, analyticsController.getZoneActivity);
router.get('/adoption-funnel',  view, analyticsController.getAdoptionFunnel);
router.get('/findme-funnel',    view, analyticsController.getFindMeFunnel);

export default router;
