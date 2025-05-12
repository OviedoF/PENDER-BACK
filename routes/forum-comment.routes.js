import { Router } from 'express';
import ForumCommentController from '../controllers/forumComment.controller.js';

const router = Router();

router.post('/', ForumCommentController.create);
router.get('/forum/:forumId', ForumCommentController.getAllByForum);
router.get('/:id', ForumCommentController.getById);
router.put('/:id', ForumCommentController.update);
router.put('/like/:id', ForumCommentController.like);
router.put('/dislike/:id', ForumCommentController.dislike);
router.delete('/:id', ForumCommentController.delete);

export default router;