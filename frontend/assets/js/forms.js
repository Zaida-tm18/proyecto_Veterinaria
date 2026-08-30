document.addEventListener('DOMContentLoaded', async () => {
  const page = document.body.dataset.form;
  if (!page) return;
  if (!exigirSesion()) return;
  await buildFormPage(page);
});

function getIdFromUrl() {
  // Se usa el fragmento (#id=7) en vez de query string (?id=7) a propósito:
  // el fragmento nunca se envía al servidor, así que ninguna redirección
  // de un servidor estático (p. ej. las "clean URLs" de `npx serve`, que
  // sí llegan a perder el query string) puede perderlo en el camino.
  const hash = window.location.hash; // "#id=7"
  const match = hash.match(/id=(\d+)/);
  return match ? match[1] : null;
}

// ------------------------------------------------------------------
// Configuración de cada formulario.
// "fields" declara los campos visibles. Los campos tipo "select-dynamic"
// se llenan en tiempo real desde la API (mascotas, veterinarios, etc.)
// en vez de usar una lista de texto fija como en el prototipo original.
// ------------------------------------------------------------------
const formConfigs = {
  mascota: {
    nav: 'mascotas', title: 'Formulario de Mascota', subtitle: 'Registro de la mascota y su propietario.', multi: false,
    help: 'Los campos marcados son obligatorios.',
    // "dueno_id" solo se agrega dinámicamente en buildFormPage() cuando
    // el usuario logueado es staff (admin/veterinario/recepcionista),
    // ya que un dueño de mascota no necesita elegir su propio id.
    fields: [['nombre', 'Nombre de mascota', 'text'], ['especie', 'Especie', 'select:Perro,Gato,Ave,Otro'], ['raza', 'Raza', 'text'], ['edad', 'Edad', 'text']],
    back: 'mascotas.html',
    resource: 'mascotas',
  },
  cita: {
    nav: 'citas', title: 'Nueva Cita', subtitle: 'Programación de citas.', help: 'Usa horas exactas para evitar errores de agenda.',
    fields: [
      ['mascota_id', 'Mascota', 'select-dynamic:mascotas'],
      ['fecha', 'Fecha', 'date'], ['hora', 'Hora', 'time'], ['motivo', 'Motivo', 'text'],
      ['veterinario_id', 'Veterinario', 'select-dynamic:veterinarios'],
      ['estado', 'Estado', 'select:Confirmada,Pendiente,Cancelada,Completada'],
    ],
    back: 'citas.html', resource: 'citas',
  },
  tratamiento: {
    nav: 'tratamientos', title: 'Nuevo Tratamiento', subtitle: 'Seguimiento clínico con campos estandarizados.', help: 'Evita texto ambiguo en dosis y frecuencia para prevenir errores de medicación.',
    fields: [
      ['mascota_id', 'Mascota', 'select-dynamic:mascotas'],
      ['diagnostico', 'Diagnóstico', 'text'], ['tratamiento', 'Tratamiento', 'textarea'], ['medicamento', 'Medicamento', 'text'],
      ['dosis', 'Dosis estandarizada', 'text'],
      ['frecuencia', 'Frecuencia', 'select:Cada 8 horas,Cada 12 horas,Cada 24 horas,Una vez al día'],
      ['inicio', 'Fecha de inicio', 'date'], ['fin', 'Fecha de fin', 'date'],
      ['estado', 'Estado', 'select:Activo,Finalizado'],
    ],
    back: 'tratamientos.html', resource: 'tratamientos',
  },
  pago: {
    nav: 'pagos', title: 'Nuevo Pago', subtitle: 'Registro de transacciones de caja.', help: 'El monto no puede ser negativo ni igual a cero.',
    fields: [
      ['mascota_id', 'Mascota', 'select-dynamic:mascotas'],
      ['concepto', 'Concepto', 'text'], ['monto', 'Monto', 'number'],
      ['metodo', 'Método de pago', 'select:Efectivo,Tarjeta,Transferencia'],
      ['estado', 'Estado', 'select:Pagado,Pendiente'],
    ],
    back: 'pagos.html', resource: 'pagos',
  },
  producto: {
    nav: 'inventario', title: 'Nuevo Producto', subtitle: 'Registro de productos e insumos veterinarios.', help: 'El sistema identifica stock bajo cuando la cantidad es menor o igual al stock mínimo.',
    fields: [
      ['producto', 'Producto', 'text'], ['categoria', 'Categoría', 'select:Alimento,Vacuna,Medicamento,Insumo'],
      ['cantidad', 'Cantidad', 'number'], ['unidad', 'Unidad', 'select:u,kg,pares,cajas'],
      ['minimo', 'Stock mínimo', 'number'], ['precio', 'Precio unitario', 'number'], ['vencimiento', 'Vencimiento', 'date'],
    ],
    back: 'inventario.html', resource: 'inventario',
  },
  usuario: {
    nav: 'usuarios', title: 'Nuevo Usuario', subtitle: 'Da de alta personal de la clínica o corrige datos de acceso.', help: 'Solo el administrador puede crear o editar usuarios y asignar roles.',
    fields: [
      ['nombre', 'Nombre completo', 'text'], ['correo', 'Correo electrónico', 'email'],
      ['telefono', 'Teléfono', 'text'],
      ['rol', 'Rol', 'select-labeled:admin|Administrador,veterinario|Veterinario,recepcionista|Recepcionista,dueno_mascota|Dueño de mascota'],
    ],
    back: 'usuarios.html', resource: 'usuarios',
  },
};

