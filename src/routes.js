import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import categoriesRoutes from './modules/categories/categories.routes.js';
import servicesRoutes from './modules/services/services.routes.js';
import bookingsRoutes from './modules/bookings/bookings.routes.js';
import paymentsRoutes from './modules/payments/payments.routes.js';
import notificationsRoutes from './modules/notifications/notifications.routes.js';
import complaintsRoutes from './modules/complaints/complaints.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';

export const api = Router();

api.get('/', (_req, res) => {
  res.json({ nombre: 'API Eco Turismo Experiencial', version: '1.0.0', estado: 'ok' });
});

api.use('/auth', authRoutes);
api.use('/users', usersRoutes);
api.use('/categories', categoriesRoutes);
api.use('/services', servicesRoutes);
api.use('/bookings', bookingsRoutes);
api.use('/payments', paymentsRoutes);
api.use('/notifications', notificationsRoutes);
api.use('/complaints', complaintsRoutes);
api.use('/admin', adminRoutes);
