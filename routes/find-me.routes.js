import { Router } from 'express';
import FindMeController from '../controllers/FindMe.controller.js';
import upload from '../config/multer.config.js' // Multer config

const router = Router();

// Rutas para eventos
router.post('/',
    upload.fields([
        { name: "image", maxCount: 1 },  // 📌 Campo para una imagen principal
        { name: "images", maxCount: 9 }, // 📌 Campo para imágenes adicionales
    ]),
FindMeController.create);

router.get('/my', FindMeController.getByUser);
router.get('/', FindMeController.getAll);
router.get('/:id', FindMeController.getById);
router.put('/:id',
    upload.fields([
        { name: "image", maxCount: 1 },  // 📌 Campo para una imagen principal
        { name: "images", maxCount: 9 }, // 📌 Campo para imágenes adicionales
    ]),
FindMeController.update);

router.delete('/:id', FindMeController.delete);

export default router;