async function buildFormPage(page) {
  const prefix = '../';
  const cfg = formConfigs[page];
  const id = getIdFromUrl();
  const esEdicion = Boolean(id);
  const usuario = getUsuario();
  const esStaff = ['admin', 'veterinario', 'recepcionista'].includes(usuario.rol);

  // El formulario de usuario es exclusivo del admin: si alguien más
  // entra directo a la URL, lo mandamos de vuelta al dashboard.
  if (page === 'usuario' && usuario.rol !== 'admin') { goTo('../index.html'); return; }

  // El formulario de mascota necesita elegir el dueño solo si quien
  // registra es personal de la clínica (un dueño siempre registra para sí mismo).
  let campos = cfg.fields;
  if (page === 'mascota' && esStaff) {
    campos = [['dueno_id', 'Dueño', 'select-dynamic:duenos'], ...cfg.fields];
  }
  // La contraseña se agrega dinámicamente: obligatoria al crear, opcional
  // al editar (dejarla vacía significa "no cambiar la contraseña actual").
  // "Activo" solo tiene sentido al editar (un usuario nuevo siempre nace activo).
  if (page === 'usuario') {
    campos = esEdicion
      ? [...campos, ['password', 'Nueva contraseña (dejar vacío para no cambiar)', 'password-optional'], ['activo', 'Estado', 'select-labeled:true|Activo,false|Inactivo']]
      : [...campos, ['password', 'Contraseña', 'password']];
  }

  document.body.dataset.page = cfg.nav;
  document.body.insertAdjacentHTML('afterbegin', `<div class="layout">${sidebar(prefix)}<main class="content">
    <div class="topbar"><div><h1>${esEdicion ? 'Editar' : cfg.title}</h1><p>${cfg.subtitle}</p></div><div class="actions"><button class="btn ghost" onclick="history.back()">← Volver</button></div></div>
    <section class="card"><div class="hint">💡 ${cfg.help}</div><form id="normalForm"><div class="form-grid" id="formGrid"></div>
      <div class="actions" style="margin-top:20px;justify-content:flex-end"><button type="button" class="btn ghost" onclick="history.back()">Cancelar</button><button class="btn success" type="submit" data-testid="form-submit-btn">Guardar</button></div>
    </form></section>
  </main></div>${commonModal()}`);
  markActiveNav(); setupHelp(); setupModal();

  // Resuelve las opciones de los selects dinámicos ANTES de pintar el form.
  const opcionesDinamicas = await cargarOpcionesDinamicas(campos);
  document.querySelector('#formGrid').innerHTML = campos.map(f => fieldHtml(f, opcionesDinamicas)).join('');
  enablePasswordToggles(document.querySelector('#formGrid'));

  const form = document.querySelector('#normalForm');

  // Si es edición, precargamos los valores actuales del registro.
  let registroActual = null;
  if (esEdicion) {
    registroActual = await api[cfg.resource].obtener(id);
    campos.forEach(([name]) => {
      const el = form.elements[name];
      if (!el) return;
      let valor = registroActual[name];
      if (el.type === 'date' && valor) valor = String(valor).slice(0, 10); // ISO -> yyyy-mm-dd
      if (valor !== undefined && valor !== null) el.value = valor;
    });
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!validateVisible()) return;
    const data = Object.fromEntries(new FormData(form).entries());
    // Los campos numéricos vienen como string desde FormData.
    Object.keys(data).forEach(k => {
      if (['mascota_id', 'veterinario_id', 'cantidad', 'minimo', 'precio', 'monto'].includes(k) && data[k] !== '') {
        data[k] = Number(data[k]);
      }
    });

    try {
      if (esEdicion) {
        await api[cfg.resource].actualizar(id, data);
      } else {
        await api[cfg.resource].crear(data);
      }
      successSave('Registro guardado correctamente.', cfg.back);
    } catch (err) {
      openConfirm('No se pudo guardar', err.message || 'Ocurrió un error al guardar el registro.', () => {});
      document.querySelector('#modalOk').textContent = 'Cerrar';
      document.querySelector('#modalOk').className = 'btn primary';
      document.querySelector('#modalCancel').style.display = 'none';
      document.querySelector('#modalOk').onclick = () => { closeModal(); document.querySelector('#modalCancel').style.display = ''; };
    }
  };
}

