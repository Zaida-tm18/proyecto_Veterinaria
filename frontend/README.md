# Prototipo Web - Sistema Veterinario

Proyecto creado para Visual Studio Code con HTML, CSS y JavaScript.

## Cómo abrir
1. Abre la carpeta `veterinaria-prototipo` en Visual Studio Code.
2. Instala la extensión **Live Server**.
3. Clic derecho en `index.html` > **Open with Live Server**.

## Estructura
- `index.html`: dashboard principal.
- `pages/mascotas.html`: listado y búsqueda de mascotas.
- `pages/citas.html`: agenda y estados de citas.
- `pages/tratamientos.html`: tarjetas de tratamientos.
- `pages/pagos.html`: KPIs financieros y tabla de transacciones.
- `pages/inventario.html`: indicadores de inventario y filtro de stock bajo.
- `pages/*-form.html`: formularios separados, conectados mediante botones.
- `assets/css/styles.css`: diseño visual general.
- `assets/js/api.js`: datos de prueba.
- `assets/js/main.js`: navegación, tablas, filtros y modales.
- `assets/js/forms.js`: formularios, pasos y autoguardado.

## Importante
Esto es un prototipo frontend. No usa base de datos. El guardado se simula con JavaScript y `localStorage`.
