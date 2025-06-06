import { Router } from 'express';
import ForumController from '../controllers/forum.controller.js';
import upload from '../config/multer.config.js'; // Configuración de Multer

const router = Router();

router.post('/', upload.single('imagen'), ForumController.create);
router.get('/', ForumController.getAll);
router.get('/:id', ForumController.getById);
router.put('/like/:id', ForumController.likeForum);
router.put('/dislike/:id', ForumController.dislikeForum);

export default router;
