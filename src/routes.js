import { Router } from 'express';

export const api = Router();

api.get('/', (_req, res) => {
  res.json({ nombre: 'API Eco Turismo Experiencial', version: '1.0.0', estado: 'ok' });
});
