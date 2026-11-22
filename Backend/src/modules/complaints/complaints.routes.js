import { Router } from 'express';
import { z } from '../../utils/zodEs.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, requireRole } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/async.js';
import * as service from './complaints.service.js';

const router = Router();

const createSchema = z
  .object({
    id_servicio: z.coerce.number().int().positive().optional(),
    id_calificacion: z.coerce.number().int().positive().optional(),
    motivo: z.string().trim().min(5).max(255),
  })
  .refine((o) => (o.id_servicio ? 1 : 0) + (o.id_calificacion ? 1 : 0) === 1, 'Denuncia una publicación (id_servicio) o una reseña (id_calificacion), no ambas');

// RF-34: denunciar una publicación o una reseña
router.post('/', authenticate, requireRole('TURISTA', 'ANFITRION', 'NEGOCIO_LOCAL'), validate({ body: createSchema }), asyncHandler(async (req, res) => {
  res.status(201).json(await service.create(req.user, req.valid.body));
}));

export default router;
