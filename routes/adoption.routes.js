import { Router } from 'express';
import AdoptionController from '../controllers/adoption.controller.js';
import { requirePermission } from '../middlewares/roleMiddleware.js';
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
const view = requirePermission('adopciones', 'view');
const manage = requirePermission('adopciones', 'manage');
const deleteAdopcion = requirePermission('adopciones', 'delete');

router.get('/admin/export',         view,   AdoptionController.adminExport);
router.get('/admin/all',            view,   AdoptionController.adminGetAll);
router.get('/admin/reports',        view,   AdoptionController.adminGetReports);
router.get('/admin/detect-fraud',   view,   AdoptionController.adminDetectFraud);
router.get('/admin/user/:userId',   view,   AdoptionController.adminGetUserHistory);
router.get('/admin/:id',            view,   AdoptionController.adminGetById);
router.put('/admin/:id/approve',    manage, AdoptionController.adminApprove);
router.put('/admin/:id/reject',     manage, AdoptionController.adminReject);
router.put('/admin/:id/adopted',    manage, AdoptionController.adminMarkAdopted);
router.put('/admin/:id/fraud',      manage, AdoptionController.adminFlagFraud);
router.delete('/admin/:id',         deleteAdopcion, AdoptionController.adminDelete);
router.put('/admin/reports/:id/resolve', manage, AdoptionController.adminResolveReport);

export default router;
