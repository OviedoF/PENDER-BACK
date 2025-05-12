import { Router } from 'express';
import CommentController from '../controllers/communityComment.controller.js';

const router = Router();

router.post('/', CommentController.create);
router.get('/community/:communityId', CommentController.getAllByCommunity);
router.get('/:id', CommentController.getById);
router.put('/:id', CommentController.update);
router.put('/like/:id', CommentController.like);
router.put('/dislike/:id', CommentController.dislike);
router.delete('/:id', CommentController.delete);

export default router;
