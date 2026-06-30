import { Router } from 'express';
import GeoController from '../controllers/geo.controller.js';
import { requirePermission } from '../middlewares/roleMiddleware.js';

const router = Router();

const view = requirePermission('geolocalizacion', 'view');
const manage = requirePermission('geolocalizacion', 'manage');

router.get('/config', view, GeoController.getConfig);
router.put('/config', manage, GeoController.updateConfig);
router.get('/map', view, GeoController.getMapData);
router.get('/stats', view, GeoController.getStats);

export default router;
