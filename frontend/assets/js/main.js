
document.addEventListener('DOMContentLoaded', async () => {
  // En páginas de formulario, forms.js maneja el arranque (necesita cargar
  // datos async antes de pintar el layout), así que main.js no hace nada ahí.
  if (document.body.dataset.form) return;

  if (!exigirSesion()) return;

  const page = document.body.dataset.page;
  try {
    if (page === 'dashboard') await renderDashboard();
    if (page === 'mascotas') await renderMascotas();
    if (page === 'citas') await renderCitas();
    if (page === 'tratamientos') await renderTratamientos();
    if (page === 'pagos') await renderPagos();
    if (page === 'inventario') await renderInventario();
    if (page === 'usuarios') await renderUsuarios();
  } catch (err) {
    console.error(err);
    alert('Ocurrió un error cargando los datos: ' + err.message);
  }
});

function money(n) { return '$' + Number(n).toFixed(2); }
function normalize(text) { return String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function isLowStock(p) { return Number(p.cantidad) <= Number(p.minimo); }

function goTo(url) { window.location.href = url; }

function markActiveNav() {
  const page = document.body.dataset.page;
  document.querySelectorAll('.nav-link').forEach(a => {
    if (a.dataset.page === page) a.classList.add('active');
  });
}
function setupHelp() {
  const btn = document.querySelector('.help-float');
  if (btn) { btn.addEventListener('click', () => alert('Ayuda contextual: usa el menú lateral para cambiar de módulo. Los botones azules abren formularios o pantallas relacionadas.')) }
}
function setupModal() {
  const backdrop = document.querySelector('#confirmModal');
  if (!backdrop) return;
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal() });
  document.querySelector('#modalCancel')?.addEventListener('click', closeModal);
}
function openConfirm(title, text, onOk) {
  const modal = document.querySelector('#confirmModal');
  document.querySelector('#modalTitle').textContent = title;
  document.querySelector('#modalText').textContent = text;
  const ok = document.querySelector('#modalOk');
  ok.className = 'btn danger';
  ok.textContent = 'Confirmar';
  ok.onclick = () => { closeModal(); onOk?.(); };
  modal.classList.add('show');
}
function closeModal() { document.querySelector('#confirmModal')?.classList.remove('show'); }

// Etiquetas legibles para cada rol, usadas en el badge de la barra lateral.
const ROL_LABELS = {
  admin: 'Administrador',
  veterinario: 'Veterinario',
  recepcionista: 'Recepcionista',
  dueno_mascota: 'Dueño de mascota',
};

