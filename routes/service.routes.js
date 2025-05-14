import { Router } from 'express';
import ServiceController from '../controllers/service.controller.js';
import upload from '../config/multer.config.js'; // Multer config

const router = Router();

// Rutas para servicios
router.post('/', upload.single('image'), ServiceController.create);
router.put('/view/:id', ServiceController.addView);
router.get('/my', ServiceController.getByUser);
router.get('/', ServiceController.getAll);
router.get('/:id', ServiceController.getById);
router.get('/user/stats', ServiceController.getStats);
router.put('/:id', upload.single('image'), ServiceController.update);
router.delete('/:id', ServiceController.delete);

export default router;
