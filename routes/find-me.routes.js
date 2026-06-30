import { Router } from 'express';
import FindMeController from '../controllers/FindMe.controller.js';
import { requirePermission } from '../middlewares/roleMiddleware.js';
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

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────────────
const viewMascotas = requirePermission('mascotas', 'view');
const editMascotas = requirePermission('mascotas', 'edit');
const deleteMascotas = requirePermission('mascotas', 'delete');

// Specific routes must come before parameterized (/admin/:id)
router.get('/admin/export', viewMascotas, FindMeController.adminExport);
router.get('/admin/all', viewMascotas, FindMeController.adminGetAll);
router.get('/admin/matches/:id', viewMascotas, FindMeController.adminGetMatches);
router.get('/admin/zones', viewMascotas, FindMeController.adminGetZoneConfigs);
router.get('/admin/:id', viewMascotas, FindMeController.adminGetById);
router.post('/admin/merge', editMascotas, FindMeController.adminMerge);
router.put('/admin/zones', editMascotas, FindMeController.adminUpsertZoneConfig);
router.post('/admin/zones/notify', editMascotas, FindMeController.adminSendZoneNotification);
router.put('/admin/:id/status', editMascotas, FindMeController.adminUpdateStatus);
router.delete('/admin/:id', deleteMascotas, FindMeController.adminDelete);
router.post('/admin/:id/notify', editMascotas, FindMeController.adminSendNotification);

export default router;
