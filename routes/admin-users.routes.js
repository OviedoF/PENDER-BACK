import { Router } from 'express';
import AdminUsersController from '../controllers/admin-users.controller.js';

const router = Router();

// Roles
router.get('/roles',       AdminUsersController.getRoles);
router.post('/roles',      AdminUsersController.createRole);
router.put('/roles/:id',   AdminUsersController.updateRole);
router.delete('/roles/:id', AdminUsersController.deleteRole);

// Admin users
router.get('/users',       AdminUsersController.getAdminUsers);
router.post('/users',      AdminUsersController.createAdminUser);
router.put('/users/:id',   AdminUsersController.updateAdminUser);
router.delete('/users/:id', AdminUsersController.deleteAdminUser);

export default router;