// Carga las listas reales (mascotas del usuario, veterinarios) para los
// campos "select-dynamic" que lo necesiten.
async function cargarOpcionesDinamicas(fields) {
  const necesita = new Set(fields.filter(f => f[2].startsWith('select-dynamic:')).map(f => f[2].split(':')[1]));
  const resultado = {};
  if (necesita.has('mascotas')) {
    const mascotas = await api.mascotas.listar();
    resultado.mascotas = mascotas.map(m => ({ value: m.id, label: `${m.nombre} (${m.dueno})` }));
  }
  if (necesita.has('veterinarios')) {
    const usuario = getUsuario();
    const esStaff = ['admin', 'veterinario', 'recepcionista'].includes(usuario.rol);
    if (esStaff) {
      const veterinarios = await api.usuarios.listarPorRol('veterinario');
      resultado.veterinarios = veterinarios.map(v => ({ value: v.id, label: v.nombre }));
    } else {
      resultado.veterinarios = []; // un dueño no elige veterinario al agendar
    }
  }
  if (necesita.has('duenos')) {
    resultado.duenos = (await api.usuarios.listarPorRol('dueno_mascota')).map(u => ({ value: u.id, label: `${u.nombre} (${u.correo})` }));
  }
  return resultado;
}

function fieldHtml(f, opcionesDinamicas) {
  const [name, label, type] = f;
  if (type === 'textarea') return `<div class="field full"><label for="${name}">${label}</label><textarea id="${name}" name="${name}" required></textarea><small>Ayuda contextual: revise antes de guardar.</small></div>`;
  if (type.startsWith('select-dynamic:')) {
    const key = type.split(':')[1];
    const opciones = opcionesDinamicas[key] || [];
    return `<div class="field"><label for="${name}">${label}</label><select id="${name}" name="${name}" ${key === 'veterinarios' ? '' : 'required'}><option value="">Seleccione...</option>${opciones.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}</select></div>`;
  }
  if (type.startsWith('select-labeled:')) {
    const opciones = type.replace('select-labeled:', '').split(',').map(o => { const [value, label] = o.split('|'); return { value, label }; });
    return `<div class="field"><label for="${name}">${label}</label><select id="${name}" name="${name}" required><option value="">Seleccione...</option>${opciones.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}</select></div>`;
  }
  if (type.startsWith('select:')) return `<div class="field"><label for="${name}">${label}</label><select id="${name}" name="${name}" required><option value="">Seleccione...</option>${type.replace('select:', '').split(',').map(o => `<option>${o}</option>`).join('')}</select></div>`;
  if (type === 'password-optional') return `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="password" autocomplete="new-password"></div>`;
  return `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" required ${type === 'number' ? 'min="0.01" step="0.01"' : ''}></div>`;
}

function validateVisible() {
  const form = document.querySelector('form');
  const fields = form.querySelectorAll('input,select,textarea');
  for (const el of fields) { if (!el.checkValidity()) { el.reportValidity(); return false; } }
  return true;
}

function successSave(message, back) {
  openConfirm('Guardado exitoso', message, () => goTo(back));
  document.querySelector('#modalOk').className = 'btn success';
  document.querySelector('#modalOk').textContent = 'Aceptar';
}