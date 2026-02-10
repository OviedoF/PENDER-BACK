import { Router } from 'express';
import chatController from '../controllers/chat.controller.js';
import upload from '../config/multer.config.js' // Multer config

const router = Router();

// Rutas para chat
router.get('/chats', chatController.getUserChats);
router.get('/adoption-reqs', chatController.getUserAdoptionsReqs);
router.get('/adoption-solis', chatController.getUserAdoptionsSolis);
router.get('/messages/:chatId', chatController.getMessagesForChat);
router.post('/found-pet', chatController.foundPet);
router.post('/request-adoption', chatController.requestAdoption);
router.post('/send-message', upload.single('image'), chatController.sendMessage);
router.put('/read-messages/:chatId', chatController.readMessages);
router.put("/adoption/reject/:chatId", chatController.rejectAdoption);

export default router;