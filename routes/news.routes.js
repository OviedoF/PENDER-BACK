import { Router } from 'express';
import NewsController from '../controllers/news.controller.js';
import { requirePermission } from '../middlewares/roleMiddleware.js';
import upload from '../config/multer.config.js';

const router = Router();

const view = requirePermission('marketing', 'view');
const manage = requirePermission('marketing', 'manage');

// Público: feed de novedades para la web
router.get('/feed', NewsController.feed);

// Admin
router.get('/', view, NewsController.list);
router.post('/', manage, upload.single('imagen'), NewsController.create);
router.put('/:id', manage, upload.single('imagen'), NewsController.update);
router.delete('/:id', manage, NewsController.remove);

export default router;
