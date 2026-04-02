import { Router } from 'express';
import ForumController from '../controllers/forum.controller.js';
import upload from '../config/multer.config.js';

const router = Router();

// ─── ADMIN (before /:id to avoid capture) ────────────────────────────────────
router.get('/admin/all',                   ForumController.adminGetAll);
router.get('/admin/:id/comments',          ForumController.adminGetComments);
router.get('/admin/:id',                   ForumController.getById);
router.put('/admin/:id/close',             ForumController.adminToggleClosed);
router.put('/admin/:id/pin',               ForumController.adminTogglePinned);
router.delete('/admin/comment/:commentId', ForumController.adminDeleteComment);
router.delete('/admin/:id',                ForumController.adminDelete);

// ─── PUBLIC ───────────────────────────────────────────────────────────────────
router.post('/', upload.single('imagen'), ForumController.create);
router.get('/', ForumController.getAll);
router.get('/filters', ForumController.getCategoriesAndTags);
router.put('/like/:id', ForumController.likeForum);
router.put('/dislike/:id', ForumController.dislikeForum);
router.get('/:id', ForumController.getById);

export default router;
