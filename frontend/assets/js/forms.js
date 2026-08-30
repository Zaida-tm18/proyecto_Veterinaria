document.addEventListener('DOMContentLoaded', async () => {
  const page = document.body.dataset.form;
  if (!page) return;
  if (!exigirSesion()) return;
  // El pago tiene un formulario propio (varios ítems por comprobante,
  // totales calculados) en vez del builder declarativo genérico.
  if (page === 'pago') { await buildPagoForm(); return; }
  await buildFormPage(page);
});

function getIdFromUrl() { return getHashParam('id'); }

// Lee un parámetro del fragmento de la URL (ej. "#cita=3" -> "3"). Se usa
// el fragmento en vez de query string a propósito: nunca se envía al
// servidor, así que ninguna redirección de un servidor estático (p. ej.
// las "clean URLs" de `npx serve`) puede perderlo en el camino.
function getHashParam(name) {
  const match = window.location.hash.match(new RegExp(`${name}=(\\d+)`));
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
    fields: [['nombre', 'Nombre de mascota', 'text'], ['especie', 'Especie', 'select:Perro,Gato,Ave,Otro'], ['raza', 'Raza', 'text'], ['edad', 'Edad', 'text'], ['foto_data', 'Foto de la mascota', 'image']],
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
    nav: 'tratamientos', title: 'Nuevo Tratamiento', subtitle: 'Seguimiento clínico con campos estandarizados.', help: 'Todo tratamiento queda ligado a la cita que lo originó, para poder rastrear de dónde salió cada diagnóstico.',
    // "mascota_id" no se pide: se deriva automáticamente de la cita elegida
    // (así no puede quedar un tratamiento con una mascota distinta a su cita).
    fields: [
      ['cita_id', 'Cita asociada', 'select-dynamic:citas'],
      ['diagnostico', 'Diagnóstico', 'text'], ['tratamiento', 'Tratamiento indicado', 'textarea'],
      ['medicamento', 'Medicamento principal', 'text'],
      ['dosis', 'Dosis estandarizada', 'text'],
      ['frecuencia', 'Frecuencia', 'select:Cada 8 horas,Cada 12 horas,Cada 24 horas,Una vez al día,Dosis única'],
      ['insumos', 'Medicamentos/insumos requeridos', 'textarea'],
      ['inicio', 'Fecha de inicio', 'date'], ['fin', 'Fecha de fin', 'date'],
      ['estado', 'Estado', 'select:Activo,Finalizado'],
    ],
    back: 'tratamientos.html', resource: 'tratamientos',
  },
  producto: {
    nav: 'inventario', title: 'Nuevo Producto', subtitle: 'Registro de productos e insumos veterinarios.', help: 'El sistema identifica stock bajo cuando la cantidad es menor o igual al stock mínimo.',
    fields: [
      ['producto', 'Producto', 'text'], ['categoria', 'Categoría', 'select:Alimento,Vacuna,Medicamento,Insumo,Servicio'],
      ['cantidad', 'Cantidad', 'number'], ['unidad', 'Unidad', 'select:u,kg,pares,cajas'],
      ['minimo', 'Stock mínimo', 'number'], ['precio', 'Precio unitario', 'number'], ['vencimiento', 'Vencimiento', 'date'],
    ],
    back: 'inventario.html', resource: 'inventario',
  },
  usuario: {
    nav: 'usuarios', title: 'Nuevo Usuario', subtitle: 'Da de alta personal de la clínica o corrige datos de acceso.', help: 'Solo el administrador puede crear o editar usuarios y asignar roles.',
    fields: [
      ['nombre', 'Nombre completo', 'text'], ['correo', 'Correo electrónico', 'email'],
      ['telefono', 'Teléfono', 'text'], ['direccion', 'Dirección', 'text-optional'],
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
  } else if (page === 'tratamiento') {
    // "+ Tratamiento" desde la ficha de una cita llega como #cita=7:
    // deja la cita ya elegida para no tener que buscarla en el select.
    const citaId = getHashParam('cita');
    if (citaId && form.elements.cita_id) form.elements.cita_id.value = citaId;
  }

  // Los campos de imagen usan un input file + un input oculto (con el
  // base64) que ya quedó precargado arriba si es edición; aquí se conecta
  // el selector de archivo y se pinta la vista previa inicial.
  campos.filter(([, , type]) => type === 'image').forEach(([name]) => initImageField(name));

  // Restricciones de fecha en el propio input (ayuda visual del selector
  // de fecha del navegador, además de la validación real que hace el
  // backend al guardar):
  // - Una cita NUEVA no puede agendarse en el pasado.
  // - El fin de un tratamiento no puede quedar antes que su inicio.
  if (page === 'cita' && !esEdicion && form.elements.fecha) {
    form.elements.fecha.min = new Date().toISOString().slice(0, 10);
  }
  if (page === 'tratamiento' && form.elements.inicio && form.elements.fin) {
    const sincronizarMinFin = () => { form.elements.fin.min = form.elements.inicio.value || ''; };
    form.elements.inicio.addEventListener('change', sincronizarMinFin);
    sincronizarMinFin();
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!validateVisible()) return;
    const data = Object.fromEntries(new FormData(form).entries());
    // Los campos numéricos vienen como string desde FormData.
    Object.keys(data).forEach(k => {
      if (['mascota_id', 'veterinario_id', 'cita_id', 'cantidad', 'minimo', 'precio', 'monto'].includes(k) && data[k] !== '') {
        data[k] = Number(data[k]);
      }
    });

    // Validaciones de fecha/hora antes de tocar el servidor (el backend
    // las repite de todas formas, pero avisar aquí evita el viaje redondo).
    if (page === 'cita' && !esEdicion && new Date(`${data.fecha}T${data.hora}`) < new Date()) {
      alert('No puedes agendar una cita en una fecha y hora que ya pasaron.');
      return;
    }
    if (page === 'tratamiento' && data.inicio && data.fin && data.fin < data.inicio) {
      alert('La fecha de fin no puede ser anterior a la fecha de inicio.');
      return;
    }

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
  if (necesita.has('citas')) {
    const citas = await api.citas.listar();
    const fmt = (c) => `${c.mascota} — ${new Date(c.fecha).toLocaleDateString('es-ES')} ${c.hora} (${c.motivo})`;
    resultado.citas = citas.map(c => ({ value: c.id, label: fmt(c) }));
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
  if (type === 'text-optional') return `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="text"></div>`;
  if (type === 'image') {
    return `<div class="field full">
      <label for="${name}File">${label}</label>
      <div style="display:flex;flex-direction:column;align-items:center;gap:10px">
        <div style="width:140px;height:140px;border:1px dashed var(--border);border-radius:16px;display:grid;place-items:center;overflow:hidden;background:#f8fafc">
          <img id="${name}Preview" alt="${label}" style="max-width:100%;max-height:100%;object-fit:cover;display:none">
          <span id="${name}Placeholder" class="muted">Sin foto</span>
        </div>
        <input id="${name}File" type="file" accept="image/png,image/jpeg,image/webp">
        <input id="${name}" name="${name}" type="hidden">
        <small class="muted">Formatos: PNG, JPG o WEBP. Máximo ~4MB.</small>
        <button class="btn ghost sm" type="button" id="${name}Quitar" style="display:none">🗑️ Quitar foto</button>
      </div>
    </div>`;
  }
  return `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" required ${type === 'number' ? 'min="0.01" step="0.01"' : ''}></div>`;
}

// Conecta el widget de un campo "image": maneja la selección de archivo
// (convertido a base64 con FileReader, igual que el logo de la clínica en
// Configuración), la vista previa y el botón de quitar. El valor final
// viaja en el input oculto "${name}", que FormData recoge como cualquier
// otro campo del formulario.
function initImageField(name) {
  const hidden = document.querySelector(`#${name}`);
  const fileInput = document.querySelector(`#${name}File`);
  const preview = document.querySelector(`#${name}Preview`);
  const placeholder = document.querySelector(`#${name}Placeholder`);
  const quitarBtn = document.querySelector(`#${name}Quitar`);
  if (!hidden || !fileInput) return;

  const mostrar = (dataUrl) => {
    hidden.value = dataUrl || '';
    if (dataUrl) {
      preview.src = dataUrl; preview.style.display = ''; placeholder.style.display = 'none'; quitarBtn.style.display = '';
    } else {
      preview.removeAttribute('src'); preview.style.display = 'none'; placeholder.style.display = ''; quitarBtn.style.display = 'none';
    }
  };
  mostrar(hidden.value || null); // estado inicial (útil al precargar en edición)

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 4.5 * 1024 * 1024) {
      alert('La imagen es demasiado grande. Usa una de máximo ~4MB.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => mostrar(reader.result);
    reader.readAsDataURL(file);
  });

  quitarBtn.addEventListener('click', () => { mostrar(null); fileInput.value = ''; });
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

// ------------------------------------------------------------------
// Autocompletado genérico: un <input> de texto + un <input hidden> con
// el id real, y una lista desplegable filtrada que se abre al escribir
// o al enfocar. Se usa donde una lista larga (ej. mascotas) sería
// confusa como <select> plano: aquí se escribe para filtrar y se hace
// clic en la opción deseada.
// ------------------------------------------------------------------
function attachAutocomplete(input, hidden, options, onSelect) {
  const list = input.parentElement.querySelector('.ac-list');

  const render = (filtro) => {
    const q = normalize(filtro);
    const filtrados = q ? options.filter(o => normalize(o.label).includes(q)) : options;
    list.innerHTML = filtrados.slice(0, 50).map(o => `<div class="ac-item" data-value="${o.value}">${o.label}</div>`).join('')
      || `<div class="ac-item muted">Sin resultados</div>`;
    list.hidden = false;
  };

  input.addEventListener('focus', () => render(input.value));
  input.addEventListener('input', () => { hidden.value = ''; render(input.value); });
  // mousedown (no click) para que dispare ANTES del blur del input.
  list.addEventListener('mousedown', (e) => {
    const item = e.target.closest('.ac-item[data-value]');
    if (!item) return;
    const opt = options.find(o => String(o.value) === item.dataset.value);
    if (!opt) return;
    hidden.value = opt.value;
    input.value = opt.label;
    list.hidden = true;
    onSelect?.(opt);
  });
  document.addEventListener('click', (e) => { if (!input.parentElement.contains(e.target)) list.hidden = true; });

  return {
    setValue(value) {
      const opt = options.find(o => String(o.value) === String(value));
      if (opt) { hidden.value = opt.value; input.value = opt.label; }
    },
  };
}

// ------------------------------------------------------------------
// Formulario de Pago (comprobante de venta con varios ítems y varias
// formas de pago). No usa el builder declarativo genérico porque
// necesita listas dinámicas (ítems, formas de pago) con totales y
// estado calculados en vivo (mismo cálculo que hace el backend, para
// que coincidan). El estado del pago NUNCA se elige a mano: sale solo
// de comparar lo pagado contra el total.
// ------------------------------------------------------------------
const IVA_PORCENTAJE = 0.15;

async function buildPagoForm() {
  const prefix = '../';
  const id = getIdFromUrl();
  const esEdicion = Boolean(id);

  document.body.dataset.page = 'pagos';
  document.body.insertAdjacentHTML('afterbegin', `<div class="layout">${sidebar(prefix)}<main class="content">
    <div class="topbar"><div><h1>${esEdicion ? 'Editar Pago' : 'Nuevo Pago'}</h1><p>Registra los productos/servicios y cómo se cobraron; el IVA, el total y el estado se calculan solos.</p></div><div class="actions"><button class="btn ghost" onclick="history.back()">← Volver</button></div></div>
    <section class="card"><div class="hint">💡 Elige la mascota escribiendo su nombre, agrega productos/servicios desde la lista y registra cómo se pagó (puede ser con más de una forma de pago).</div>
      <form id="pagoForm">
        <div class="form-grid" style="margin-bottom:16px">
          <div class="field ac-wrap">
            <label for="mascotaBuscar">Mascota</label>
            <input type="text" id="mascotaBuscar" autocomplete="off" placeholder="Escribe el nombre de la mascota o del dueño..." required>
            <input type="hidden" id="mascota_id" name="mascota_id">
            <div class="ac-list" id="mascotaList" hidden></div>
          </div>
          <div class="field"><label for="cita_id">Cita asociada (opcional)</label><select id="cita_id" name="cita_id"><option value="">Sin cita — venta de producto/servicio suelto</option></select></div>
          <div class="field"><label for="fecha">Fecha</label><input id="fecha" name="fecha" type="date" max="${new Date().toISOString().slice(0, 10)}" required></div>
        </div>

        <h3 style="margin:4px 0 10px">Productos / servicios</h3>
        <div class="table-wrap">
          <table><thead><tr><th>Producto / Servicio</th><th style="width:100px">Cantidad</th><th style="width:140px">Precio unitario</th><th style="width:140px">Subtotal</th><th></th></tr></thead>
          <tbody id="itemsRows"></tbody></table>
        </div>
        <button type="button" class="btn ghost sm" id="agregarItem" style="margin:12px 0">+ Agregar producto/servicio</button>

        <h3 style="margin:20px 0 10px">Formas de pago</h3>
        <div class="hint">💡 Deja esta sección vacía si todavía no se ha cobrado nada (queda "No pagado"). Puedes dividir el cobro entre varias formas de pago.</div>
        <div class="table-wrap" style="margin-top:10px">
          <table><thead><tr><th>Método</th><th style="width:160px">Monto</th><th></th></tr></thead>
          <tbody id="metodosRows"></tbody></table>
        </div>
        <button type="button" class="btn ghost sm" id="agregarMetodo" style="margin:12px 0">+ Agregar forma de pago</button>

        <table class="totales" style="width:320px;margin-left:auto">
          <tr><td>Subtotal</td><td style="text-align:right" id="totSubtotal">$0.00</td></tr>
          <tr><td>IVA (15%)</td><td style="text-align:right" id="totIva">$0.00</td></tr>
          <tr class="total-final"><td><b>Total a pagar</b></td><td style="text-align:right"><b id="totTotal">$0.00</b></td></tr>
          <tr><td>Total pagado</td><td style="text-align:right" id="totPagado">$0.00</td></tr>
          <tr><td>Saldo pendiente</td><td style="text-align:right" id="totSaldo">$0.00</td></tr>
          <tr><td>Estado</td><td style="text-align:right"><span class="badge" id="estadoBadge">No pagado</span></td></tr>
        </table>

        <div class="actions" style="margin-top:20px;justify-content:flex-end"><button type="button" class="btn ghost" onclick="history.back()">Cancelar</button><button class="btn success" type="submit" data-testid="form-submit-btn">Guardar</button></div>
      </form>
    </section>
  </main></div>${commonModal()}`);
  markActiveNav(); setupHelp(); setupModal();

  const [mascotas, citas, inventario] = await Promise.all([api.mascotas.listar(), api.citas.listar(), api.inventario.listar()]);

  // --- Mascota: autocompletado (escribir para filtrar, clic para elegir) ---
  const mascotaHidden = document.querySelector('#mascota_id');
  const mascotaOpciones = mascotas.map(m => ({ value: m.id, label: `${m.nombre} (${m.dueno})` }));
  const mascotaAC = attachAutocomplete(document.querySelector('#mascotaBuscar'), mascotaHidden, mascotaOpciones);

  // --- Cita asociada (opcional): al elegirla, autocompleta la mascota ---
  const citaSelect = document.querySelector('#cita_id');
  citaSelect.insertAdjacentHTML('beforeend', citas.map(c => `<option value="${c.id}" data-mascota="${c.mascota_id}">${c.mascota} — ${new Date(c.fecha).toLocaleDateString('es-ES')} ${c.hora} (${c.motivo})</option>`).join(''));
  citaSelect.addEventListener('change', () => {
    const opt = citaSelect.selectedOptions[0];
    if (opt?.dataset.mascota) mascotaAC.setValue(opt.dataset.mascota);
  });

  // --- Catálogo de productos/servicios (inventario): el vet/recepción
  // elige de esta lista, nunca escribe la descripción a mano, y el
  // precio unitario se autocompleta con el precio del inventario.
  const inventarioOrdenado = [...inventario].sort((a, b) => a.producto.localeCompare(b.producto));
  const opcionesInventario = (seleccionActual) => inventarioOrdenado.map(p =>
    `<option value="${p.id}" data-nombre="${p.producto.replace(/"/g, '&quot;')}" data-precio="${p.precio}" ${String(p.id) === String(seleccionActual) ? 'selected' : ''}>${p.producto} — ${money(p.precio)} (${p.categoria})</option>`
  ).join('');

  let items = [{ inventario_id: '', concepto: '', cantidad: 1, precio_unitario: '' }];

  const pintarItems = () => {
    document.querySelector('#itemsRows').innerHTML = items.map((it, i) => `<tr>
      <td><select class="it-producto" data-i="${i}" required><option value="">Seleccione...</option>${opcionesInventario(it.inventario_id)}</select></td>
      <td><input type="number" class="it-cantidad" data-i="${i}" min="0.01" step="0.01" value="${it.cantidad}" required></td>
      <td><input type="number" class="it-precio" data-i="${i}" min="0" step="0.01" value="${it.precio_unitario}" required></td>
      <td style="text-align:right">${money((Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0))}</td>
      <td>${items.length > 1 ? `<button type="button" class="btn ghost icon it-quitar" data-i="${i}" title="Quitar">🗑️</button>` : ''}</td>
    </tr>`).join('');
    recalcularTotales();
  };

  const recalcularTotales = () => {
    const subtotal = items.reduce((s, it) => s + (Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0), 0);
    const iva = subtotal * IVA_PORCENTAJE;
    document.querySelector('#totSubtotal').textContent = money(subtotal);
    document.querySelector('#totIva').textContent = money(iva);
    document.querySelector('#totTotal').textContent = money(subtotal + iva);
    recalcularPago();
  };

  document.querySelector('#itemsRows').addEventListener('change', (e) => {
    if (!e.target.classList.contains('it-producto')) return;
    const i = Number(e.target.dataset.i);
    const opt = e.target.selectedOptions[0];
    items[i].inventario_id = e.target.value;
    items[i].concepto = opt?.dataset.nombre || '';
    items[i].precio_unitario = opt?.dataset.precio || '';
    pintarItems();
  });
  document.querySelector('#itemsRows').addEventListener('input', (e) => {
    const i = Number(e.target.dataset.i);
    if (Number.isNaN(i)) return;
    if (e.target.classList.contains('it-cantidad')) items[i].cantidad = e.target.value;
    if (e.target.classList.contains('it-precio')) items[i].precio_unitario = e.target.value;
    // Solo refrescamos el subtotal de la fila y los totales, sin repintar
    // toda la tabla (perdería el foco del input mientras se escribe).
    const fila = e.target.closest('tr');
    fila.children[3].textContent = money((Number(items[i].cantidad) || 0) * (Number(items[i].precio_unitario) || 0));
    recalcularTotales();
  });
  document.querySelector('#itemsRows').addEventListener('click', (e) => {
    const btn = e.target.closest('.it-quitar');
    if (!btn) return;
    items.splice(Number(btn.dataset.i), 1);
    pintarItems();
  });
  document.querySelector('#agregarItem').addEventListener('click', () => {
    items.push({ inventario_id: '', concepto: '', cantidad: 1, precio_unitario: '' });
    pintarItems();
  });

  // --- Formas de pago: 0 o más filas (método + monto). Puede dividirse
  // el cobro, ej. $300 en efectivo + $200 con tarjeta de débito. ---
  let metodos = [{ metodo: '', monto: '' }];
  const METODO_OPCIONES = ['Efectivo', 'Tarjeta de débito', 'Tarjeta de crédito', 'Transferencia'];

  const pintarMetodos = () => {
    document.querySelector('#metodosRows').innerHTML = metodos.map((m, i) => `<tr>
      <td><select class="mt-metodo" data-i="${i}"><option value="">Seleccione...</option>${METODO_OPCIONES.map(op => `<option ${m.metodo === op ? 'selected' : ''}>${op}</option>`).join('')}</select></td>
      <td><input type="number" class="mt-monto" data-i="${i}" min="0.01" step="0.01" value="${m.monto}" placeholder="0.00"></td>
      <td>${metodos.length > 1 ? `<button type="button" class="btn ghost icon mt-quitar" data-i="${i}" title="Quitar">🗑️</button>` : ''}</td>
    </tr>`).join('');
    recalcularPago();
  };

  const recalcularPago = () => {
    const totalConIva = items.reduce((s, it) => s + (Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0), 0) * (1 + IVA_PORCENTAJE);
    const totalPagado = metodos.reduce((s, m) => s + (m.metodo && Number(m.monto) > 0 ? Number(m.monto) : 0), 0);
    const saldo = Math.max(0, totalConIva - totalPagado);
    const estado = totalPagado <= 0.001 ? 'No pagado' : totalPagado >= totalConIva - 0.01 ? 'Pagado' : 'Pago parcial';
    document.querySelector('#totPagado').textContent = money(totalPagado);
    document.querySelector('#totSaldo').textContent = money(saldo);
    const badge = document.querySelector('#estadoBadge');
    badge.textContent = estado;
    badge.className = `badge ${badgeEstadoPago(estado)}`;
  };

  document.querySelector('#metodosRows').addEventListener('change', (e) => {
    if (!e.target.classList.contains('mt-metodo')) return;
    metodos[Number(e.target.dataset.i)].metodo = e.target.value;
    recalcularPago();
  });
  document.querySelector('#metodosRows').addEventListener('input', (e) => {
    if (!e.target.classList.contains('mt-monto')) return;
    metodos[Number(e.target.dataset.i)].monto = e.target.value;
    recalcularPago();
  });
  document.querySelector('#metodosRows').addEventListener('click', (e) => {
    const btn = e.target.closest('.mt-quitar');
    if (!btn) return;
    metodos.splice(Number(btn.dataset.i), 1);
    pintarMetodos();
  });
  document.querySelector('#agregarMetodo').addEventListener('click', () => {
    metodos.push({ metodo: '', monto: '' });
    pintarMetodos();
  });

  const form = document.querySelector('#pagoForm');
  if (esEdicion) {
    const registroActual = await api.pagos.obtener(id);
    mascotaAC.setValue(registroActual.mascota_id);
    if (registroActual.cita_id) citaSelect.value = registroActual.cita_id;
    form.elements.fecha.value = String(registroActual.fecha).slice(0, 10);
    if (registroActual.items && registroActual.items.length) {
      items = registroActual.items.map(it => {
        // Intenta reencontrar el producto del inventario por nombre exacto
        // para dejar el select ya marcado; si ya no existe, queda "Otro"
        // (el precio/cantidad guardados se conservan igual).
        const match = inventarioOrdenado.find(p => p.producto === it.concepto);
        return { inventario_id: match ? match.id : '', concepto: it.concepto, cantidad: it.cantidad, precio_unitario: it.precio_unitario };
      });
    }
    if (registroActual.metodos && registroActual.metodos.length) {
      metodos = registroActual.metodos.map(m => ({ metodo: m.metodo, monto: m.monto }));
    }
  } else {
    form.elements.fecha.value = new Date().toISOString().slice(0, 10);
    // "💵 Cobrar" desde la ficha de una cita llega como #cita=7: preselecciona
    // la cita (y con ella la mascota, vía el listener de arriba).
    const citaId = getHashParam('cita');
    if (citaId) { citaSelect.value = citaId; citaSelect.dispatchEvent(new Event('change')); }
  }
  pintarItems();
  pintarMetodos();

  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!mascotaHidden.value) { alert('Elige una mascota de la lista (haz clic en una opción al escribir).'); return; }
    if (!validateVisible()) return;
    if (form.elements.fecha.value > new Date().toISOString().slice(0, 10)) {
      alert('La fecha del pago no puede ser futura.');
      return;
    }

    const totalConIva = items.reduce((s, it) => s + (Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0), 0) * (1 + IVA_PORCENTAJE);
    const totalPagado = metodos.reduce((s, m) => s + (m.metodo && Number(m.monto) > 0 ? Number(m.monto) : 0), 0);
    if (totalPagado > totalConIva + 0.01) { alert('Lo pagado no puede superar el total del comprobante.'); return; }

    const data = {
      mascota_id: Number(mascotaHidden.value),
      cita_id: citaSelect.value ? Number(citaSelect.value) : null,
      fecha: form.elements.fecha.value,
      items: items.map(it => ({ concepto: it.concepto, cantidad: Number(it.cantidad), precio_unitario: Number(it.precio_unitario) })),
      metodos: metodos.filter(m => m.metodo && Number(m.monto) > 0).map(m => ({ metodo: m.metodo, monto: Number(m.monto) })),
    };
    try {
      if (esEdicion) {
        await api.pagos.actualizar(id, data);
      } else {
        await api.pagos.crear(data);
      }
      successSave('Registro guardado correctamente.', 'pagos.html');
    } catch (err) {
      openConfirm('No se pudo guardar', err.message || 'Ocurrió un error al guardar el registro.', () => {});
      document.querySelector('#modalOk').textContent = 'Cerrar';
      document.querySelector('#modalOk').className = 'btn primary';
      document.querySelector('#modalCancel').style.display = 'none';
      document.querySelector('#modalOk').onclick = () => { closeModal(); document.querySelector('#modalCancel').style.display = ''; };
    }
  };
}