function sidebar(prefix = '') {
  const usuario = getUsuario();
  const rol = usuario?.rol;
  const esStaffAdministrativo = ['admin', 'recepcionista'].includes(rol);
  const puedeVerInventario = ['admin', 'veterinario', 'recepcionista'].includes(rol);

  return `
  <aside class="sidebar">
    <div class="logo"><strong>Veterinaria Jenny's</strong><span>Sistema web propuesto</span></div>
    <div class="nav-title">Principal</div>
    <a class="nav-link" data-page="dashboard" href="${prefix}index.html">🏠 Inicio</a>
    <details class="nav-group" open>
      <summary class="nav-link">🩺 Clínica <small>▾</small></summary>
      <a class="nav-link" data-page="mascotas" href="${prefix}pages/mascotas.html">🐾 Mascotas</a>
      <a class="nav-link" data-page="citas" href="${prefix}pages/citas.html">📅 Citas</a>
      <a class="nav-link" data-page="tratamientos" href="${prefix}pages/tratamientos.html">💊 Tratamientos</a>
    </details>
    ${esStaffAdministrativo ? `
    <details class="nav-group" open>
      <summary class="nav-link">🏢 Administración <small>▾</small></summary>
      <a class="nav-link" data-page="pagos" href="${prefix}pages/pagos.html">💵 Pagos</a>
    </details>` : rol === 'dueno_mascota' ? `
    <details class="nav-group" open>
      <summary class="nav-link">🏢 Mi cuenta <small>▾</small></summary>
      <a class="nav-link" data-page="pagos" href="${prefix}pages/pagos.html">💵 Mis pagos</a>
    </details>` : ''}
    ${puedeVerInventario ? `
    <details class="nav-group" open>
      <summary class="nav-link">📦 Inventario <small>▾</small></summary>
      <a class="nav-link" data-page="inventario" href="${prefix}pages/inventario.html">📦 Inventario</a>
    </details>` : ''}
    ${rol === 'admin' ? `
    <details class="nav-group" open>
      <summary class="nav-link">👤 Usuarios <small>▾</small></summary>
      <a class="nav-link" data-page="usuarios" href="${prefix}pages/usuarios.html">👤 Usuarios</a>
    </details>` : ''}
    <div class="nav-title">Sesión</div>
    <div style="padding:10px 12px;font-size:.85rem;color:var(--muted)">
      ${usuario ? `<b style="color:var(--text)">${usuario.nombre}</b><br>${ROL_LABELS[usuario.rol] || usuario.rol}` : ''}
    </div>
    <button class="btn ghost" style="width:100%;justify-content:center" onclick="cerrarSesion()">Cerrar sesión</button>
  </aside>`;
}
function commonModal() {
  return `<div class="modal-backdrop" id="confirmModal">
    <div class="modal"><h3 id="modalTitle">Confirmar acción</h3><p id="modalText" class="muted"></p><div class="actions" style="justify-content:flex-end"><button class="btn ghost" id="modalCancel">Cancelar</button><button class="btn danger" id="modalOk">Confirmar</button></div></div>
  </div><button class="help-float" title="Ayuda contextual">?</button>`;
}
function layout(prefix, main) {
  document.body.insertAdjacentHTML('afterbegin', `<div class="layout">${sidebar(prefix)}<main class="content">${main}</main></div>${commonModal()}`);
  markActiveNav(); setupHelp(); setupModal();
}

