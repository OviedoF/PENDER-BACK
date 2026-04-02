import { Router } from 'express';
import CommunityController from '../controllers/community.controller.js';
import { onlyAdmin } from '../middlewares/roleMiddleware.js';
import upload from '../config/multer.config.js';

const router = Router();

// ─── ADMIN (before /:id to avoid capture) ────────────────────────────────────
router.get('/admin/all',                    CommunityController.adminGetAll);
router.get('/admin/metrics',                CommunityController.adminGetMetrics);
router.post('/admin/official',              CommunityController.adminCreateOfficial);
router.get('/admin/:id/comments',           CommunityController.adminGetComments);
router.get('/admin/:id',                    CommunityController.adminGetById);
router.put('/admin/:id/official',           CommunityController.adminToggleOfficial);
router.put('/admin/:id/featured',           CommunityController.adminToggleFeatured);
router.put('/admin/:id/ban',                CommunityController.adminBanUser);
router.put('/admin/:id/unban',              CommunityController.adminUnbanUser);
router.delete('/admin/comment/:commentId',  CommunityController.adminDeleteComment);
router.delete('/admin/:id',                 CommunityController.adminDelete);

// ─── PUBLIC ───────────────────────────────────────────────────────────────────
router.post('/', upload.single('imagen'), CommunityController.create);
router.get('/', CommunityController.getAll);
router.get('/owner', CommunityController.getByOwner);
router.get('/member', CommunityController.getByMemberId);
router.get('/members/:id', CommunityController.getMembers);
router.get('/getPendingMembers/:id', CommunityController.getPendingMembers);
router.get('/getRoleMembers/:id', CommunityController.getRoleMembers);
router.get('/adminsCount/:id', CommunityController.adminsCount);
router.put('/addMember/:id', CommunityController.addMemberToCommunity);
router.put('/handle/member', CommunityController.acceptOrRejectMember);
router.put('/addEmailToRole/:id', CommunityController.addEmailToRole);
router.delete('/deleteMember/:id', CommunityController.deleteMember);
router.get('/:id', CommunityController.getById);
router.put('/:id', upload.single('imagen'), CommunityController.update);
router.delete('/:id', CommunityController.delete);

export default router;
