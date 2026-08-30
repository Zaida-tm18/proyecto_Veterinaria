// Validación de fechas/horas usada por los controladores. No se usa
// Date.parse()/new Date(str) para validar directamente porque JS "corrige"
// fechas imposibles en vez de rechazarlas (ej. "2024-02-31" se convierte
// silenciosamente en el 2 de marzo); aquí se valida el calendario real.

// "YYYY-MM-DD" con día/mes/año que realmente existen en el calendario.
function esFechaValida(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [anio, mes, dia] = valor.split('-').map(Number);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return false;
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  return d.getUTCFullYear() === anio && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

// "HH:MM" en formato 24 horas.
function esHoraValida(valor) {
  return typeof valor === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(valor);
}

// Combina fecha ("YYYY-MM-DD") + hora ("HH:MM") en un Date real, o
// devuelve null si alguna de las dos no es válida.
function combinarFechaHora(fecha, hora) {
  if (!esFechaValida(fecha) || !esHoraValida(hora)) return null;
  return new Date(`${fecha}T${hora}:00`);
}

module.exports = { esFechaValida, esHoraValida, combinarFechaHora };
