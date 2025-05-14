import express from 'express';
import { requestVerification, verifyCode } from '../controllers/emailVerification.controller.js';

const router = express.Router();

router.post('/request-code', requestVerification);
router.post('/verify-code', verifyCode);

export default router;