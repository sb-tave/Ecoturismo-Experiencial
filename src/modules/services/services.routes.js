import { Router } from 'express';
import { z } from '../../utils/zodEs.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, optionalAuth, requireRole } from '../../middlewares/auth.js';
import { uploadFoto } from '../../middlewares/upload.js';
import { asyncHandler } from '../../utils/async.js';
import { diffDays } from '../../utils/dates.js';
import { idParam, isoDate, pagination } from '../../utils/schemas.js';
import * as service from './services.service.js';
import * as availability from './availability.service.js';
import * as photos from './photos.service.js';
import reviewsRoutes from '../reviews/reviews.routes.js';

const router = Router();
const host = [authenticate, requireRole('ANFITRION', 'NEGOCIO_LOCAL')];
const hostReservable = [authenticate, requireRole('ANFITRION')];

const tipo = z.enum(['ALOJAMIENTO', 'ACTIVIDAD', 'NEGOCIO_LOCAL']);
const fields = {
  id_categoria: z.coerce.number().int().positive(),
  titulo: z.string().trim().min(3).max(120),
  descripcion: z.string().trim().min(10).max(5000),
  precio_base: z.coerce.number().min(0).max(99999999.99).nullable().optional(),
  capacidad_max: z.coerce.number().int().min(1).max(1000).nullable().optional(),
  localidad: z.string().trim().min(2).max(100),
  direccion: z.string().trim().max(200).nullable().optional(),
  latitud: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitud: z.coerce.number().min(-180).max(180).nullable().optional(),
  contacto: z.string().trim().max(150).nullable().optional(),
};
const createSchema = z.object({ tipo, ...fields }).superRefine((s, ctx) => {
  for (const e of service.invariantErrors(s)) ctx.addIssue({ code: 'custom', path: [e.campo], message: e.mensaje });
});
const updateSchema = z
  .object(fields)
  .partial()
  .extend({ estado: z.enum(['ACTIVO', 'INACTIVO']).optional() })
  .strict()
  .refine((o) => Object.keys(o).length > 0, 'Envía al menos un campo para actualizar');

const searchQuery = z
  .object({
    q: z.string().trim().max(100).optional(),
    tipo: tipo.optional(),
    id_categoria: z.coerce.number().int().positive().optional(),
    localidad: z.string().trim().max(100).optional(),
    precio_min: z.coerce.number().min(0).optional(),
    precio_max: z.coerce.number().min(0).optional(),
    calificacion_min: z.coerce.number().min(1).max(5).optional(),
    personas: z.coerce.number().int().min(1).max(1000).optional(),
    fecha_inicio: isoDate.optional(),
    fecha_fin: isoDate.optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radio_km: z.coerce.number().min(0.1).max(500).default(25),
    orden: z.enum(['recientes', 'precio_asc', 'precio_desc', 'calificacion', 'distancia']).optional(),
    ...pagination,
  })
  .superRefine((q, ctx) => {
    const issue = (path, message) => ctx.addIssue({ code: 'custom', path: [path], message });
    if (q.fecha_inicio && !q.fecha_fin) issue('fecha_fin', 'Envía fecha_fin junto con fecha_inicio');
    if (q.fecha_fin && !q.fecha_inicio) issue('fecha_inicio', 'Envía fecha_inicio junto con fecha_fin');
    if (q.fecha_inicio && q.fecha_fin && q.fecha_fin < q.fecha_inicio) issue('fecha_fin', 'La fecha final no puede ser anterior a la inicial');
    if ((q.lat == null) !== (q.lng == null)) issue('lat', 'Envía lat y lng juntas');
    if (q.precio_min != null && q.precio_max != null && q.precio_min > q.precio_max) issue('precio_min', 'El precio mínimo no puede superar al máximo');
  });
const mineQuery = z.object({ estado: z.enum(['ACTIVO', 'INACTIVO', 'OCULTO']).optional(), ...pagination });

