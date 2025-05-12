import { Router } from 'express';
import CommunityController from '../controllers/community.controller.js';
import { onlyAdmin } from '../middlewares/roleMiddleware.js';
import upload from '../config/multer.config.js'; // Configuración de Multer

const router = Router();

router.post('/', upload.single('imagen'), CommunityController.create);
router.get('/', CommunityController.getAll);
router.get('/owner', CommunityController.getByOwner);
router.get('/member', CommunityController.getByMemberId);
router.get('/getPendingMembers/:id', CommunityController.getPendingMembers);
router.get('/:id', CommunityController.getById);
router.put('/:id', upload.single('imagen'), CommunityController.update);
router.put('/addMember/:id', CommunityController.addMemberToCommunity);
router.delete('/:id', CommunityController.delete);

// * ADMIN MANAGE

router.get('/members/:id', CommunityController.getMembers);
router.delete('/deleteMember/:id', CommunityController.deleteMember);
router.get('/adminsCount/:id', CommunityController.adminsCount);
router.put('/addEmailToRole/:id', CommunityController.addEmailToRole);
router.put('/handle/member', CommunityController.acceptOrRejectMember);
router.get('/getRoleMembers/:id', CommunityController.getRoleMembers);

export default router;
