// Datos iniciales.  npm run seed        -> categorías + cuenta de administrador
//                    npm run seed:demo   -> además usuarios, publicaciones, cupos y una reseña de ejemplo
import bcrypt from 'bcryptjs';
import { pool, withTransaction } from '../src/db/pool.js';
import { config } from '../src/config/env.js';
import { addDays, todayISO } from '../src/utils/dates.js';

const demo = process.argv.includes('--demo');
if (demo && config.isProd && !process.argv.includes('--force')) {
  console.error('Los datos de demostración no se cargan en producción (use --force si de verdad lo necesita).');
  process.exit(1);
}

const CATEGORIAS = [
  ['Hotel rural', 'Hoteles y posadas en entornos rurales'],
  ['Finca turística', 'Fincas con alojamiento y experiencias del campo'],
  ['Cabaña y camping', 'Cabañas, glamping y zonas de camping'],
  ['Senderismo y caminatas', 'Rutas guiadas y caminatas ecológicas'],
  ['Avistamiento de aves', 'Observación de fauna y aves'],
  ['Agroturismo y gastronomía', 'Recorridos productivos y cocina tradicional'],
  ['Artesanías y comercio local', 'Negocios y productos de la región'],
  ['Fiestas y cultura tradicional', 'Fiestas, ferias y experiencias culturales'],
];

async function crearUsuario(c, { nombre, correo, contrasena, rol }) {
  const { rows } = await c.query('SELECT id_usuario FROM usuario WHERE lower(correo) = lower($1)', [correo]);
  if (rows[0]) return { id: rows[0].id_usuario, nuevo: false };
  const hash = await bcrypt.hash(contrasena, config.bcryptRounds);
  const { rows: [u] } = await c.query(
    'INSERT INTO usuario (nombre, correo, contrasena_hash, rol, politica_version, politica_aceptada_en) VALUES ($1, $2, $3, $4, $5, now()) RETURNING id_usuario',
    [nombre, correo.toLowerCase(), hash, rol, config.policyVersion],
  );
  return { id: u.id_usuario, nuevo: true };
}

const adminCorreo = process.env.ADMIN_EMAIL || 'admin@ecoturismo.local';
const adminClave = process.env.ADMIN_PASSWORD;
if (config.isProd && !adminClave) {
  console.error('En producción debe definir ADMIN_PASSWORD para crear la cuenta de administrador.');
  process.exit(1);
}

const DEMO_CLAVE = 'Demo12345';
const SERVICIOS_DEMO = [
  { tipo: 'ALOJAMIENTO', categoria: 'Cabaña y camping', titulo: 'Cabaña del Río', precio: 180000, cap: 4, localidad: 'Salento', lat: 4.6372, lng: -75.57,
    descripcion: 'Cabaña de madera junto a una quebrada, con senderos privados y desayuno campesino incluido.' },
  { tipo: 'ALOJAMIENTO', categoria: 'Finca turística', titulo: 'Finca Cafetera La Esperanza', precio: 250000, cap: 6, localidad: 'Jardín', lat: 5.599, lng: -75.819,
    descripcion: 'Finca cafetera con habitaciones familiares, recorrido del café y vista a las montañas.' },
  { tipo: 'ACTIVIDAD', categoria: 'Senderismo y caminatas', titulo: 'Caminata por el valle', precio: 60000, cap: 12, localidad: 'Salento', lat: 4.642, lng: -75.565,
    descripcion: 'Recorrido guiado de medio día por bosque de niebla con guía local certificado.' },
  { tipo: 'ACTIVIDAD', categoria: 'Avistamiento de aves', titulo: 'Avistamiento de aves al amanecer', precio: 45000, cap: 8, localidad: 'Jardín', lat: 5.601, lng: -75.823,
    descripcion: 'Salida de observación de aves con binoculares y guía, incluye tinto de bienvenida.' },
];

