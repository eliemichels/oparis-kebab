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

// --- CONFIGURATION DE LA GESTION DES IMAGES PRODUITS ---

// 1. Création automatique du dossier "uploads" s'il n'existe pas
const UPLOADS_DIR = path.join(__dirname, "..", "public", "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// 2. Configuration de Multer pour stocker et nommer proprement les images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    // On nomme le fichier d'après l'ID du produit (ex: produit-12.jpg)
    const produitId = req.params.id;
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `produit-${produitId}${extension}`);
  }
});

// Filtre de sécurité sur les formats d'images autorisés
const fileFilter = (req, file, cb) => {
  const typesAutorises = /jpeg|jpg|png|webp/;
  const mimeType = typesAutorises.test(file.mimetype);
  const extName = typesAutorises.test(path.extname(file.originalname).toLowerCase());

  if (mimeType && extName) {
    return cb(null, true);
  }
  cb(new Error("Le fichier doit être une image valide (JPG, PNG ou WebP)."));
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // Limite à 5 Mo max
});

// --- EN-TÊTE DE VÉRIFICATION DU CODE ADMIN ---
function verifierCodeAdmin(req, res, next) {
  const codeRecu = req.headers['x-code-admin'];
  const CODE_CORRECT = process.env.ADMIN_CODE || "kebab2026";
  if (codeRecu === CODE_CORRECT) {
    next();
  } else {
    res.status(401).json({ erreur: "Accès refusé. Code incorrect." });
  }
}

// =============================================================
//  ROUTES DE GESTION DES IMAGES (ADMIN) — MARIADB COMPATIBLE
// =============================================================

/**
 * Ajout ou mise à jour de l'image d'un produit
 * POST /api/admin/produits/:id/image
 */
app.post('/api/admin/produits/:id/image', verifierCodeAdmin, upload.single('image'), (req, res) => {
  const produitId = req.params.id;

  if (!req.file) {
    return res.status(400).json({ erreur: "Aucun fichier image reçu." });
  }

  // Chemin relatif utilisé par le client pour charger l'image
  const urlImage = `/uploads/${req.file.filename}`;
  const sql = `UPDATE produits SET image = ? WHERE id = ?`;
  
  db.query(sql, [urlImage, produitId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ erreur: "Erreur lors de la mise à jour de l'image en base de données." });
    }
    res.json({ succes: true, chemin: urlImage });
  });
});

/**
 * Suppression physique et logique de l'image d'un produit
 * DELETE /api/admin/produits/:id/image
 */
app.delete('/api/admin/produits/:id/image', verifierCodeAdmin, (req, res) => {
  const produitId = req.params.id;
  const sqlSelect = `SELECT image FROM produits WHERE id = ?`;
  
  db.query(sqlSelect, [produitId], (err, results) => {
    if (err) return res.status(500).json({ erreur: "Erreur lors de la recherche du produit." });
    
    // MariaDB retourne les résultats sous forme de tableau
    if (!results || results.length === 0) {
      return res.status(404).json({ erreur: "Produit introuvable." });
    }

    const produit = results[0];

    if (produit.image) {
      const nomFichier = path.basename(produit.image);
      const cheminPhysique = path.join(UPLOADS_DIR, nomFichier);

      fs.unlink(cheminPhysique, (errUnlink) => {
        if (errUnlink) console.warn("Fichier physique introuvable sur le disque, suppression ignorée.");
      });
    }

    const sqlUpdate = `UPDATE produits SET image = NULL WHERE id = ?`;
    db.query(sqlUpdate, [produitId], (errUpdate) => {
      if (errUpdate) return res.status(500).json({ erreur: "Erreur lors du nettoyage de la base de données." });
      res.json({ succes: true, message: "Image supprimée." });
    });
  });
});

// =============================================================

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

app.listen(16400, "0.0.0.0", () => {
  console.log(`🥙 O Paris Kebab en ligne : http://localhost:${PORT}`);
});
