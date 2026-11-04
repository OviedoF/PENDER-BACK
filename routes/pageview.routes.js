import { Router } from 'express';
import PageViewController from '../controllers/pageview.controller.js';
import { requirePermission } from '../middlewares/roleMiddleware.js';

const router = Router();

// Beacon público de la landing.
router.post('/', PageViewController.hit);

// Estadísticas para el panel admin.
router.get('/stats', requirePermission('dashboard', 'view'), PageViewController.stats);

export default router;
