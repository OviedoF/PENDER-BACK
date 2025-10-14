import { Router } from 'express';
import ServiceController from '../controllers/service.controller.js';
import upload from '../config/multer.config.js'; // Multer config

const router = Router();

// Rutas para servicios
router.post('/', upload.fields([
    { name: 'imagen', maxCount: 1 },
    { name: 'imagenes', maxCount: 5 }
]), ServiceController.create);
router.get('/categories', ServiceController.getCategories);
router.get('/categories/tags', ServiceController.getCategoriesWithTags);
router.get('/categories/tags/:category', ServiceController.getTagsByCategory);
router.put('/view/:id', ServiceController.addView);
router.get('/my', ServiceController.getByUser);
router.get('/', ServiceController.getAll);
router.get('/:id', ServiceController.getById);
router.get('/user/totals/:serviceId', ServiceController.getTotals );
router.get('/user/stats/:serviceId', ServiceController.getViewsAndReviews);
router.get('/user/stats', ServiceController.getStats);
router.put('/:id', upload.fields([
    { name: 'imagen', maxCount: 1 },
    { name: 'imagenes', maxCount: 5 }
]), ServiceController.update);
router.delete('/:id', ServiceController.delete);

export default router;
