// Nunca se expone el hash de la contraseña.
export const publicUser = (u) => ({
  id_usuario: u.id_usuario,
  nombre: u.nombre,
  correo: u.correo,
  telefono: u.telefono ?? null,
  rol: u.rol,
  estado: u.estado,
  fecha_registro: u.fecha_registro,
});
