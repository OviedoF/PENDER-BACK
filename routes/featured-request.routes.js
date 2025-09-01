// routes/featured.routes.js
import { Router } from "express";
import FeaturedController from "../controllers/featuredRequest.controller.js";
import { onlyAdmin, onlyAprobator } from "../middlewares/roleMiddleware.js";

const router = Router();

// CRUD Featured
router.post("/", FeaturedController.create);
router.get("/", FeaturedController.getAll);
router.get("/service/:serviceId", FeaturedController.findByService);
router.get("/:id", FeaturedController.getById);
router.put("/:id", FeaturedController.update);
router.delete("/:id", FeaturedController.delete);

// Acciones de aprobación y rechazo
router.post("/:id/approve", FeaturedController.approve);
router.post("/:id/reject", FeaturedController.reject);

export default router;
