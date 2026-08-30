// Cliente HTTP centralizado hacia el backend.
// Todas las páginas cargan este archivo antes que data.js/main.js/forms.js.

const API_BASE = 'http://localhost:4000/api';

function getToken() { return localStorage.getItem('token'); }
function getUsuario() {
  const raw = localStorage.getItem('usuario');
  return raw ? JSON.parse(raw) : null;
}
function setSesion(token, usuario) {
  localStorage.setItem('token', token);
  localStorage.setItem('usuario', JSON.stringify(usuario));
}
function cerrarSesion() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.href = pathToLogin();
}
function pathToLogin() {
  // Calcula la ruta relativa al login.html según la profundidad de la página actual.
  return window.location.pathname.includes('/pages/') ? '../login.html' : 'login.html';
}

// Redirige a login si no hay sesión. Se llama al inicio de cada página protegida.
function exigirSesion() {
  if (!getToken() || !getUsuario()) {
    window.location.href = pathToLogin();
    return false;
  }
  return true;
}

// Wrapper de fetch que agrega el token y maneja errores de forma uniforme.
async function apiFetch(path, options = {}) {
  const headers = Object.assign(
    { 'Content-Type': 'application/json' },
    options.headers || {}
  );
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // Solo forzamos reingreso si el 401 vino de una petición que SÍ llevaba
  // token (sesión vencida/inválida). Si no hay token, el 401 es una
  // respuesta normal del endpoint (p. ej. login con credenciales
  // incorrectas) y debe manejarse como cualquier otro error de la API.
  if (res.status === 401) {
    cerrarSesion();
    throw new Error('Sesión expirada.');
  }
//&& token
  let data = null;
  try { data = await res.json(); } catch (_) { /* respuesta sin cuerpo */ }

  if (!res.ok) {
    throw new Error((data && data.error) || `Error ${res.status}`);
  }
  return data;
}

