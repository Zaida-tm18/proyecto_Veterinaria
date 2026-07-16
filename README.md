# Veterinaria Jenny's — Guía de instalación

Este proyecto ahora tiene dos partes:

```
proyecto/
├── frontend/   → el sitio HTML/CSS/JS que ya tenías (con Ver/Editar arreglados y conectado a la API)
└── backend/    → API en Node.js + Express, conectada a PostgreSQL
```

## 1. Crear la base de datos

Con PostgreSQL ya instalado en tu máquina, crea la base de datos:

```bash
psql -U postgres -c "CREATE DATABASE veterinaria;"
```

Carga el esquema y los datos de prueba:

```bash
psql -U postgres -d veterinaria -f backend/sql/schema.sql
```

Esto crea todas las tablas y 6 usuarios de prueba, todos con la contraseña **`123456`**:

| Correo                              | Rol            |
|--------------------------------------|----------------|
| admin@veterinariajenny.com           | admin          |
| jenny@veterinariajenny.com           | veterinario    |
| miguel@veterinariajenny.com          | veterinario    |
| recepcion@veterinariajenny.com       | recepcionista  |
| carlos@example.com                   | dueño de mascota |
| maria@example.com                    | dueño de mascota |

## 2. Configurar y levantar el backend

```bash
cd backend
cp .env.example .env
```

Abre `.env` y ajusta `PGUSER`, `PGPASSWORD`, etc. a tu instalación local de Postgres.

Instala dependencias y arranca:

```bash
npm install
npm run dev
```

Deberías ver: `API de Veterinaria Jenny's escuchando en http://localhost:4000`

Prueba que responde:

```bash
curl http://localhost:4000/api/health
```

## 3. Abrir el frontend

El frontend sigue siendo estático (no necesita Node para servirse), pero como hace `fetch()` al backend, ábrelo con un servidor local en vez de doble clic en el archivo (para evitar problemas de `file://`):

```bash
cd frontend
npx serve .
# o: python3 -m http.server 5500
```

Abre `http://localhost:5500/login.html` e inicia sesión con cualquiera de los usuarios de la tabla de arriba.

## 4. Qué se arregló respecto al prototipo original

- **Botones "Ver" / "Editar"**: antes no hacían nada o no pasaban el `id` del registro. Ahora `main.js` pasa `?id=` en la URL y `forms.js` precarga los datos reales desde la API.
- **"Guardar" no guardaba nada**: el prototipo solo simulaba el guardado con un `alert`. Ahora cada formulario hace `POST`/`PUT` real contra el backend, que inserta/actualiza en PostgreSQL.
- **Datos hardcodeados en `data.js`**: eliminado. Todo viene de la base de datos vía `/api/...`.
- **Sin login**: se agregó `login.html` + autenticación JWT + 4 roles (admin, veterinario, recepcionista, dueño de mascota), cada uno con permisos distintos (ver `backend/src/routes/*.routes.js` para el detalle de qué puede hacer cada rol).
- **Eliminar**: ahora es un borrado lógico (columna `eliminado`), como ya sugería el modal original de "papelera de recuperación", pero real.

## 5. Próximos pasos sugeridos

- Cambiar `JWT_SECRET` en `.env` por una cadena aleatoria larga antes de usar esto en producción.
- Si vas a desplegar, restringe `cors()` en `backend/src/server.js` al dominio real de tu frontend en vez de aceptar cualquier origen.
- Si necesitas que un dueño de mascota pueda **registrarse solo** (ahora mismo los usuarios se crean directo en la base de datos), habría que agregar un endpoint `POST /api/auth/registro`.
- Considera agregar recuperación de contraseña si este sistema va a usarse con clientes reales.
