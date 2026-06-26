// =============================================================
//  db.js — Connexion à MariaDB via un pool (mysql2/promise)
//  Les identifiants viennent du fichier .env (voir .env.example).
// =============================================================
require("dotenv").config();
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || "localhost",
  port:     process.env.DB_PORT     || 3306,
  user:     process.env.DB_USER     || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME     || "oparis_kebab",
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4",
});

// Petit test de connexion au démarrage (log clair en cas d'erreur)
pool.getConnection()
  .then((c) => { console.log("✅ Connecté à MariaDB :", process.env.DB_NAME || "oparis_kebab"); c.release(); })
  .catch((e) => { console.error("❌ Connexion MariaDB impossible :", e.message); });

module.exports = pool;
