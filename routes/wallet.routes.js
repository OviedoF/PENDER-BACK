import { Router } from 'express';
import WalletController from '../controllers/wallet.controller.js';
import { requirePermission } from '../middlewares/roleMiddleware.js';

const router = Router();

router.get('/', WalletController.getWallet);
router.post('/withdraw', WalletController.createWithdrawalRequest);

// Admin routes
router.get('/pending', requirePermission('pagos', 'view'), WalletController.getPendingMovements);
router.put('/:movementId/approve', requirePermission('pagos', 'manage'), WalletController.approveMovement);
router.put('/:movementId/reject', requirePermission('pagos', 'manage'), WalletController.rejectMovement);

export default router;