// ------------------------------------------------------------------
// Dashboard
// Un solo panel, misma estructura visual (topbar + 2 tarjetas + 3 KPIs)
// para los 4 roles. Solo cambia QUÉ datos se piden y QUÉ se muestra en
// cada tarjeta, según lo que cada rol necesita ver primero.
// ------------------------------------------------------------------
async function renderDashboard() {
  const usuario = getUsuario();
  const rol = usuario.rol;
  const esAdmin = rol === 'admin';
  const esVeterinario = rol === 'veterinario';
  const esRecepcionista = rol === 'recepcionista';
  const esDueno = rol === 'dueno_mascota';

  const [mascotas, citas, inventario, pagos, tratamientos, usuarios] = await Promise.all([
    api.mascotas.listar(),
    api.citas.listar(),
    esAdmin ? api.inventario.listar() : Promise.resolve([]),
    (esRecepcionista || esDueno) ? api.pagos.listar() : Promise.resolve([]),
    esVeterinario ? api.tratamientos.listar() : Promise.resolve([]),
    esAdmin ? api.usuarios.listar() : Promise.resolve([]),
  ]);

  const low = inventario.filter(isLowStock);
  const misCitas = esVeterinario ? citas.filter(c => c.veterinario_id === usuario.id) : citas;
  const pagosPendientes = pagos.filter(p => p.estado === 'Pendiente');
  const tratamientosActivos = tratamientos.filter(t => t.estado === 'Activo');

  // --- Tarjeta izquierda: lo primero que cada rol necesita revisar ---
  let tituloIzq, botonIzq, cuerpoIzqId, cuerpoIzqHtml;
  if (esAdmin) {
    tituloIzq = 'Alertas de Inventario'; botonIzq = ['Ver inventario', 'pages/inventario.html'];
    cuerpoIzqHtml = low.length ? low.map(p => `<div class="alert">⚠️ <b>${p.producto}</b><br>Stock actual: ${p.cantidad} ${p.unidad} | Mínimo requerido: ${p.minimo}</div>`).join('') : '<p class="muted">Sin alertas de stock bajo.</p>';
  } else if (esVeterinario) {
    tituloIzq = 'Mis Próximas Citas'; botonIzq = ['Ver todas', 'pages/citas.html'];
    cuerpoIzqHtml = misCitas.slice(0, 6).map(c => `<div class="appointment"><div><strong>${c.mascota}</strong><span>Dueño: ${c.dueno}<br>${c.motivo}</span></div><b>${c.hora}</b></div>`).join('') || '<p class="muted">No tienes citas asignadas.</p>';
  } else {
    tituloIzq = 'Próximas Citas'; botonIzq = ['Ver todas', 'pages/citas.html'];
    cuerpoIzqHtml = citas.slice(0, 6).map(c => `<div class="appointment"><div><strong>${c.mascota}</strong><span>Dueño: ${c.dueno}<br>${c.motivo}</span></div><b>${c.hora}</b></div>`).join('') || '<p class="muted">No hay citas registradas.</p>';
  }

  // --- Tarjeta derecha: información secundaria propia del rol ---
  let tarjetaDer;
  if (esAdmin) {
    const porRol = ['admin', 'veterinario', 'recepcionista', 'dueno_mascota'].map(r => `<div class="appointment"><div><strong>${ROL_LABELS[r]}</strong></div><b>${usuarios.filter(u => u.rol === r && u.activo).length}</b></div>`).join('');
    tarjetaDer = `<section class="card"><div class="card-title"><h2>Usuarios Activos por Rol</h2><button class="btn ghost sm" onclick="goTo('pages/usuarios.html')">Gestionar</button></div>${porRol}</section>`;
  } else if (esVeterinario) {
    tarjetaDer = `<section class="card"><div class="card-title"><h2>Tratamientos Activos</h2><button class="btn ghost sm" onclick="goTo('pages/tratamientos.html')">Ver todos</button></div>${tratamientosActivos.slice(0, 6).map(t => `<div class="appointment"><div><strong>${t.mascota}</strong><span>${t.diagnostico}</span></div></div>`).join('') || '<p class="muted">No hay tratamientos activos.</p>'}</section>`;
  } else if (esRecepcionista) {
    tarjetaDer = `<section class="card"><div class="card-title"><h2>Pagos Pendientes</h2><button class="btn ghost sm" onclick="goTo('pages/pagos.html')">Ver todos</button></div>${pagosPendientes.slice(0, 6).map(p => `<div class="appointment"><div><strong>${p.mascota}</strong><span>${p.concepto}</span></div><b>${money(p.monto)}</b></div>`).join('') || '<p class="muted">No hay pagos pendientes.</p>'}</section>`;
  } else {
    tarjetaDer = `<section class="card"><div class="card-title"><h2>Mis Pagos Pendientes</h2><button class="btn ghost sm" onclick="goTo('pages/pagos.html')">Ver todos</button></div>${pagosPendientes.slice(0, 6).map(p => `<div class="appointment"><div><strong>${p.mascota}</strong><span>${p.concepto}</span></div><b>${money(p.monto)}</b></div>`).join('') || '<p class="muted">No tienes pagos pendientes.</p>'}</section>`;
  }

  // --- Fila de 3 KPIs, distinta por rol ---
  let kpis;
  if (esAdmin) {
    kpis = [
      ['🐾', 'Mascotas registradas', mascotas.length],
      ['👤', 'Usuarios activos', usuarios.filter(u => u.activo).length],
      ['📦', 'Productos stock bajo', low.length, 'danger'],
    ];
  } else if (esVeterinario) {
    const hoy = new Date().toISOString().slice(0, 10);
    kpis = [
      ['📅', 'Mis citas de hoy', misCitas.filter(c => String(c.fecha).slice(0, 10) === hoy).length, 'warning'],
      ['💊', 'Tratamientos activos', tratamientosActivos.length],
      ['🐾', 'Mascotas registradas', mascotas.length],
    ];
  } else if (esRecepcionista) {
    kpis = [
      ['📅', 'Citas pendientes', citas.filter(c => c.estado === 'Pendiente').length, 'warning'],
      ['🐾', 'Mascotas registradas', mascotas.length],
      ['💵', 'Pagos pendientes', pagosPendientes.length, 'danger'],
    ];
  } else {
    kpis = [
      ['🐾', 'Mis mascotas', mascotas.length],
      ['📅', 'Mis citas pendientes', citas.filter(c => c.estado === 'Pendiente').length, 'warning'],
      ['💵', 'Mis pagos pendientes', pagosPendientes.length, 'danger'],
    ];
  }
  const kpiHtml = kpis.map(([icon, label, valor, tono]) => `<div class="card kpi${tono ? ' ' + tono : ''}"><div class="kpi-icon">${icon}</div><div><p>${label}</p><strong>${valor}</strong></div></div>`).join('');

  layout('', `
    <div class="topbar"><div><h1>Dashboard Principal</h1><p>Panel de operación diaria, citas y alertas críticas.</p></div><div class="actions"><button class="btn primary" onclick="goTo('pages/cita-form.html')">+ Nueva cita</button></div></div>
    <div class="grid two">
      <section class="card"><div class="card-title"><h2>${tituloIzq}</h2><button class="btn ghost sm" onclick="goTo('${botonIzq[1]}')">${botonIzq[0]}</button></div><div>${cuerpoIzqHtml}</div></section>
      ${tarjetaDer}
    </div>
    <div class="grid three" style="margin-top:20px">${kpiHtml}</div>`);
}

