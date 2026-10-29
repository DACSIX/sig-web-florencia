// ===============================================================
// script.js — Mapa SIG Web: Barrios de Florencia
// Fase 7: las cinco opciones de L.geoJSON
// ===============================================================

// ---------- 0. Configuración ----------
const API_BARRIOS = 'http://localhost:3000/api/capas/barrios';
const CENTRO_FLORENCIA = [1.6142, -75.6062]; // [latitud, longitud] (orden de Leaflet)
const ZOOM_INICIAL = 14;

// Estilo inicial de los barrios (lo usarán style y, en la Fase 8, resetStyle)
const ESTILO_BASE = {
    color: '#1b5e20',     // color del borde
    weight: 1.5,          // grosor del borde en píxeles
    opacity: 1,           // transparencia del borde (0 a 1)
    fillColor: '#66bb6a', // color del relleno
    fillOpacity: 0.35     // transparencia del relleno (0 a 1)
};

// ---------- Estado de la aplicación ----------
let datosBarrios = null;      // FeatureCollection original recibida de la API
let comunaFiltro = null;      // null = sin filtro; un número = comuna seleccionada
let featuresProcesados = 0;   // contador de onEachFeature
let verticesConvertidos = 0;  // contador de coordsToLatLng
let capaPuntoDemo = null;     // capa del punto ilustrativo (pointToLayer)

// ---------- Elementos del panel ----------
const elMensaje = document.getElementById('mensaje');
const elContador = document.getElementById('contador');
const elProcesados = document.getElementById('procesados');
const elVertices = document.getElementById('vertices');
const elSelectComuna = document.getElementById('selectComuna');
const elResultadoCoords = document.getElementById('resultadoCoords');
const elEnMapa = document.getElementById('enMapa');

function mostrarMensaje(texto, tipo = '') {
    elMensaje.textContent = texto;
    elMensaje.className = tipo;
}

function actualizarIndicadores() {
    elContador.textContent = capaBarrios.getLayers().length;
    elEnMapa.textContent = mapa.hasLayer(capaBarrios) ? 'Sí' : 'No';
    elProcesados.textContent = featuresProcesados;
    elVertices.textContent = verticesConvertidos.toLocaleString('es-CO');
}

// ---------- 1. Mapa y mapa base ----------
const mapa = L.map('mapa').setView(CENTRO_FLORENCIA, ZOOM_INICIAL);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(mapa);

// ===============================================================
// 2. LAS CINCO OPCIONES DE L.geoJSON
// ===============================================================

// --- OPCIÓN 1: style ---
// Se ejecuta para cada línea o polígono y devuelve su apariencia.
// Es una función, así que podría variar según el Feature
// (eso es justamente lo que usará el grupo de mapas temáticos).
function estiloBarrio(feature) {
    return ESTILO_BASE;
}

// --- OPCIÓN 2: onEachFeature ---
// Se ejecuta UNA vez por cada Feature, DESPUÉS de crear su capa.
// Recibe el Feature GeoJSON (datos) y la capa de Leaflet (dibujo).
function alCrearCadaBarrio(feature, layer) {
    featuresProcesados++;
    const p = feature.properties;

    // Ventana emergente al hacer clic
    layer.bindPopup(`
    <div class="popup-barrio">
      <h3>${p.nombre}</h3>
      <table>
        <tr><td>Comuna</td><td>${p.cod_comuna}</td></tr>
        <tr><td>Código barrio</td><td>${p.cod_barrio}</td></tr>
        <tr><td>OBJECTID</td><td>${p.objectid}</td></tr>
        <tr><td>GID</td><td>${p.gid}</td></tr>
      </table>
    </div>`);

    // Etiqueta que sigue al cursor al pasar el mouse
    layer.bindTooltip(p.nombre, { sticky: true });
}

// --- OPCIÓN 3: filter ---
// Se ejecuta ANTES de crear cada capa. Si devuelve false, el Feature se descarta.
// cod_comuna es numérico (double precision), por eso comparamos con un número.
function filtrarBarrio(feature) {
    if (comunaFiltro === null) return true;          // filtro desactivado: incluir todos
    return feature.properties.cod_comuna === comunaFiltro;
}

