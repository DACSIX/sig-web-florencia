// ===============================================================
// db.js — Conexión con PostgreSQL/PostGIS mediante un pool
// ===============================================================
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

// Un "pool" mantiene varias conexiones abiertas y las reutiliza.
// Abrir una conexión nueva en cada petición sería lento.
export const pool = new Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    max: 10,                       // máximo de conexiones simultáneas
    idleTimeoutMillis: 30000,      // cerrar conexiones inactivas tras 30 s
    connectionTimeoutMillis: 5000, // error si no conecta en 5 s
    // Seguridad: todas las sesiones de la API son de SOLO LECTURA.
    // Aunque hubiera un error en el código, la API no podría modificar datos.
    options: '-c default_transaction_read_only=on'
});

// Errores inesperados en conexiones inactivas (por ejemplo, PostgreSQL se reinició)
pool.on('error', (error) => {
    console.error('Error inesperado en el pool de PostgreSQL:', error.message);
});

// Consulta mínima para verificar la conexión
export async function probarConexion() {
    const resultado = await pool.query(`
    SELECT current_database()  AS base_de_datos,
           current_user        AS usuario,
           inet_server_port()  AS puerto,
           postgis_version()   AS version_postgis,
           current_setting('default_transaction_read_only') AS solo_lectura
  `);
    return resultado.rows[0];
}