// ------------------------------------------------------------------
// Mascotas
// ------------------------------------------------------------------
async function renderMascotas() {
  layout('../', `
    <div class="topbar"><div><h1>Gestión de Mascotas</h1><p>Administra el registro de mascotas y sus historiales clínicos.</p></div></div>
    <div class="toolbar"><label class="search">🔎 <input id="q" placeholder="Buscar por mascota, dueño o especie..."></label><button class="btn primary" onclick="goTo('mascota-form.html')">+ Nueva Mascota</button></div>
    <div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Especie</th><th>Raza</th><th>Edad</th><th>Dueño</th><th>Teléfono</th><th>Acciones</th></tr></thead><tbody id="rows"></tbody></table></div>`);

  let mascotas = await api.mascotas.listar();

  const render = () => {
    const q = normalize(document.querySelector('#q').value);
    const rows = mascotas.filter(m => normalize(`${m.nombre} ${m.dueno} ${m.especie}`).includes(q));
    document.querySelector('#rows').innerHTML = rows.map(m => `<tr>
      <td><b>${m.nombre}</b></td><td>${m.especie}</td><td>${m.raza || '—'}</td><td>${m.edad || '—'}</td><td>${m.dueno}</td><td>${m.telefono || '—'}</td>
      <td class="actions">
        <button class="btn ghost icon" title="Ver" onclick="verMascota(${m.id})">👁️</button>
        <button class="btn ghost icon" title="Editar" onclick="goTo('mascota-form.html#id=${m.id}')">✏️</button>
        <button class="btn ghost icon" title="Eliminar" onclick="eliminarMascota(${m.id})">🗑️</button>
      </td></tr>`).join('') || `<tr><td colspan="7" class="empty">No se encontraron resultados.</td></tr>`;
  };
  document.querySelector('#q').addEventListener('input', render); render();

  window.verMascota = async (id) => {
    const m = await api.mascotas.obtener(id);
    openConfirm(`${m.nombre} — Ficha`, `Especie: ${m.especie} | Raza: ${m.raza || '—'} | Edad: ${m.edad || '—'} | Dueño: ${m.dueno} | Tel: ${m.telefono || '—'}`, () => {});
    document.querySelector('#modalOk').textContent = 'Cerrar';
    document.querySelector('#modalOk').className = 'btn primary';
    document.querySelector('#modalCancel').style.display = 'none';
    document.querySelector('#modalOk').onclick = () => { closeModal(); document.querySelector('#modalCancel').style.display = ''; };
  };
  window.eliminarMascota = (id) => {
    openConfirm('Eliminar mascota', 'Esta acción moverá el registro a la papelera. No se eliminará definitivamente.', async () => {
      await api.mascotas.eliminar(id);
      mascotas = await api.mascotas.listar();
      render();
    });
  };
}

