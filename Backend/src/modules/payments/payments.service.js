import { query, withTransaction } from '../../db/pool.js';
import { conflict, notFound } from '../../utils/errors.js';
import { simularPasarela } from '../../services/paymentGateway.js';
import { notify } from '../notifications/notifications.service.js';
import { codigoReserva, dinero, liberarYCancelar, mapReserva } from '../bookings/bookings.service.js';

const mapPago = (p) => ({
  id_pago: p.id_pago,
  id_reserva: p.id_reserva,
  monto: p.monto,
  metodo: p.metodo,
  estado: p.estado,
  referencia_pasarela: p.referencia_pasarela,
  fecha_pago: p.fecha_pago,
});

// RF-26 / RF-27: pago simulado. El monto SIEMPRE es el precio_total calculado por el backend, nunca un dato del cliente.
export async function simulate(user, { id_reserva: idReserva, metodo, resultado }) {
  const out = await withTransaction(async (c) => {
    const { rows: [r] } = await c.query(
      `SELECT r.*, s.tipo, s.titulo, s.id_anfitrion FROM reserva r JOIN servicio s ON s.id_servicio = r.id_servicio
        WHERE r.id_reserva = $1 FOR UPDATE OF r`,
      [idReserva],
    );
    if (!r || r.id_turista !== user.id_usuario) throw notFound('Reserva no encontrada');
    if (r.estado !== 'PENDIENTE_PAGO') throw conflict(`La reserva está ${r.estado} y no admite pagos`, 'RESERVA_NO_PAGABLE');

    const { rows: [{ vigente }] } = await c.query('SELECT now() < $1::timestamptz AS vigente', [r.expira_en]);
    if (!vigente) { // RF-22: pagar fuera de plazo cancela la reserva y libera el cupo
      await liberarYCancelar(c, r);
      return { expirada: true };
    }

    const gateway = simularPasarela({ resultado });
    const { rows: [pago] } = await c.query(
      'INSERT INTO pago (id_reserva, monto, metodo, estado, referencia_pasarela) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [r.id_reserva, r.precio_total, metodo, gateway.estado, gateway.referencia],
    );
    let reserva = r;
    if (gateway.estado === 'APROBADO') {
      ({ rows: [reserva] } = await c.query("UPDATE reserva SET estado = 'CONFIRMADA', expira_en = NULL WHERE id_reserva = $1 RETURNING *", [r.id_reserva]));
    }
    return { pago, reserva, previa: r };
  });
  if (out.expirada) throw conflict('La reserva expiró por falta de pago y fue cancelada', 'RESERVA_EXPIRADA');

  const { pago, reserva, previa } = out;
  if (pago.estado === 'APROBADO') {
    const codigo = codigoReserva(reserva.id_reserva);
    const resumen = `${previa.titulo}, del ${reserva.fecha_inicio} al ${reserva.fecha_fin}, ${reserva.num_personas} persona(s), total ${dinero(pago.monto)}`;
    // RF-28: resumen de la transacción al turista y alerta de reserva confirmada al anfitrión
    await notify(user.id_usuario, 'PAGO_APROBADO', `Pago aprobado (ref. ${pago.referencia_pasarela}). Reserva ${codigo} confirmada: ${resumen}.`, {
      correo: true,
      asunto: `Reserva ${codigo} confirmada`,
    });
    await notify(previa.id_anfitrion, 'NUEVA_RESERVA', `Nueva reserva confirmada ${codigo}: ${resumen}.`, { correo: true, asunto: `Nueva reserva ${codigo}` });
  }
  return {
    mensaje: pago.estado === 'APROBADO' ? 'Pago aprobado: la reserva quedó confirmada' : 'Pago rechazado: puedes reintentar mientras la reserva no venza',
    pago: mapPago(pago),
    reserva: mapReserva(reserva),
  };
}

export async function listByBooking(user, idReserva) {
  const { rows } = await query(
    `SELECT r.id_turista, s.id_anfitrion FROM reserva r JOIN servicio s ON s.id_servicio = r.id_servicio WHERE r.id_reserva = $1`,
    [idReserva],
  );
  const r = rows[0];
  if (!r || !(user.rol === 'ADMINISTRADOR' || r.id_turista === user.id_usuario || r.id_anfitrion === user.id_usuario)) throw notFound('Reserva no encontrada');
  const { rows: pagos } = await query('SELECT * FROM pago WHERE id_reserva = $1 ORDER BY id_pago', [idReserva]);
  return { data: pagos.map(mapPago) };
}
