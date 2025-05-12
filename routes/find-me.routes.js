import { Router } from 'express';
import FindMeController from '../controllers/FindMe.controller.js';
import upload from '../config/multer.config.js' // Multer config

const router = Router();

// Rutas para eventos
router.post('/', upload.single('image'), FindMeController.create);
router.get('/my', FindMeController.getByUser);
router.get('/', FindMeController.getAll);
router.get('/:id', FindMeController.getById);
router.put('/:id', upload.single('image'), FindMeController.update);
router.delete('/:id', FindMeController.delete);

export default router;