// ------------------------------------------------------------------
// Citas
// ------------------------------------------------------------------
async function renderCitas() {
  layout('../', `
    <div class="topbar"><div><h1>Gestión de Citas</h1><p>Administra las citas programadas para las mascotas.</p></div></div>
    <div class="toolbar"><label class="search">🔎 <input id="q" placeholder="Buscar por mascota, dueño o motivo..."></label><select id="estado"><option>Todos los estados</option><option>Confirmada</option><option>Pendiente</option><option>Cancelada</option><option>Completada</option></select><button class="btn primary" onclick="goTo('cita-form.html')">+ Nueva Cita</button></div>
    <div class="table-wrap"><table><thead><tr><th>Fecha y Hora</th><th>Mascota</th><th>Dueño</th><th>Motivo</th><th>Veterinario</th><th>Estado</th><th>Acciones</th></tr></thead><tbody id="rows"></tbody></table></div>`);

  let citas = await api.citas.listar();
  const badge = (estado) => estado === 'Confirmada' ? 'info' : estado === 'Completada' ? 'success' : estado === 'Cancelada' ? 'danger' : 'warning';

  const render = () => {
    const q = normalize(document.querySelector('#q').value); const e = document.querySelector('#estado').value;
    const rows = citas.filter(c => normalize(`${c.mascota} ${c.dueno} ${c.motivo}`).includes(q) && (e === 'Todos los estados' || c.estado === e));
    document.querySelector('#rows').innerHTML = rows.map(c => `<tr>
      <td><b>${new Date(c.fecha).toLocaleDateString('es-ES')}</b><br>${c.hora}</td><td>${c.mascota}</td><td>${c.dueno}</td><td>${c.motivo}</td><td>${c.veterinario || '—'}</td>
      <td><span class="badge ${badge(c.estado)}">${c.estado}</span></td>
      <td class="actions">
        <button class="btn ghost icon" title="Editar" onclick="goTo('cita-form.html#id=${c.id}')">✏️</button>
        <button class="btn ghost icon" title="Eliminar" onclick="eliminarCita(${c.id})">🗑️</button>
      </td></tr>`).join('') || `<tr><td colspan="7" class="empty">Sin citas para este filtro.</td></tr>`;
  };
  document.querySelector('#q').addEventListener('input', render);
  document.querySelector('#estado').addEventListener('change', render);
  render();

  window.eliminarCita = (id) => {
    openConfirm('Eliminar cita', 'Confirma antes de eliminar o mover a papelera.', async () => {
      await api.citas.eliminar(id);
      citas = await api.citas.listar();
      render();
    });
  };
}