// --- OPCIÓN 5: coordsToLatLng ---
// Se ejecuta para CADA vértice. GeoJSON trae [longitud, latitud];
// Leaflet necesita L.latLng(latitud, longitud). Solo invierte el orden:
// NO reproyecta, porque PostGIS ya entregó los datos en WGS84 con ST_Transform.
function convertirCoordenada(coords) {
    verticesConvertidos++;
    const longitud = coords[0];
    const latitud = coords[1];
    return L.latLng(latitud, longitud);
}

// --- Creación de la capa con las opciones ---
// (pointToLayer, la opción 4, se demuestra en una capa aparte, más abajo,
//  porque los barrios son polígonos y esa opción solo actúa sobre puntos)
const capaBarrios = L.geoJSON(null, {
    style: estiloBarrio,
    onEachFeature: alCrearCadaBarrio,
    filter: filtrarBarrio,
    coordsToLatLng: convertirCoordenada
}).addTo(mapa);

// ===============================================================
// 3. CARGA DE DATOS DESDE LA API
// ===============================================================

// Vuelve a construir la capa a partir de los datos originales.
// Las opciones se aplican DURANTE addData(), así que para que un nuevo
// filtro tenga efecto hay que vaciar la capa y volver a agregar los datos.
function dibujarBarrios() {
    featuresProcesados = 0;
    verticesConvertidos = 0;
    capaBarrios.clearLayers();         // vacía la capa en Leaflet (no toca PostgreSQL)
    capaBarrios.addData(datosBarrios); // reaplica filter, coordsToLatLng, style y onEachFeature
    actualizarIndicadores();
}

// Llena el selector con las comunas presentes en los datos
function llenarSelectComunas(datos) {
    const conteo = {};
    datos.features.forEach((f) => {
        const c = f.properties.cod_comuna;
        if (c !== null) conteo[c] = (conteo[c] || 0) + 1;
    });

    Object.keys(conteo)
        .map(Number)
        .sort((a, b) => a - b)
        .forEach((comuna) => {
            const opcion = document.createElement('option');
            opcion.value = comuna;
            opcion.textContent = `Comuna ${comuna} (${conteo[comuna]} barrios)`;
            elSelectComuna.appendChild(opcion);
        });
}

async function cargarBarrios() {
    mostrarMensaje('Consultando la API…');
    console.log('[1] fetch → GET', API_BARRIOS);

    try {
        const respuesta = await fetch(API_BARRIOS);
        console.log('[2] Respuesta HTTP:', respuesta.status, respuesta.statusText);
        if (!respuesta.ok) throw new Error(`La API respondió con código ${respuesta.status}`);

        datosBarrios = await respuesta.json();
        console.log('[3] GeoJSON recibido:', datosBarrios.features.length, 'features');

        llenarSelectComunas(datosBarrios);
        dibujarBarrios();
        console.log('[4] addData() → capas creadas:', capaBarrios.getLayers().length,
            '| vértices convertidos:', verticesConvertidos);

        mostrarMensaje(`Se cargaron ${capaBarrios.getLayers().length} barrios desde PostGIS.`, 'ok');
    } catch (error) {
        console.error('Error al cargar los barrios:', error);
        mostrarMensaje(`No se pudieron cargar los barrios: ${error.message}. ¿Está corriendo la API?`, 'error');
    }
}

// ===============================================================
// 4. DEMOSTRACIONES DE LA INTERFAZ
// ===============================================================

// --- filter: activar y desactivar ---
function aplicarFiltro(valor) {
    if (!datosBarrios) return;
    comunaFiltro = valor === '' ? null : Number(valor); // el <select> entrega texto
    dibujarBarrios();

    const visibles = capaBarrios.getLayers().length;
    const total = datosBarrios.features.length;
    if (comunaFiltro === null) {
        mostrarMensaje(`filter desactivado: se muestran los ${visibles} barrios.`, 'ok');
    } else {
        mostrarMensaje(`filter activo: comuna ${comunaFiltro} → ${visibles} de ${total} barrios.`, 'ok');
    }
}

elSelectComuna.addEventListener('change', (e) => aplicarFiltro(e.target.value));

