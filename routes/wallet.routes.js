import { Router } from 'express';
import WalletController from '../controllers/wallet.controller.js';

const router = Router();

router.get('/', WalletController.getWallet);
router.get('/pending', WalletController.getPendingMovements);
router.post('/withdraw', WalletController.createWithdrawalRequest);

router.put('/:movementId/approve', WalletController.approveMovement);
router.put('/:movementId/reject', WalletController.rejectMovement);

export default router;