// ------------------------------------------------------------------
// Tratamientos
// ------------------------------------------------------------------
async function renderTratamientos() {
  const usuario = getUsuario();
  const puedeEditar = ['admin', 'veterinario'].includes(usuario.rol);

  layout('../', `
    <div class="topbar"><div><h1>Gestión de Tratamientos</h1><p>Administra tratamientos activos y seguimiento clínico.</p></div></div>
    <div class="toolbar"><label class="search">🔎 <input id="q" placeholder="Buscar por mascota, dueño o diagnóstico..."></label><select id="estado"><option>Todos los estados</option><option>Activo</option><option>Finalizado</option></select>${puedeEditar ? `<button class="btn primary" onclick="goTo('tratamiento-form.html')">+ Nuevo Tratamiento</button>` : ''}</div>
    <div class="grid cards" id="cards"></div>`);

  let tratamientos = await api.tratamientos.listar();
  const fmt = (d) => d ? new Date(d).toLocaleDateString('es-ES') : '—';

  const render = () => {
    const q = normalize(document.querySelector('#q').value); const e = document.querySelector('#estado').value;
    const rows = tratamientos.filter(t => normalize(`${t.mascota} ${t.dueno} ${t.diagnostico}`).includes(q) && (e === 'Todos los estados' || t.estado === e));
    document.querySelector('#cards').innerHTML = rows.map(t => `<section class="card treatment-card">
      <div class="treatment-head"><div><h3>${t.mascota}</h3><p class="muted">${t.dueno}</p></div><span class="badge ${t.estado === 'Activo' ? 'success' : 'info'}">${t.estado}</span></div>
      <div class="kv"><b>Diagnóstico:</b><span>${t.diagnostico}</span><b>Tratamiento:</b><span>${t.tratamiento || '—'}</span><b>Medicamento:</b><span>${t.medicamento || '—'}</span><b>Dosis:</b><span>${t.dosis || '—'}</span><b>Frecuencia:</b><span>${t.frecuencia || '—'}</span><b>Inicio:</b><span>${fmt(t.inicio)}</span><b>Fin:</b><span>${fmt(t.fin)}</span></div>
      ${puedeEditar ? `<div class="actions"><button class="btn ghost sm" onclick="goTo('tratamiento-form.html#id=${t.id}')">✏️ Editar</button><button class="btn ghost sm" onclick="eliminarTratamiento(${t.id})">🗑️ Eliminar</button></div>` : ''}
      </section>`).join('') || `<div class="card empty">No hay tratamientos con ese filtro.</div>`;
  };
  document.querySelector('#q').addEventListener('input', render);
  document.querySelector('#estado').addEventListener('change', render);
  render();

  window.eliminarTratamiento = (id) => {
    openConfirm('Eliminar tratamiento', 'Confirma antes de eliminar este seguimiento clínico.', async () => {
      await api.tratamientos.eliminar(id);
      tratamientos = await api.tratamientos.listar();
      render();
    });
  };
}