try {
  await withTransaction(async (c) => {
    for (const [nombre, descripcion] of CATEGORIAS) {
      await c.query('INSERT INTO categoria (nombre, descripcion) VALUES ($1, $2) ON CONFLICT DO NOTHING', [nombre, descripcion]);
    }
    const admin = await crearUsuario(c, { nombre: 'Administrador', correo: adminCorreo, contrasena: adminClave || 'Admin12345', rol: 'ADMINISTRADOR' });
    console.log(`Categorías listas. Administrador: ${adminCorreo} ${admin.nuevo ? '(creado)' : '(ya existía)'}`);
    if (!demo) return;

    const turista = await crearUsuario(c, { nombre: 'Camila Rojas', correo: 'turista@demo.test', contrasena: DEMO_CLAVE, rol: 'TURISTA' });
    const anfitrion = await crearUsuario(c, { nombre: 'Andrés Molina', correo: 'anfitrion@demo.test', contrasena: DEMO_CLAVE, rol: 'ANFITRION' });
    const negocio = await crearUsuario(c, { nombre: 'Rosa Gómez', correo: 'negocio@demo.test', contrasena: DEMO_CLAVE, rol: 'NEGOCIO_LOCAL' });
    if (!anfitrion.nuevo) { console.log('Los datos de demostración ya estaban cargados.'); return; }

    const catId = async (nombre) => (await c.query('SELECT id_categoria FROM categoria WHERE lower(nombre) = lower($1)', [nombre])).rows[0].id_categoria;
    const ids = [];
    for (const s of SERVICIOS_DEMO) {
      const { rows: [r] } = await c.query(
        `INSERT INTO servicio (id_anfitrion, id_categoria, tipo, titulo, descripcion, precio_base, capacidad_max, localidad, latitud, longitud)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id_servicio`,
        [anfitrion.id, await catId(s.categoria), s.tipo, s.titulo, s.descripcion, s.precio, s.cap, s.localidad, s.lat, s.lng],
      );
      ids.push(r.id_servicio);
      await c.query(
        `INSERT INTO disponibilidad (id_servicio, fecha, cupos_totales, cupos_disponibles)
         SELECT $1::int, ($2::date + g)::date, $3::int, $3::int FROM generate_series(0, 59) g`,
        [r.id_servicio, addDays(todayISO(), 1), s.tipo === 'ACTIVIDAD' ? 10 : 2],
      );
    }
    await c.query(
      `INSERT INTO servicio (id_anfitrion, id_categoria, tipo, titulo, descripcion, localidad, latitud, longitud, contacto)
       VALUES ($1,$2,'NEGOCIO_LOCAL','Artesanías Doña Rosa','Tejidos, cerámica y dulces típicos elaborados por artesanos de la región.','Salento',4.6365,-75.5712,'3001234567')`,
      [negocio.id, await catId('Artesanías y comercio local')],
    );

    // Una estadía ya completada y pagada para poder probar el flujo de calificaciones
    const { rows: [reserva] } = await c.query(
      `INSERT INTO reserva (id_turista, id_servicio, fecha_inicio, fecha_fin, num_personas, precio_total, estado)
       VALUES ($1, $2, $3, $4, 2, 360000, 'COMPLETADA') RETURNING id_reserva`,
      [turista.id, ids[0], addDays(todayISO(), -10), addDays(todayISO(), -8)],
    );
    await c.query("INSERT INTO pago (id_reserva, monto, metodo, estado, referencia_pasarela) VALUES ($1, 360000, 'TARJETA_SIMULADA', 'APROBADO', 'SIM-DEMO0001')", [reserva.id_reserva]);
    await c.query(
      "INSERT INTO calificacion (id_reserva, id_servicio, id_turista, puntuacion, comentario) VALUES ($1, $2, $3, 5, 'Un lugar tranquilo, ideal para descansar.')",
      [reserva.id_reserva, ids[0], turista.id],
    );
    await c.query('UPDATE servicio SET promedio_calificacion = 5 WHERE id_servicio = $1', [ids[0]]);
    console.log(`Datos de demostración cargados. Cuentas (contraseña ${DEMO_CLAVE}): turista@demo.test, anfitrion@demo.test, negocio@demo.test`);
  });
} catch (err) {
  console.error('No se pudieron cargar los datos iniciales:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
