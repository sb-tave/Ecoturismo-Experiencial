import { Router } from 'express';
import { z } from '../../utils/zodEs.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/async.js';
import { idParam, pagination } from '../../utils/schemas.js';
import * as service from './notifications.service.js';

const router = Router();
router.use(authenticate);

const listQuery = z.object({ no_leidas: z.enum(['true', 'false']).transform((v) => v === 'true').optional(), ...pagination });

router.get('/', validate({ query: listQuery }), asyncHandler(async (req, res) => res.json(await service.list(req.user, req.valid.query))));
router.patch('/read-all', asyncHandler(async (req, res) => res.json(await service.markAllRead(req.user))));
router.patch('/:id/read', validate({ params: idParam }), asyncHandler(async (req, res) => res.json(await service.markRead(req.user, req.valid.params.id))));

export default router;