// ------------------------------------------------------------------
// Pagos
// ------------------------------------------------------------------
async function renderPagos() {
  const usuario = getUsuario();
  const puedeEditar = ['admin', 'recepcionista'].includes(usuario.rol);
  const puedeEliminar = usuario.rol === 'admin';

  let pagos = await api.pagos.listar();
  const ingresos = pagos.filter(p => p.estado === 'Pagado').reduce((s, p) => s + Number(p.monto), 0);
  const pendientes = pagos.filter(p => p.estado === 'Pendiente').reduce((s, p) => s + Number(p.monto), 0);

  layout('../', `
    <div class="topbar"><div><h1>Gestión de Pagos</h1><p>Control financiero y registro de transacciones de caja.</p></div></div>
    <div class="grid three" style="margin-bottom:20px"><div class="card kpi success"><div class="kpi-icon">💵</div><div><p>Ingresos Totales</p><strong>${money(ingresos)}</strong></div></div><div class="card kpi warning"><div class="kpi-icon">💰</div><div><p>Pagos Pendientes</p><strong>${money(pendientes)}</strong></div></div><div class="card kpi"><div class="kpi-icon">#</div><div><p>Número de Transacciones</p><strong>${pagos.length}</strong></div></div></div>
    <div class="toolbar"><label class="search">🔎 <input id="q" placeholder="Buscar por mascota, dueño o concepto..."></label><select id="estado"><option>Todos los estados</option><option>Pagado</option><option>Pendiente</option></select>${puedeEditar ? `<button class="btn primary" onclick="goTo('pago-form.html')">+ Nuevo Pago</button>` : ''}</div>
    <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Mascota</th><th>Dueño</th><th>Concepto</th><th>Monto</th><th>Método</th><th>Estado</th>${puedeEditar || puedeEliminar ? '<th>Acciones</th>' : ''}</tr></thead><tbody id="rows"></tbody></table></div>`);

  const render = () => {
    const q = normalize(document.querySelector('#q').value); const e = document.querySelector('#estado').value;
    const rows = pagos.filter(p => normalize(`${p.mascota} ${p.dueno} ${p.concepto}`).includes(q) && (e === 'Todos los estados' || e === p.estado));
    document.querySelector('#rows').innerHTML = rows.map(p => `<tr>
      <td>${new Date(p.fecha).toLocaleDateString('es-ES')}</td><td>${p.mascota}</td><td>${p.dueno}</td><td>${p.concepto}</td><td>${money(p.monto)}</td><td>${p.metodo}</td><td><span class="badge ${p.estado === 'Pagado' ? 'success' : 'warning'}">${p.estado}</span></td>
      ${puedeEditar || puedeEliminar ? `<td class="actions">${puedeEditar ? `<button class="btn ghost icon" title="Editar" onclick="goTo('pago-form.html#id=${p.id}')">✏️</button>` : ''}${puedeEliminar ? `<button class="btn ghost icon" title="Eliminar" onclick="eliminarPago(${p.id})">🗑️</button>` : ''}</td>` : ''}
      </tr>`).join('') || `<tr><td colspan="8" class="empty">Sin pagos para este filtro.</td></tr>`;
  };
  document.querySelector('#q').addEventListener('input', render);
  document.querySelector('#estado').addEventListener('change', render);
  render();

  window.eliminarPago = (id) => {
    openConfirm('Eliminar pago', 'Confirma antes de eliminar este registro financiero.', async () => {
      await api.pagos.eliminar(id);
      pagos = await api.pagos.listar();
      render();
    });
  };
}

// ------------------------------------------------------------------
// Inventario
// ------------------------------------------------------------------
async function renderInventario() {
  let inventario = await api.inventario.listar();
  const total = inventario.reduce((s, p) => s + (p.cantidad * p.precio), 0);
  const low = inventario.filter(isLowStock).length;

  layout('../', `
    <div class="topbar"><div><h1>Gestión de Inventario</h1><p>Administra stock, productos veterinarios e indicadores de stock crítico.</p></div></div>
    <div class="grid three" style="margin-bottom:20px"><div class="card kpi"><div class="kpi-icon">📦</div><div><p>Total de Productos</p><strong>${inventario.length}</strong></div></div><div class="card kpi danger"><div class="kpi-icon">⚠️</div><div><p>Productos con Stock Bajo</p><strong>${low}</strong></div></div><div class="card kpi success"><div class="kpi-icon">💵</div><div><p>Valor Total del Inventario</p><strong>${money(total)}</strong></div></div></div>
    <div class="toolbar"><label class="search">🔎 <input id="q" placeholder="Buscar producto..."></label><select id="categoria"><option>Todas las categorías</option><option>Alimento</option><option>Vacuna</option><option>Medicamento</option><option>Insumo</option></select><label class="btn ghost"><input type="checkbox" id="lowOnly"> Solo stock bajo</label><button class="btn primary" onclick="goTo('producto-form.html')">+ Nuevo Producto</button></div>
    <div class="table-wrap"><table><thead><tr><th>Producto</th><th>Categoría</th><th>Cantidad</th><th>Stock Mínimo</th><th>Precio Unit.</th><th>Vencimiento</th><th>Estado</th><th>Acciones</th></tr></thead><tbody id="rows"></tbody></table></div>`);

  const render = () => {
    const q = normalize(document.querySelector('#q').value); const c = document.querySelector('#categoria').value; const lowOnly = document.querySelector('#lowOnly').checked;
    const rows = inventario.filter(p => normalize(p.producto).includes(q) && (c === 'Todas las categorías' || p.categoria === c) && (!lowOnly || isLowStock(p)));
    document.querySelector('#rows').innerHTML = rows.map(p => `<tr>
      <td><b>${p.producto}</b></td><td><span class="badge info">${p.categoria}</span></td><td>${p.cantidad} ${p.unidad}</td><td>${p.minimo} ${p.unidad}</td><td>${money(p.precio)}</td><td>${p.vencimiento ? new Date(p.vencimiento).toLocaleDateString('es-ES') : '—'}</td><td><span class="badge ${isLowStock(p) ? 'danger' : 'success'}">${isLowStock(p) ? 'Crítico' : 'Normal'}</span></td>
      <td class="actions"><button class="btn ghost icon" title="Editar" onclick="goTo('producto-form.html#id=${p.id}')">✏️</button><button class="btn ghost icon" title="Eliminar" onclick="eliminarProducto(${p.id})">🗑️</button></td>
      </tr>`).join('') || `<tr><td colspan="8" class="empty">No hay productos con ese filtro.</td></tr>`;
  };
  document.querySelector('#q').addEventListener('input', render);
  document.querySelector('#categoria').addEventListener('change', render);
  document.querySelector('#lowOnly').addEventListener('change', render);
  render();

  window.eliminarProducto = (id) => {
    openConfirm('Eliminar producto', 'Confirma antes de eliminar este producto del inventario.', async () => {
      await api.inventario.eliminar(id);
      inventario = await api.inventario.listar();
      render();
    });
  };
}

