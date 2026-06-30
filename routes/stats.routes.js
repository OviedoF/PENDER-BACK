import express from 'express';
import statsController from '../controllers/stats.controller.js';
import { requirePermission } from '../middlewares/roleMiddleware.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

const view = requirePermission('dashboard', 'view');

router.get('/kpis',         view, statsController.getKPIs);
router.get('/growth',       view, statsController.getGrowth);
router.get('/charts',       view, statsController.getCharts);
router.get('/zone-reports', view, statsController.getZoneReports);
router.get('/conversions',  view, statsController.getConversions);
router.get('/recent',       view, statsController.getRecentActivity);
router.post('/session',     protect,   statsController.recordSession);

export default router;
