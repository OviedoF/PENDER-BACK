import express from 'express';
import statsController from '../controllers/stats.controller.js';
import { onlyAdmin } from '../middlewares/roleMiddleware.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/kpis',         onlyAdmin, statsController.getKPIs);
router.get('/growth',       onlyAdmin, statsController.getGrowth);
router.get('/charts',       onlyAdmin, statsController.getCharts);
router.get('/zone-reports', onlyAdmin, statsController.getZoneReports);
router.get('/recent',       onlyAdmin, statsController.getRecentActivity);
router.post('/session',     protect,   statsController.recordSession);

export default router;
