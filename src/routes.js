import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';

export const api = Router();

api.get('/', (_req, res) => {
  res.json({ nombre: 'API Eco Turismo Experiencial', version: '1.0.0', estado: 'ok' });
});

api.use('/auth', authRoutes);
api.use('/users', usersRoutes);
