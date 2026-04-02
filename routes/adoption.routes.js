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
router.get('/not-adopted', AdoptionController.getAllToAdopt);
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

// ─── PUBLIC: Report abuse ─────────────────────────────────────────────────────
router.post('/:id/report', AdoptionController.reportAbuse);

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────────────
router.get('/admin/all',            AdoptionController.adminGetAll);
router.get('/admin/reports',        AdoptionController.adminGetReports);
router.get('/admin/detect-fraud',   AdoptionController.adminDetectFraud);
router.get('/admin/user/:userId',   AdoptionController.adminGetUserHistory);
router.get('/admin/:id',            AdoptionController.adminGetById);
router.put('/admin/:id/approve',    AdoptionController.adminApprove);
router.put('/admin/:id/reject',     AdoptionController.adminReject);
router.put('/admin/:id/adopted',    AdoptionController.adminMarkAdopted);
router.put('/admin/:id/fraud',      AdoptionController.adminFlagFraud);
router.delete('/admin/:id',         AdoptionController.adminDelete);
router.put('/admin/reports/:id/resolve', AdoptionController.adminResolveReport);

export default router;