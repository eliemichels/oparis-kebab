// =============================================================
//  server.js — Point d'entrée du serveur O Paris Kebab
//  Sert le front (dossier /public) + expose l'API sous /api.
// =============================================================
require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const db = require("./db"); // Importation de db.js (MariaDB)

const app = express();
const PORT = process.env.PORT || 16400;

// Lecture du JSON envoyé par le front
app.use(express.json());

// NOTE : la gestion des images produits (Multer, dossier d'upload,
// vérification du code admin) est centralisée dans routes/admin.js.
// Les routes d'upload/suppression d'image produit
// (POST et DELETE /api/admin/produits/:id/image) sont gérées
// dans routes/admin.js, avec la bonne vérification du code admin
// (celle stockée en base, la même que pour la connexion à l'admin).
// Elles ne doivent PAS être redéfinies ici, sinon elles entrent
// en conflit et court-circuitent silencieusement celles d'admin.js.

// Fichiers statiques (HTML/CSS/JS du site) servis depuis ../public
app.use(express.static(path.join(__dirname, "..", "public")));

// Routes API existantes
app.use("/api", require("./routes/menu"));
app.use("/api", require("./routes/commandes"));
app.use("/api/admin", require("./routes/admin"));

// 404 pour les routes API inconnues
app.use("/api", (req, res) => res.status(404).json({ erreur: "Route inconnue." }));

// Intercepteur d'erreurs global (notamment pour gérer les fichiers trop lourds de Multer)
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ erreur: "Image trop lourde. Limite maximale : 5 Mo." });
  } else if (err) {
    return res.status(400).json({ erreur: err.message });
  }
  next();
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🥙 O Paris Kebab en ligne : http://localhost:${PORT}`);
});