// Envuelve cada <input type="password"> dentro de "root" en un wrapper con
// un botón "ojo" para mostrar/ocultar el texto. Reutilizable en cualquier
// pantalla: login, registro, formulario de usuario, etc. Solo JS, sin libs.
function enablePasswordToggles(root = document) {
  root.querySelectorAll('input[type="password"]').forEach((input) => {
    if (input.closest('.pw-wrap')) return; // ya envuelto, evita duplicar
    const wrap = document.createElement('div');
    wrap.className = 'pw-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pw-toggle';
    btn.setAttribute('aria-label', 'Mostrar contraseña');
    btn.textContent = '👁️';
    btn.addEventListener('click', () => {
      const oculto = input.type === 'password';
      input.type = oculto ? 'text' : 'password';
      btn.textContent = oculto ? '🙈' : '👁️';
      btn.setAttribute('aria-label', oculto ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
    wrap.appendChild(btn);
  });
}

const api = {
  login: (correo, password) =>
    apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ correo, password }) }),
  registro: (data) =>
    apiFetch('/auth/registro', { method: 'POST', body: JSON.stringify(data) }),

  mascotas: {
    listar: () => apiFetch('/mascotas'),
    obtener: (id) => apiFetch(`/mascotas/${id}`),
    crear: (data) => apiFetch('/mascotas', { method: 'POST', body: JSON.stringify(data) }),
    actualizar: (id, data) => apiFetch(`/mascotas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    eliminar: (id) => apiFetch(`/mascotas/${id}`, { method: 'DELETE' }),
  },
  citas: {
    listar: () => apiFetch('/citas'),
    obtener: (id) => apiFetch(`/citas/${id}`),
    crear: (data) => apiFetch('/citas', { method: 'POST', body: JSON.stringify(data) }),
    actualizar: (id, data) => apiFetch(`/citas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    eliminar: (id) => apiFetch(`/citas/${id}`, { method: 'DELETE' }),
  },
  tratamientos: {
    listar: () => apiFetch('/tratamientos'),
    obtener: (id) => apiFetch(`/tratamientos/${id}`),
    crear: (data) => apiFetch('/tratamientos', { method: 'POST', body: JSON.stringify(data) }),
    actualizar: (id, data) => apiFetch(`/tratamientos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    eliminar: (id) => apiFetch(`/tratamientos/${id}`, { method: 'DELETE' }),
  },
  pagos: {
    listar: () => apiFetch('/pagos'),
    obtener: (id) => apiFetch(`/pagos/${id}`),
    crear: (data) => apiFetch('/pagos', { method: 'POST', body: JSON.stringify(data) }),
    actualizar: (id, data) => apiFetch(`/pagos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    eliminar: (id) => apiFetch(`/pagos/${id}`, { method: 'DELETE' }),
  },
  inventario: {
    listar: () => apiFetch('/inventario'),
    obtener: (id) => apiFetch(`/inventario/${id}`),
    crear: (data) => apiFetch('/inventario', { method: 'POST', body: JSON.stringify(data) }),
    actualizar: (id, data) => apiFetch(`/inventario/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    eliminar: (id) => apiFetch(`/inventario/${id}`, { method: 'DELETE' }),
  },
  usuarios: {
    listarPorRol: (rol) => apiFetch(`/usuarios?rol=${encodeURIComponent(rol)}`),
    listar: () => apiFetch('/usuarios?todos=1'),
    obtener: (id) => apiFetch(`/usuarios/${id}`),
    crear: (data) => apiFetch('/usuarios', { method: 'POST', body: JSON.stringify(data) }),
    actualizar: (id, data) => apiFetch(`/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  configuracion: {
    obtener: () => apiFetch('/configuracion'),
    actualizar: (data) => apiFetch('/configuracion', { method: 'PUT', body: JSON.stringify(data) }),
  },
};

// ------------------------------------------------------------------
// Branding de la clínica (nombre + logo), usado en TODAS las páginas
// (incluidas login.html y registro.html, que no tienen sesión).
// Estrategia: pintar de inmediato con lo que haya en caché local (para
// que no "parpadee" el nombre por defecto) y luego refrescar desde la
// API por si el admin lo cambió recientemente.
// ------------------------------------------------------------------
const CLINICA_POR_DEFECTO = { nombre_clinica: "Veterinaria Jenny's", logo_data: null, direccion: '', telefono: '', correo_contacto: '' };

function getClinicaCache() {
  try {
    const raw = localStorage.getItem('clinica');
    return raw ? Object.assign({}, CLINICA_POR_DEFECTO, JSON.parse(raw)) : CLINICA_POR_DEFECTO;
  } catch (_) { return CLINICA_POR_DEFECTO; }
}

// Aplica los datos de la clínica a cualquier elemento marcado con los
// atributos data-clinica-* presentes en la página actual.
function aplicarClinica(cfg) {
  document.querySelectorAll('[data-clinica-nombre]').forEach((el) => { el.textContent = cfg.nombre_clinica; });
  document.querySelectorAll('[data-clinica-logo]').forEach((img) => {
    if (cfg.logo_data) { img.src = cfg.logo_data; img.style.display = ''; }
    else { img.removeAttribute('src'); img.style.display = 'none'; }
  });
  if (document.title.includes("Veterinaria Jenny's") && cfg.nombre_clinica !== "Veterinaria Jenny's") {
    document.title = document.title.replace("Veterinaria Jenny's", cfg.nombre_clinica);
  }
}

// Se llama al final de cada página (después de pintar el layout/sidebar
// o el formulario de login/registro) para refrescar el branding.
async function cargarClinica() {
  aplicarClinica(getClinicaCache()); // pintado inmediato con la caché
  try {
    const cfg = await api.configuracion.obtener();
    localStorage.setItem('clinica', JSON.stringify(cfg));
    aplicarClinica(cfg);
    return cfg;
  } catch (_) {
    return getClinicaCache(); // sin backend disponible, seguimos con la caché
  }
}
