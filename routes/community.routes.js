import { Router } from 'express';
import CommunityController from '../controllers/community.controller.js';
import { requirePermission } from '../middlewares/roleMiddleware.js';
import upload from '../config/multer.config.js';

const router = Router();

const viewComunidad = requirePermission('comunidad', 'view');
const moderateComunidad = requirePermission('comunidad', 'moderate');
const deleteComunidad = requirePermission('comunidad', 'delete');

// ─── ADMIN (before /:id to avoid capture) ────────────────────────────────────
router.get('/admin/export',                 viewComunidad,      CommunityController.adminExport);
router.get('/admin/all',                    viewComunidad,      CommunityController.adminGetAll);
router.get('/admin/metrics',                viewComunidad,      CommunityController.adminGetMetrics);
router.get('/admin/reported-comments',       viewComunidad,      CommunityController.adminGetReportedComments);
router.get('/admin/:id/comments',           viewComunidad,      CommunityController.adminGetComments);
router.get('/admin/:id',                    viewComunidad,      CommunityController.adminGetById);
router.post('/admin/official',              moderateComunidad,  CommunityController.adminCreateOfficial);
router.put('/admin/:id/official',           moderateComunidad,  CommunityController.adminToggleOfficial);
router.put('/admin/:id/featured',           moderateComunidad,  CommunityController.adminToggleFeatured);
router.put('/admin/:id/ban',                moderateComunidad,  CommunityController.adminBanUser);
router.put('/admin/:id/unban',              moderateComunidad,  CommunityController.adminUnbanUser);
router.put('/admin/comment/:id/dismiss',     moderateComunidad,  CommunityController.adminDismissReports);
router.delete('/admin/comment/:commentId',  deleteComunidad,    CommunityController.adminDeleteComment);
router.delete('/admin/:id',                 deleteComunidad,    CommunityController.adminDelete);

// ─── PUBLIC ───────────────────────────────────────────────────────────────────
router.post('/comment/:id/report',          CommunityController.reportComment);
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
