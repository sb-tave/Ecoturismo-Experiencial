// Recorrido de humo contra un servidor en ejecución:  npm run smoke   (requiere npm run seed:demo)
import { addDays, todayISO } from '../src/utils/dates.js';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const CLAVE = 'Demo12345';
let fallos = 0;

async function api(method, ruta, { token, body } = {}) {
  const res = await fetch(`${BASE}${ruta}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
const paso = (nombre, ok, detalle = '') => {
  if (!ok) fallos += 1;
  console.log(`${ok ? '✔' : '✘'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
};

const salud = await api('GET', '/health');
paso('Servidor en línea', salud.status === 200);
const login = async (correo, contrasena = CLAVE) => (await api('POST', '/api/auth/login', { body: { correo, contrasena } })).body?.token;
const turista = await login('turista@demo.test');
const anfitrion = await login('anfitrion@demo.test');
const admin = await login(process.env.ADMIN_EMAIL || 'admin@ecoturismo.local', process.env.ADMIN_PASSWORD || 'Admin12345');
paso('Inicio de sesión de turista, anfitrión y administrador', Boolean(turista && anfitrion && admin));

const inicio = addDays(todayISO(), 5);
const fin = addDays(todayISO(), 7);
const busqueda = await api('GET', `/api/services?tipo=ALOJAMIENTO&localidad=Salento&fecha_inicio=${inicio}&fecha_fin=${fin}&personas=2`);
const servicio = busqueda.body?.data?.[0];
paso('Búsqueda con filtros y disponibilidad', Boolean(servicio), servicio ? `${servicio.titulo} · ${servicio.localidad}` : 'sin resultados (¿ejecutó npm run seed:demo?)');
if (!servicio) process.exit(1);

const cerca = await api('GET', '/api/services?lat=4.6372&lng=-75.57&radio_km=30');
paso('Búsqueda por cercanía', cerca.body?.data?.length > 0, `${cerca.body?.data?.length} resultado(s)`);

const reserva = await api('POST', '/api/bookings', { token: turista, body: { id_servicio: servicio.id_servicio, fecha_inicio: inicio, fecha_fin: fin, num_personas: 2 } });
paso('Reserva creada (pendiente de pago)', reserva.status === 201, `${reserva.body?.codigo} · total ${reserva.body?.precio_total}`);

const pago = await api('POST', '/api/payments/simulate', { token: turista, body: { id_reserva: reserva.body?.id_reserva, metodo: 'TARJETA_SIMULADA', resultado: 'APROBADO' } });
paso('Pago simulado aprobado → reserva confirmada', pago.body?.reserva?.estado === 'CONFIRMADA');

const recibidas = await api('GET', '/api/bookings?estado=CONFIRMADA', { token: anfitrion });
paso('El anfitrión ve la reserva recibida', recibidas.body?.data?.some((r) => r.id_reserva === reserva.body?.id_reserva));
const avisos = await api('GET', '/api/notifications?no_leidas=true', { token: anfitrion });
paso('El anfitrión recibió la notificación', avisos.body?.data?.some((n) => n.tipo === 'NUEVA_RESERVA'));

const resumen = await api('GET', '/api/admin/reports/summary', { token: admin });
paso('Reporte del administrador', resumen.status === 200, `${resumen.body?.total_reservas} reserva(s) en el rango`);

const cancelada = await api('PATCH', `/api/bookings/${reserva.body?.id_reserva}/cancel`, { token: turista });
paso('Reserva cancelada y cupos liberados (limpieza)', cancelada.status === 200);

console.log(fallos ? `\n${fallos} paso(s) fallaron` : '\nTodo en orden');
process.exit(fallos ? 1 : 0);
