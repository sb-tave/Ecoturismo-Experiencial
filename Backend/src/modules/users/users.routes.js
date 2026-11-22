import { Router } from 'express';
import { z } from '../../utils/zodEs.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/async.js';
import { password, phone } from '../../utils/schemas.js';
import * as service from './users.service.js';

const router = Router();
router.use(authenticate);

const updateSchema = z
  .object({ nombre: z.string().trim().min(2).max(100).optional(), telefono: phone.nullable().optional() })
  .refine((o) => Object.keys(o).length > 0, 'Envía al menos un campo para actualizar');
const passwordSchema = z.object({ contrasena_actual: z.string().min(1).max(72), contrasena_nueva: password });
const deleteSchema = z.object({ contrasena: z.string().min(1).max(72) });

// RNF-07: el titular puede consultar, actualizar y solicitar la eliminación de sus datos.
router.get('/me', asyncHandler(async (req, res) => res.json(await service.getById(req.user.id_usuario))));

router.patch('/me', validate({ body: updateSchema }), asyncHandler(async (req, res) => {
  res.json(await service.updateProfile(req.user.id_usuario, req.valid.body));
}));

router.patch('/me/password', validate({ body: passwordSchema }), asyncHandler(async (req, res) => {
  await service.changePassword(req.user.id_usuario, req.valid.body.contrasena_actual, req.valid.body.contrasena_nueva);
  res.json({ mensaje: 'Contraseña actualizada' });
}));

router.delete('/me', validate({ body: deleteSchema }), asyncHandler(async (req, res) => {
  await service.deleteAccount(req.user, req.valid.body.contrasena);
  res.json({ mensaje: 'Tu cuenta fue eliminada y tus datos personales anonimizados' });
}));

export default router;
