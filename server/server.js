// =============================================================
//  server.js — Point d'entrée du serveur O Paris Kebab
//  Sert le front (dossier /public) + expose l'API sous /api.
// =============================================================
require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 16400;

// Lecture du JSON envoyé par le front
app.use(express.json());

// Fichiers statiques (HTML/CSS/JS du site) servis depuis ../public
app.use(express.static(path.join(__dirname, "..", "public")));

// Routes API
app.use("/api", require("./routes/menu"));
app.use("/api", require("./routes/commandes"));
app.use("/api/admin", require("./routes/admin"));

// 404 pour les routes API inconnues
app.use("/api", (req, res) => res.status(404).json({ erreur: "Route inconnue." }));

app.listen(16400, "0.0.0.0",  () => {
  console.log(`🥙 O Paris Kebab en ligne : http://localhost:${PORT}`);
});
