import { Router } from 'express';
import ReviewController from '../controllers/review.controller.js';

const router = Router();

// Crear nueva reseña
router.post('/', ReviewController.create);

// Obtener todas las reseñas (opcionalmente filtradas por servicio)
router.get('/', ReviewController.getAll);

// 🔥 Obtener todas las reseñas de los servicios del dueño autenticado
router.get('/owner/all', ReviewController.getAllByOwner);

// Obtener reseña por ID
router.get('/:id', ReviewController.getById);

// Actualizar reseña (solo autor)
router.put('/:id', ReviewController.update);

// Eliminar reseña (soft delete)
router.delete('/:id', ReviewController.delete);

// 🔥 Responder a una reseña (solo dueño del servicio)
router.post('/:id/respond', ReviewController.respond);

export default router;
