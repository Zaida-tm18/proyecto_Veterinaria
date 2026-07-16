// Utilidad de línea de comandos para generar un hash bcrypt.
// Úsalo para crear las contraseñas que insertarás en la tabla "usuarios".
//
// Uso:
//   node src/hashPassword.js 123456
//
// Copia el hash que imprime y pégalo en el INSERT de schema.sql
// o en un UPDATE usuarios SET password_hash = '...' WHERE correo = '...';
const bcrypt = require('bcryptjs');

const plain = process.argv[2];
if (!plain) {
  console.error('Uso: node src/hashPassword.js <contraseña>');
  process.exit(1);
}

bcrypt.hash(plain, 10).then((hash) => {
  console.log(hash);
});
