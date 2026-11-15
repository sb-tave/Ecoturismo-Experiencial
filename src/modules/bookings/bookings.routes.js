import { Router } from 'express';
import { z } from '../../utils/zodEs.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, requireRole } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/async.js';
import { idParam, isoDate, pagination } from '../../utils/schemas.js';
import * as service from './bookings.service.js';

const router = Router();
router.use(authenticate);

const createSchema = z
  .object({
    id_servicio: z.coerce.number().int().positive(),
    fecha_inicio: isoDate,
    fecha_fin: isoDate,
    num_personas: z.coerce.number().int().min(1).max(1000),
  })
  .refine((o) => o.fecha_fin >= o.fecha_inicio, { path: ['fecha_fin'], message: 'La fecha final no puede ser anterior a la inicial' });
const listQuery = z.object({
  estado: z.enum(['PENDIENTE_PAGO', 'CONFIRMADA', 'COMPLETADA', 'CANCELADA']).optional(),
  id_servicio: z.coerce.number().int().positive().optional(),
  desde: isoDate.optional(),
  hasta: isoDate.optional(),
  ...pagination,
});
const cancelSchema = z.object({ motivo: z.string().trim().max(200).optional() });

router.post('/', requireRole('TURISTA'), validate({ body: createSchema }), asyncHandler(async (req, res) => {
  res.status(201).json(await service.create(req.user, req.valid.body));
}));

// Turista: sus reservas. Anfitrión: las reservas recibidas. Administrador: todas.
router.get('/', requireRole('TURISTA', 'ANFITRION', 'ADMINISTRADOR'), validate({ query: listQuery }), asyncHandler(async (req, res) => {
  res.json(await service.list(req.user, req.valid.query));
}));

router.get('/:id', validate({ params: idParam }), asyncHandler(async (req, res) => res.json(await service.getById(req.user, req.valid.params.id))));

router.patch('/:id/cancel', requireRole('TURISTA', 'ADMINISTRADOR'), validate({ params: idParam, body: cancelSchema }), asyncHandler(async (req, res) => {
  res.json(await service.cancel(req.user, req.valid.params.id, req.valid.body));
}));

export default router;
