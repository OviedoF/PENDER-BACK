import { Router } from 'express';
import AdminUsersController from '../controllers/admin-users.controller.js';
import { requirePermission } from '../middlewares/roleMiddleware.js';

const router = Router();

const viewAdmin = requirePermission('adminUsuarios', 'view');
const manageAdmin = requirePermission('adminUsuarios', 'manage');

// Roles
router.get('/roles',       viewAdmin,   AdminUsersController.getRoles);
router.post('/roles',      manageAdmin, AdminUsersController.createRole);
router.put('/roles/:id',   manageAdmin, AdminUsersController.updateRole);
router.delete('/roles/:id', manageAdmin, AdminUsersController.deleteRole);

// Admin users
router.get('/users',       viewAdmin,   AdminUsersController.getAdminUsers);
router.post('/users',      manageAdmin, AdminUsersController.createAdminUser);
router.put('/users/:id',   manageAdmin, AdminUsersController.updateAdminUser);
router.delete('/users/:id', manageAdmin, AdminUsersController.deleteAdminUser);

export default router;
