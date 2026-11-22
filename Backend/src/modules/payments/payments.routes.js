import { Router } from 'express';
import { z } from '../../utils/zodEs.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, requireRole } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/async.js';
import * as service from './payments.service.js';

const router = Router();
router.use(authenticate);

// El cliente no envía el monto ni datos de tarjeta: solo la reserva y el medio simulado (RNF-05).
const simulateSchema = z.object({
  id_reserva: z.coerce.number().int().positive(),
  metodo: z.enum(['TARJETA_SIMULADA', 'TRANSFERENCIA_SIMULADA']),
  resultado: z.enum(['APROBADO', 'RECHAZADO']).optional(),
});
const listQuery = z.object({ id_reserva: z.coerce.number().int().positive() });

router.post('/simulate', requireRole('TURISTA'), validate({ body: simulateSchema }), asyncHandler(async (req, res) => {
  res.status(201).json(await service.simulate(req.user, req.valid.body));
}));

router.get('/', validate({ query: listQuery }), asyncHandler(async (req, res) => res.json(await service.listByBooking(req.user, req.valid.query.id_reserva))));

export default router;