document.getElementById('btnQuitarFiltro').addEventListener('click', () => {
    elSelectComuna.value = '';
    aplicarFiltro('');
});

// --- OPCIÓN 4: pointToLayer ---
// Punto GeoJSON ILUSTRATIVO, escrito a mano: NO proviene de la base de datos.
const PUNTO_DEMO = {
    type: 'Feature',
    properties: {
        nombre: 'Punto ilustrativo',
        origen: 'Creado en script.js — no proviene de PostGIS'
    },
    geometry: {
        type: 'Point',
        coordinates: [-75.6062, 1.6142] // [longitud, latitud], orden GeoJSON
    }
};

function mostrarPunto(usarPointToLayer) {
    if (capaPuntoDemo) capaPuntoDemo.remove();

    const opciones = {
        onEachFeature: (feature, layer) => {
            layer.bindPopup(`<strong>${feature.properties.nombre}</strong><br>${feature.properties.origen}`);
        }
    };

    if (usarPointToLayer) {
        // pointToLayer recibe el Feature y su posición ya convertida a LatLng,
        // y devuelve el objeto de Leaflet que queremos crear.
        opciones.pointToLayer = (feature, latlng) => L.circleMarker(latlng, {
            radius: 10,
            color: '#e65100',
            weight: 2,
            fillColor: '#ff9800',
            fillOpacity: 0.9
        });
    }

    capaPuntoDemo = L.geoJSON(PUNTO_DEMO, opciones).addTo(mapa);

    // Verificación: ¿qué tipo de objeto creó Leaflet?
    const capa = capaPuntoDemo.getLayers()[0];
    const tipo = capa instanceof L.CircleMarker ? 'L.CircleMarker' : 'L.Marker';
    mostrarMensaje(
        usarPointToLayer
            ? `pointToLayer activo: el punto se dibujó como ${tipo} (círculo naranja).`
            : `Sin pointToLayer: Leaflet creó un ${tipo} (marcador azul por defecto).`,
        'ok'
    );
}

document.getElementById('btnPuntoDefecto').addEventListener('click', () => mostrarPunto(false));
document.getElementById('btnPuntoCirculo').addEventListener('click', () => mostrarPunto(true));
document.getElementById('btnOcultarPunto').addEventListener('click', () => {
    if (capaPuntoDemo) {
        capaPuntoDemo.remove();
        capaPuntoDemo = null;
    }
    mostrarMensaje('Punto ilustrativo oculto.', 'ok');
});

// --- OPCIÓN 5: verificar coordsToLatLng ---
document.getElementById('btnVerificarCoords').addEventListener('click', () => {
    const capa = capaBarrios.getLayers()[0];
    if (!capa) {
        mostrarMensaje('No hay barrios en la capa para verificar.', 'error');
        return;
    }

    // MultiPolygon: [polígono][anillo][vértice] → primer vértice del primer anillo
    const original = capa.feature.geometry.coordinates[0][0][0]; // [lng, lat] de GeoJSON
    const convertido = capa.getLatLngs()[0][0][0];                 // L.LatLng de Leaflet

    elResultadoCoords.textContent =
        `Barrio: ${capa.feature.properties.nombre}\n` +
        `GeoJSON  [lng, lat]  = [${original[0].toFixed(6)}, ${original[1].toFixed(6)}]\n` +
        `Leaflet  LatLng      = (lat ${convertido.lat.toFixed(6)}, lng ${convertido.lng.toFixed(6)})\n` +
        `Mismos valores, orden invertido. Sin reproyección.`;

    mostrarMensaje(`coordsToLatLng convirtió ${verticesConvertidos.toLocaleString('es-CO')} vértices.`, 'ok');
});


// 5. LOS OCHO MÉTODOS DE L.geoJSON 

// Estilo temporal para demostrar setStyle()
const ESTILO_DESTACADO = {
    color: '#0d47a1',
    weight: 2.5,
    fillColor: '#42a5f5',
    fillOpacity: 0.55
};

let rectanguloExtension = null; // rectángulo que dibuja getBounds()
const elResultadoMetodo = document.getElementById('resultadoMetodo');

function mostrarResultado(texto) {
    elResultadoMetodo.textContent = texto;
}

