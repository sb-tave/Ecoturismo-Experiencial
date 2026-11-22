import { Router } from 'express';
import { z } from '../../utils/zodEs.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate } from '../../middlewares/auth.js';
import { authLimiter } from '../../middlewares/rateLimit.js';
import { asyncHandler } from '../../utils/async.js';
import { password, phone } from '../../utils/schemas.js';
import { config } from '../../config/env.js';
import * as service from './auth.service.js';

const router = Router();

const registerSchema = z.object({
  nombre: z.string().trim().min(2).max(100),
  correo: z.string().trim().toLowerCase().email().max(150),
  contrasena: password,
  telefono: phone.optional(),
  // El rol ADMINISTRADOR nunca se asigna desde el registro público (RF-01)
  rol: z.enum(['TURISTA', 'ANFITRION', 'NEGOCIO_LOCAL']),
  acepta_politica: z.literal(true, 'Debes aceptar la política de tratamiento de datos personales'),
  politica_version: z.string().trim().max(10).optional(),
});
const loginSchema = z.object({ correo: z.string().trim().toLowerCase().email(), contrasena: z.string().min(1).max(72) });

// Versión vigente de la política de datos (RF-02). El texto de la política lo publica el frontend.
router.get('/policy', (_req, res) => res.json({ version: config.policyVersion }));

router.post('/register', authLimiter, validate({ body: registerSchema }), asyncHandler(async (req, res) => {
  const usuario = await service.register(req.valid.body);
  res.status(201).json({ mensaje: 'Cuenta creada. Ya puedes iniciar sesión', usuario });
}));

router.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(async (req, res) => {
  res.json(await service.login(req.valid.body));
}));

// Los JWT no tienen estado en el servidor (RNF-10): el cliente descarta el token y este vence solo.
router.post('/logout', authenticate, (_req, res) => res.json({ mensaje: 'Sesión cerrada. Elimina el token en el cliente' }));

export default router;
