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
    // On renvoie TOUS les produits avec leur dispo (le front grise les morts)
    const [produits] = await pool.query(
      `SELECT id, categorie_id, nom, description,
              prix_seul, prix_menu, prix_classic, prix_maxi, allergenes, dispo, image
         FROM produits ORDER BY ordre`
    );
    const [options] = await pool.query(
      "SELECT id, type, nom, prix, dispo FROM options_choix ORDER BY type, ordre"
    );
    const [regles] = await pool.query(
      "SELECT produit_id, type, min_choix, max_choix FROM produit_options"
    );
    // Ingrédients clés : si l'un est en rupture, le produit est "mort"
    const [liens] = await pool.query(
      `SELECT pi.produit_id, oc.dispo
         FROM produit_ingredients pi
         JOIN options_choix oc ON oc.id = pi.option_id`
    );
    const ingredientManquant = {};
    liens.forEach((l) => {
      if (l.dispo !== 1) ingredientManquant[l.produit_id] = true;
    });

    // Calcule la disponibilité réelle de chaque produit :
    //  - dispo=0 en base (rupture manuelle)  -> indisponible
    //  - OU un ingrédient clé en rupture       -> indisponible
    produits.forEach((p) => {
      p.disponible = (p.dispo === 1) && !ingredientManquant[p.id];
    });

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