function hayDatos() {
    if (!datosBarrios) {
        mostrarMensaje('Primero deben cargarse los datos desde la API.', 'error');
        return false;
    }
    return true;
}

function totalEnCapa() {
    return capaBarrios.getLayers().length;
}

// --- 1. addData() — propio de L.GeoJSON ---
// Convierte Features GeoJSON en capas y las AGREGA a las existentes.
function metodoAddData() {
    if (!hayDatos()) return;
    const antes = totalEnCapa();
    capaBarrios.addData(datosBarrios); // datos en memoria: no hay nueva petición HTTP
    const despues = totalEnCapa();
    actualizarIndicadores();

    mostrarMensaje(`addData(): la capa pasó de ${antes} a ${despues} barrios.`, 'ok');
    mostrarResultado(antes > 0
        ? 'Atención: addData() AGREGA, no reemplaza.\n' +
        'Ahora hay barrios duplicados (se ven más oscuros).\n' +
        'Usa clearLayers() antes, o Restablecer.'
        : `Se agregaron ${despues} barrios desde los datos en memoria.\n` +
        'Revisa Network: no hubo nueva petición a la API.');
}

// --- 2. setStyle() — heredado de L.FeatureGroup ---
// Aplica el mismo estilo a todos los elementos de la capa.
function metodoSetStyle() {
    capaBarrios.setStyle(ESTILO_DESTACADO);
    const ejemplo = capaBarrios.getLayers()[0];
    mostrarMensaje('setStyle(): todos los barrios cambiaron a azul.', 'ok');
    mostrarResultado(ejemplo
        ? `fillColor del primer barrio: ${ejemplo.options.fillColor}`
        : 'La capa está vacía: no hay barrios a los que aplicar el estilo.');
}

// --- 3. resetStyle() — propio de L.GeoJSON ---
// Vuelve al estilo definido en la opción "style" al crear la capa.
function metodoResetStyle() {
    capaBarrios.resetStyle();
    const ejemplo = capaBarrios.getLayers()[0];
    mostrarMensaje('resetStyle(): los barrios volvieron al estilo inicial (verde).', 'ok');
    mostrarResultado(ejemplo
        ? `fillColor del primer barrio: ${ejemplo.options.fillColor}\n` +
        `(el definido en ESTILO_BASE: ${ESTILO_BASE.fillColor})`
        : 'La capa está vacía.');
}

// --- 4. clearLayers() — heredado de L.LayerGroup ---
// Elimina todos los elementos de la capa. La capa sigue en el mapa, pero vacía.
function metodoClearLayers() {
    const antes = totalEnCapa();
    capaBarrios.clearLayers();
    actualizarIndicadores();
    mostrarMensaje('clearLayers(): la capa quedó vacía.', 'ok');
    mostrarResultado(
        `Barrios antes: ${antes}\n` +
        `Barrios después: ${totalEnCapa()}\n` +
        `¿La capa sigue en el mapa? ${mapa.hasLayer(capaBarrios) ? 'Sí (vacía)' : 'No'}\n` +
        'PostgreSQL: sin cambios (la API es de solo lectura).\n' +
        'Para recuperarlos: addData().'
    );
}

// --- 5. eachLayer() — heredado de L.LayerGroup ---
// Ejecuta una función por cada elemento de la capa.
function metodoEachLayer() {
    let procesadas = 0;
    const comunas = new Set();
    const tabla = [];

    capaBarrios.eachLayer((layer) => {
        procesadas++;
        const p = layer.feature.properties;
        comunas.add(p.cod_comuna);
        tabla.push({ gid: p.gid, nombre: p.nombre, comuna: p.cod_comuna });
    });

    console.table(tabla); // tabla completa en la pestaña Console
    mostrarMensaje(`eachLayer(): se recorrieron ${procesadas} capas.`, 'ok');
    mostrarResultado(
        `Capas procesadas: ${procesadas}\n` +
        `Comunas distintas: ${comunas.size}\n` +
        'Detalle completo: abre Console (F12).'
    );
}

