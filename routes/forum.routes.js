import { Router } from 'express';
import ForumController from '../controllers/forum.controller.js';
import { requirePermission } from '../middlewares/roleMiddleware.js';
import upload from '../config/multer.config.js';

const router = Router();

const viewComunidad = requirePermission('comunidad', 'view');
const moderateComunidad = requirePermission('comunidad', 'moderate');
const deleteComunidad = requirePermission('comunidad', 'delete');

// ─── ADMIN (before /:id to avoid capture) ────────────────────────────────────
router.get('/admin/all',                   viewComunidad,      ForumController.adminGetAll);
router.get('/admin/reported-comments',      viewComunidad,      ForumController.adminGetReportedComments);
router.get('/admin/:id/comments',          viewComunidad,      ForumController.adminGetComments);
router.get('/admin/:id',                   viewComunidad,      ForumController.getById);
router.put('/admin/:id/close',             moderateComunidad,  ForumController.adminToggleClosed);
router.put('/admin/:id/pin',               moderateComunidad,  ForumController.adminTogglePinned);
router.put('/admin/:id/feature',           moderateComunidad,  ForumController.adminToggleFeatured);
router.put('/admin/comment/:id/dismiss',    moderateComunidad,  ForumController.adminDismissReports);
router.delete('/admin/comment/:commentId', deleteComunidad,    ForumController.adminDeleteComment);
router.delete('/admin/:id',                deleteComunidad,    ForumController.adminDelete);

// ─── PUBLIC ───────────────────────────────────────────────────────────────────
router.post('/comment/:id/report',         ForumController.reportComment);
router.post('/', upload.single('imagen'), ForumController.create);
router.get('/', ForumController.getAll);
router.get('/filters', ForumController.getCategoriesAndTags);
router.put('/like/:id', ForumController.likeForum);
router.put('/dislike/:id', ForumController.dislikeForum);
router.get('/:id', ForumController.getById);

export default router;
