// ===============================================================
// server.js — API REST SIG Web: Barrios de Florencia
// Flujo: PostGIS → SQL espacial → Express → GeoJSON → navegador
// ===============================================================

// 1. Configuración e importaciones
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool, probarConexion } from './db.js';
import { SQL_BARRIOS_GEOJSON } from './consultas.js';

const app = express();
const PORT = process.env.PORT || 3000;
const ORIGENES_PERMITIDOS = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origen) => origen.trim())
    .filter(Boolean);

// 2. Middleware CORS: autoriza al frontend (Live Server) a leer las respuestas
app.use(cors({ origin: ORIGENES_PERMITIDOS }));

// 3. Middleware de registro: muestra en la terminal cada petición recibida
app.use((req, res, next) => {
    console.log(`${new Date().toLocaleTimeString()}  ${req.method} ${req.originalUrl}`);
    next();
});

// 4. Endpoint raíz: describe la API
app.get('/', (req, res) => {
    res.json({
        nombre: 'API SIG Web — Barrios de Florencia',
        endpoints: [
            'GET /api/salud',
            'GET /api/db/prueba',
            'GET /api/capas/barrios'
        ]
    });
});

// 5. Salud del servidor (no usa la base de datos)
app.get('/api/salud', (req, res) => {
    res.json({
        estado: 'ok',
        mensaje: 'El servidor Express está funcionando',
        fecha: new Date().toISOString()
    });
});

// 6. Prueba de conexión con PostgreSQL/PostGIS
app.get('/api/db/prueba', async (req, res) => {
    try {
        const info = await probarConexion();
        res.json({ estado: 'ok', conexion: info });
    } catch (error) {
        console.error('Error de base de datos:', error.code, error.message);
        res.status(500).json({
            estado: 'error',
            mensaje: 'No fue posible conectar con PostgreSQL',
            codigo: error.code
        });
    }
});

// 7. ENDPOINT PRINCIPAL: barrios de Florencia en GeoJSON
app.get('/api/capas/barrios', async (req, res) => {
    const inicio = Date.now();
    try {
        // 7.1 Ejecutar la consulta espacial en PostGIS
        const resultado = await pool.query(SQL_BARRIOS_GEOJSON);

        // 7.2 La consulta devuelve UNA fila con UNA columna llamada "geojson".
        //     pg convierte automáticamente el tipo json de PostgreSQL en un objeto JavaScript.
        const geojson = resultado.rows[0].geojson;

        console.log(`   → ${geojson.features.length} barrios enviados en ${Date.now() - inicio} ms`);

        // 7.3 Responder con código 200 y Content-Type: application/json
        res.json(geojson);
    } catch (error) {
        // 7.4 Si algo falla, registrar el detalle en el servidor y responder 500
        console.error('Error al consultar los barrios:', error.code, error.message);
        res.status(500).json({
            estado: 'error',
            mensaje: 'No fue posible obtener la capa de barrios',
            codigo: error.code
        });
    }
});

// 8. Rutas inexistentes → 404 en JSON (siempre al final de las rutas)
app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada', ruta: req.originalUrl });
});

// 9. Iniciar el servidor y probar la base de datos
const servidor = app.listen(PORT, async () => {
    console.log(`API escuchando en http://localhost:${PORT}`);
    console.log(`Orígenes CORS permitidos: ${ORIGENES_PERMITIDOS.join(', ')}`);
    try {
        const info = await probarConexion();
        console.log(`Conectado a PostgreSQL → base "${info.base_de_datos}", usuario "${info.usuario}", PostGIS ${info.version_postgis}`);
    } catch (error) {
        console.error(`No se pudo conectar a PostgreSQL (${error.code}): ${error.message}`);
    }
});

// 10. Error típico al iniciar: el puerto está ocupado
servidor.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`El puerto ${PORT} está ocupado. Cambia PORT en el archivo .env`);
    } else {
        console.error('Error al iniciar el servidor:', error.message);
    }
    process.exit(1);
});