// --- 6. getBounds() — heredado de L.FeatureGroup ---
// Calcula el rectángulo que contiene todos los elementos.
function metodoGetBounds() {
    if (totalEnCapa() === 0) {
        mostrarMensaje('getBounds(): la capa está vacía, no hay extensión que calcular.', 'error');
        return;
    }
    const limites = capaBarrios.getBounds();
    mapa.fitBounds(limites, { padding: [20, 20] }); // ajusta la vista a la extensión

    // Dibujar la extensión como un rectángulo punteado
    if (rectanguloExtension) rectanguloExtension.remove();
    rectanguloExtension = L.rectangle(limites, {
        color: '#e65100', weight: 2, dashArray: '6 4', fill: false, interactive: false
    }).addTo(mapa);

    const so = limites.getSouthWest();
    const ne = limites.getNorthEast();
    mostrarMensaje('getBounds(): el mapa se ajustó a la extensión de los barrios.', 'ok');
    mostrarResultado(
        `Suroeste: lat ${so.lat.toFixed(6)}, lng ${so.lng.toFixed(6)}\n` +
        `Noreste:  lat ${ne.lat.toFixed(6)}, lng ${ne.lng.toFixed(6)}`
    );
}

// --- 7. addTo() — heredado de L.Layer ---
// Agrega la capa al mapa (o la vuelve a mostrar si se había retirado).
function metodoAddTo() {
    const yaEstaba = mapa.hasLayer(capaBarrios);
    capaBarrios.addTo(mapa);
    actualizarIndicadores();
    mostrarMensaje(yaEstaba
        ? 'addTo(): la capa ya estaba en el mapa; no hubo cambios.'
        : `addTo(): la capa volvió al mapa con sus ${totalEnCapa()} barrios.`, 'ok');
    mostrarResultado(
        `¿La capa está en el mapa? Sí\n` +
        `Barrios en la capa: ${totalEnCapa()}\n` +
        'No se consultó la API: los barrios seguían en memoria.'
    );
}

// --- 8. remove() — heredado de L.Layer ---
// Retira la capa del mapa SIN vaciarla.
function metodoRemove() {
    capaBarrios.remove();
    actualizarIndicadores();
    mostrarMensaje('remove(): la capa se retiró del mapa.', 'ok');
    mostrarResultado(
        `¿La capa está en el mapa? ${mapa.hasLayer(capaBarrios) ? 'Sí' : 'No'}\n` +
        `Barrios guardados en la capa: ${totalEnCapa()}\n` +
        'Siguen en memoria: addTo() los muestra de nuevo.'
    );
}

// --- Restablecer el estado inicial de la demostración ---
function restablecerDemostracion() {
    if (!hayDatos()) return;
    mapa.closePopup();

    // Quitar el filtro
    comunaFiltro = null;
    elSelectComuna.value = '';

    // Quitar elementos auxiliares
    if (capaPuntoDemo) { capaPuntoDemo.remove(); capaPuntoDemo = null; }
    if (rectanguloExtension) { rectanguloExtension.remove(); rectanguloExtension = null; }

    // Volver a mostrar la capa y reconstruirla con el estilo inicial
    capaBarrios.addTo(mapa);
    dibujarBarrios(); // clearLayers() + addData() con las opciones de la Fase 7

    // Vista inicial y paneles limpios
    mapa.setView(CENTRO_FLORENCIA, ZOOM_INICIAL);
    elResultadoCoords.textContent = '';
    mostrarResultado('');
    mostrarMensaje(`Demostración restablecida: ${totalEnCapa()} barrios con el estilo inicial.`, 'ok');
}

// --- Conectar cada botón con su método ---
const BOTONES_METODOS = {
    btnAddData: metodoAddData,
    btnSetStyle: metodoSetStyle,
    btnResetStyle: metodoResetStyle,
    btnClearLayers: metodoClearLayers,
    btnEachLayer: metodoEachLayer,
    btnGetBounds: metodoGetBounds,
    btnAddTo: metodoAddTo,
    btnRemove: metodoRemove,
    btnRestablecer: restablecerDemostracion
};

Object.entries(BOTONES_METODOS).forEach(([id, funcion]) => {
    document.getElementById(id).addEventListener('click', funcion);
});
// ---------- 5. Iniciar ----------
cargarBarrios();