import assert from 'node:assert/strict';
import { addDays, todayISO } from '../src/utils/dates.js';
import { createCategory, registerUser, uniq } from './helpers.js';

export const d = (n) => addDays(todayISO(), n);

// Crea un anfitrión con un servicio (alojamiento o actividad) y cupos para los próximos días.
export async function escenario(api, { tipo = 'ALOJAMIENTO', cupos = 1, precio = 100000, capacidad = 4, dias = 15 } = {}) {
  const host = await registerUser(api, 'ANFITRION');
  const cat = await createCategory(`Categoría ${uniq()}`);
  const base = { id_categoria: cat, titulo: `Servicio ${uniq()}`, descripcion: 'Descripción de prueba para el servicio.', precio_base: precio, capacidad_max: capacidad, localidad: 'Salento' };
  const r = await api('POST', '/api/services', { token: host.token, body: { tipo, ...base } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const servicio = r.body;
  const disp = await api('PUT', `/api/services/${servicio.id_servicio}/availability`, { token: host.token, body: { desde: d(1), hasta: d(dias), cupos_totales: cupos } });
  assert.equal(disp.status, 200, JSON.stringify(disp.body));
  return { host, servicio };
}

export const reservar = (api, token, idServicio, inicio, fin, personas = 2) =>
  api('POST', '/api/bookings', { token, body: { id_servicio: idServicio, fecha_inicio: inicio, fecha_fin: fin, num_personas: personas } });

export const pagar = (api, token, idReserva, resultado = 'APROBADO', metodo = 'TARJETA_SIMULADA') =>
  api('POST', '/api/payments/simulate', { token, body: { id_reserva: idReserva, metodo, resultado } });

export const cupos = async (api, idServicio, desde, hasta) =>
  (await api('GET', `/api/services/${idServicio}/availability?desde=${desde}&hasta=${hasta}`)).body.dias.map((x) => x.cupos_disponibles);