const rangeCheck = (o, ctx) => {
  if (o.hasta < o.desde) ctx.addIssue({ code: 'custom', path: ['hasta'], message: 'La fecha final no puede ser anterior a la inicial' });
  else if (diffDays(o.hasta, o.desde) > 365) ctx.addIssue({ code: 'custom', path: ['hasta'], message: 'El rango máximo es de 366 días' });
};
const availabilityQuery = z.object({ desde: isoDate.optional(), hasta: isoDate.optional() });
const availabilityBody = z.object({ desde: isoDate, hasta: isoDate, cupos_totales: z.coerce.number().int().min(1).max(1000) }).superRefine(rangeCheck);
const blockBody = z.object({ desde: isoDate, hasta: isoDate }).superRefine(rangeCheck);

const photoParams = z.object({ id: z.coerce.number().int().positive(), idFoto: z.coerce.number().int().positive() });
const photoBody = z
  .object({ orden: z.coerce.number().int().min(1).max(100).optional(), es_principal: z.boolean().optional() })
  .strict()
  .refine((o) => Object.keys(o).length > 0, 'Envía orden o es_principal');

// ---- Catálogo público y gestión de publicaciones ----
router.get('/', validate({ query: searchQuery }), asyncHandler(async (req, res) => res.json(await service.search(req.valid.query))));

router.get('/mine', ...host, validate({ query: mineQuery }), asyncHandler(async (req, res) => res.json(await service.listMine(req.user, req.valid.query))));

router.post('/', ...host, validate({ body: createSchema }), asyncHandler(async (req, res) => {
  res.status(201).json(await service.create(req.user, req.valid.body));
}));

router.get('/:id', optionalAuth, validate({ params: idParam }), asyncHandler(async (req, res) => {
  res.json(await service.getDetail(req.valid.params.id, req.user));
}));

router.patch('/:id', ...host, validate({ params: idParam, body: updateSchema }), asyncHandler(async (req, res) => {
  res.json(await service.update(req.user, req.valid.params.id, req.valid.body));
}));

router.delete('/:id', ...host, validate({ params: idParam }), asyncHandler(async (req, res) => {
  const r = await service.remove(req.user, req.valid.params.id);
  res.json({
    ...r,
    mensaje: r.eliminado ? 'Publicación eliminada' : 'La publicación tiene reservas, por eso se desactivó en lugar de eliminarse',
  });
}));

// ---- Disponibilidad (RF-17, RF-18) ----
router.get('/:id/availability', optionalAuth, validate({ params: idParam, query: availabilityQuery }), asyncHandler(async (req, res) => {
  res.json(await availability.getAvailability(req.valid.params.id, req.valid.query, req.user));
}));

router.put('/:id/availability', ...hostReservable, validate({ params: idParam, body: availabilityBody }), asyncHandler(async (req, res) => {
  res.json(await availability.setAvailability(req.user, req.valid.params.id, req.valid.body));
}));

router.post('/:id/availability/block', ...hostReservable, validate({ params: idParam, body: blockBody }), asyncHandler(async (req, res) => {
  res.json(await availability.blockDates(req.user, req.valid.params.id, req.valid.body));
}));

// ---- Fotografías (RF-09) ----
router.post('/:id/photos', ...host, validate({ params: idParam }), uploadFoto, asyncHandler(async (req, res) => {
  res.status(201).json(await photos.addPhoto(req.user, req.valid.params.id, req.file));
}));

router.patch('/:id/photos/:idFoto', ...host, validate({ params: photoParams, body: photoBody }), asyncHandler(async (req, res) => {
  const { id, idFoto } = req.valid.params;
  res.json(await photos.updatePhoto(req.user, id, idFoto, req.valid.body));
}));

router.delete('/:id/photos/:idFoto', ...host, validate({ params: photoParams }), asyncHandler(async (req, res) => {
  const { id, idFoto } = req.valid.params;
  await photos.deletePhoto(req.user, id, idFoto);
  res.json({ mensaje: 'Foto eliminada' });
}));

// ---- Calificaciones y reseñas (RF-29, RF-30) ----
router.use('/:id/reviews', reviewsRoutes);

export default router;
