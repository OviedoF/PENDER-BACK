import { Router } from 'express';
import BackupController from '../controllers/backup.controller.js';
import { requirePermission } from '../middlewares/roleMiddleware.js';

const router = Router();

const view = requirePermission('configuracion', 'view');
const manage = requirePermission('configuracion', 'manage');

router.get('/config', view, BackupController.getConfig);
router.put('/config', manage, BackupController.updateConfig);
router.get('/list', view, BackupController.listBackups);
router.post('/create', manage, BackupController.createBackup);
router.get('/download/:filename', view, BackupController.downloadBackup);
router.get('/full-report', view, BackupController.fullReport);
router.delete('/:filename', manage, BackupController.deleteBackup);

export default router;
