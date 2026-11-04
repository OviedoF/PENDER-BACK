import { Router } from 'express';
import ContactController from '../controllers/contact.controller.js';

const router = Router();

// Público: formulario de contacto de la landing.
router.post('/', ContactController.send);

export default router;
