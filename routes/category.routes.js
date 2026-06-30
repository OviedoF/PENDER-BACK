import { Router } from 'express';
import CategoryController from '../controllers/category.controller.js';
import { requirePermission } from '../middlewares/roleMiddleware.js';
import upload from '../config/multer.config.js';

const router = Router();

// Rutas para categorías
router.post('/', upload.single('image'), requirePermission('configuracion', 'manage'), CategoryController.create);
router.get('/', CategoryController.getAll);
router.get('/:id', CategoryController.getById);
router.put('/:id', upload.single('image'), requirePermission('configuracion', 'manage'), CategoryController.update);
router.delete('/:id', CategoryController.delete);

export default router;
