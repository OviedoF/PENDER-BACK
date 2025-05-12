import { Router } from 'express';
import ReviewController from '../controllers/review.controller.js';

const router = Router();

// Rutas para reviews
router.post('/', ReviewController.create);
router.get('/', ReviewController.getAll);
router.get('/:id', ReviewController.getById);
router.put('/:id', ReviewController.update);
router.delete('/:id', ReviewController.delete);

export default router;