// ------------------------------------------------------------------
// Usuarios (solo admin)
// ------------------------------------------------------------------
async function renderUsuarios() {
  if (getUsuario()?.rol !== 'admin') { goTo('../index.html'); return; }

  layout('../', `
    <div class="topbar"><div><h1>Administración de Usuarios</h1><p>Gestiona el acceso al sistema: quién entra y con qué rol.</p></div></div>
    <div class="toolbar"><label class="search">🔎 <input id="q" placeholder="Buscar por nombre o correo..."></label><select id="rolFiltro"><option>Todos los roles</option><option value="admin">Administrador</option><option value="veterinario">Veterinario</option><option value="recepcionista">Recepcionista</option><option value="dueno_mascota">Dueño de mascota</option></select><button class="btn primary" onclick="goTo('usuario-form.html')">+ Nuevo Usuario</button></div>
    <div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Teléfono</th><th>Estado</th><th>Acciones</th></tr></thead><tbody id="rows"></tbody></table></div>`);

  let usuarios = await api.usuarios.listar();

  const render = () => {
    const q = normalize(document.querySelector('#q').value);
    const rolFiltro = document.querySelector('#rolFiltro').value;
    const rows = usuarios.filter(u => normalize(`${u.nombre} ${u.correo}`).includes(q) && (!rolFiltro || u.rol === rolFiltro));
    document.querySelector('#rows').innerHTML = rows.map(u => `<tr>
      <td><b>${u.nombre}</b></td><td>${u.correo}</td><td><span class="badge info">${ROL_LABELS[u.rol] || u.rol}</span></td><td>${u.telefono || '—'}</td>
      <td><span class="badge ${u.activo ? 'success' : 'danger'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
      <td class="actions">
        <button class="btn ghost icon" title="Editar" onclick="goTo('usuario-form.html#id=${u.id}')">✏️</button>
      </td></tr>`).join('') || `<tr><td colspan="6" class="empty">No se encontraron usuarios.</td></tr>`;
  };
  document.querySelector('#q').addEventListener('input', render);
  document.querySelector('#rolFiltro').addEventListener('change', render);
  render();
}
