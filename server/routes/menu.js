// routes/menu.js — Lecture du menu côté client (public)
const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET /api/menu  -> tout le menu structuré pour le front
router.get("/menu", async (req, res) => {
  try {
    const [categories] = await pool.query(
      "SELECT id, nom FROM categories WHERE actif = 1 ORDER BY ordre"
    );
    const [produits] = await pool.query(
      `SELECT id, categorie_id, nom, description,
              prix_seul, prix_menu, prix_classic, prix_maxi, allergenes
         FROM produits WHERE dispo = 1 ORDER BY ordre`
    );
    const [options] = await pool.query(
      "SELECT id, type, nom, prix FROM options_choix WHERE dispo = 1 ORDER BY ordre"
    );
    const [regles] = await pool.query(
      "SELECT produit_id, type, min_choix, max_choix FROM produit_options"
    );
    res.json({ categories, produits, options, regles });
  } catch (e) {
    console.error("Erreur GET /menu :", e.message);
    res.status(500).json({ erreur: "Impossible de charger le menu." });
  }
});

// GET /api/parametres
router.get("/parametres", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT cle, valeur FROM parametres WHERE cle IN ('message_delai','heure_limite_commande','horaires')"
    );
    const out = {};
    rows.forEach((r) => (out[r.cle] = r.valeur));
    res.json(out);
  } catch (e) {
    res.status(500).json({ erreur: "Erreur paramètres." });
  }
});

module.exports = router;
