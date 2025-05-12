import { Router } from 'express';
import CategoryController from '../controllers/category.controller.js';
import { onlyAdmin } from '../middlewares/roleMiddleware.js';
import upload from '../config/multer.config.js';

const router = Router();

// Rutas para categorías
router.post('/', upload.single('image'), onlyAdmin, CategoryController.create);
router.get('/', CategoryController.getAll);
router.get('/:id', CategoryController.getById);
router.put('/:id', upload.single('image'), onlyAdmin, CategoryController.update);
router.delete('/:id', CategoryController.delete);

export default router;
