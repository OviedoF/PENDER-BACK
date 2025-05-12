import { Router } from 'express';
import AdoptionController from '../controllers/adoption.controller.js';
import { onlyAdmin } from '../middlewares/roleMiddleware.js';
import upload from '../config/multer.config.js'; // Multer config

const router = Router();

// Rutas para adopciones
router.post(
    "/",
    upload.fields([
        { name: "image", maxCount: 1 },  // 📌 Campo para una imagen principal
        { name: "images", maxCount: 9 }, // 📌 Campo para imágenes adicionales
    ]),
    AdoptionController.create
);

router.get('/my-adoptions', AdoptionController.getByUser);
router.get('/', AdoptionController.getAll);
router.get('/:id', AdoptionController.getById);
router.put(
    '/:id',
    upload.fields([
        { name: "image", maxCount: 1 },  // 📌 Campo para una imagen principal
        { name: "images", maxCount: 9 }, // 📌 Campo para imágenes adicionales
    ]),
    AdoptionController.update
);
router.delete('/:id', AdoptionController.delete);

export default router;