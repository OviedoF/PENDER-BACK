import { Router } from 'express';
import GeoController from '../controllers/geo.controller.js';

const router = Router();

router.get('/config', GeoController.getConfig);
router.put('/config', GeoController.updateConfig);
router.get('/map', GeoController.getMapData);
router.get('/stats', GeoController.getStats);

export default router;
