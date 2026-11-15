import { Router } from 'express';
import { z } from '../../utils/zodEs.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, requireRole } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/async.js';
import { diffDays } from '../../utils/dates.js';
import { idParam, isoDate, pagination } from '../../utils/schemas.js';
import * as admin from './admin.service.js';
import * as complaints from '../complaints/complaints.service.js';

const router = Router();
router.use(authenticate, requireRole('ADMINISTRADOR'));

const motivo = z.string().trim().min(5, 'Indica el motivo (mínimo 5 caracteres)').max(200);

// RF-31
router.get('/users', validate({ query: z.object({
  rol: z.enum(['TURISTA', 'ANFITRION', 'NEGOCIO_LOCAL', 'ADMINISTRADOR']).optional(),
  estado: z.enum(['ACTIVO', 'SUSPENDIDO', 'ELIMINADO']).optional(),
  q: z.string().trim().max(100).optional(),
  ...pagination,
}) }), asyncHandler(async (req, res) => res.json(await admin.listUsers(req.valid.query))));

router.patch('/users/:id/status', validate({ params: idParam, body: z.object({ estado: z.enum(['ACTIVO', 'SUSPENDIDO']) }) }), asyncHandler(async (req, res) => {
  res.json(await admin.setUserStatus(req.user, req.valid.params.id, req.valid.body));
}));

// RF-32
router.get('/services', validate({ query: z.object({
  estado: z.enum(['ACTIVO', 'INACTIVO', 'OCULTO']).optional(),
  q: z.string().trim().max(100).optional(),
  ...pagination,
}) }), asyncHandler(async (req, res) => res.json(await admin.listServices(req.valid.query))));

router.patch('/services/:id/moderation', validate({ params: idParam, body: z.discriminatedUnion('accion', [
  z.object({ accion: z.literal('OCULTAR'), motivo }),
  z.object({ accion: z.literal('RESTAURAR') }),
]) }), asyncHandler(async (req, res) => res.json(await admin.moderateService(req.user, req.valid.params.id, req.valid.body))));

router.delete('/services/:id', validate({ params: idParam, body: z.object({ motivo }) }), asyncHandler(async (req, res) => {
  res.json(await admin.deleteService(req.user, req.valid.params.id, req.valid.body));
}));

// RF-33
router.get('/reviews', validate({ query: z.object({
  estado: z.enum(['VISIBLE', 'OCULTA']).optional(),
  id_servicio: z.coerce.number().int().positive().optional(),
  ...pagination,
}) }), asyncHandler(async (req, res) => res.json(await admin.listReviews(req.valid.query))));

router.patch('/reviews/:id/moderation', validate({ params: idParam, body: z.discriminatedUnion('accion', [
  z.object({ accion: z.literal('OCULTAR'), motivo }),
  z.object({ accion: z.literal('RESTAURAR') }),
]) }), asyncHandler(async (req, res) => res.json(await admin.moderateReview(req.valid.params.id, req.valid.body))));

router.delete('/reviews/:id', validate({ params: idParam, body: z.object({ motivo }) }), asyncHandler(async (req, res) => {
  res.json(await admin.deleteReview(req.valid.params.id, req.valid.body));
}));

// RF-35
router.get('/complaints', validate({ query: z.object({
  estado: z.enum(['PENDIENTE', 'RESUELTA', 'DESESTIMADA']).optional(),
  tipo: z.enum(['PUBLICACION', 'RESENA']).optional(),
  ...pagination,
}) }), asyncHandler(async (req, res) => res.json(await complaints.list(req.valid.query))));

router.patch('/complaints/:id', validate({ params: idParam, body: z.object({ accion: z.enum(['OCULTAR', 'DESESTIMAR']) }) }), asyncHandler(async (req, res) => {
  res.json(await complaints.resolve(req.user, req.valid.params.id, req.valid.body));
}));

// RF-37
const summaryQuery = z
  .object({ desde: isoDate.optional(), hasta: isoDate.optional() })
  .superRefine((q, ctx) => {
    if (q.desde && q.hasta && q.hasta < q.desde) ctx.addIssue({ code: 'custom', path: ['hasta'], message: 'La fecha final no puede ser anterior a la inicial' });
    else if (q.desde && q.hasta && diffDays(q.hasta, q.desde) > 730) ctx.addIssue({ code: 'custom', path: ['hasta'], message: 'El rango máximo es de dos años' });
  });
router.get('/reports/summary', validate({ query: summaryQuery }), asyncHandler(async (req, res) => res.json(await admin.summary(req.valid.query))));

export default router;
