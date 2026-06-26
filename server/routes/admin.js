// =============================================================
//  routes/admin.js — Back-office gérant (protégé par code)
//  Accès simple : un code d'accès passé dans l'en-tête "x-code-admin".
//  Fonctions : liste des commandes, détail, changement de statut,
//  rupture de stock (en cascade), récap du jour.
// =============================================================
const express = require("express");
const router = express.Router();
const pool = require("../db");

// --- Middleware : vérifie le code admin sur toutes les routes /admin ---
router.use(async (req, res, next) => {
  try {
    const code = req.get("x-code-admin");
    const [rows] = await pool.query(
      "SELECT valeur FROM parametres WHERE cle = 'code_admin'"
    );
    const attendu = rows[0] && rows[0].valeur;
    if (!code || code !== attendu) {
      return res.status(401).json({ erreur: "Code d'accès invalide." });
    }
    next();
  } catch (e) {
    res.status(500).json({ erreur: "Erreur d'authentification." });
  }
});

// GET /api/admin/commandes -> commandes du jour, triées par heure
router.get("/commandes", async (req, res) => {
  try {
    const [cmds] = await pool.query(
      `SELECT id, numero, client_nom, client_tel, mode_retrait,
              heure_retrait, total, statut, cree_le
         FROM commandes
        WHERE DATE(cree_le) = CURDATE()
        ORDER BY cree_le DESC`
    );
    res.json(cmds);
  } catch (e) {
    res.status(500).json({ erreur: "Erreur liste commandes." });
  }
});

// GET /api/admin/commandes/:id -> détail complet d'une commande
router.get("/commandes/:id", async (req, res) => {
  try {
    const [[cmd]] = await pool.query("SELECT * FROM commandes WHERE id = ?", [req.params.id]);
    if (!cmd) return res.status(404).json({ erreur: "Commande introuvable." });

    const [items] = await pool.query(
      "SELECT id, produit_nom, formule, prix_unitaire, quantite, personnalisation FROM commande_items WHERE commande_id = ?",
      [req.params.id]
    );
    for (const it of items) {
      const [opts] = await pool.query(
        "SELECT type, nom, prix FROM commande_item_options WHERE item_id = ?",
        [it.id]
      );
      it.options = opts;
    }
    res.json({ ...cmd, items });
  } catch (e) {
    res.status(500).json({ erreur: "Erreur détail commande." });
  }
});

// PUT /api/admin/commandes/:id/statut  { statut }
router.put("/commandes/:id/statut", async (req, res) => {
  const valides = ["nouvelle", "en_preparation", "prete", "recuperee"];
  if (!valides.includes(req.body.statut)) {
    return res.status(400).json({ erreur: "Statut invalide." });
  }
  try {
    await pool.query("UPDATE commandes SET statut = ? WHERE id = ?", [
      req.body.statut,
      req.params.id,
    ]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erreur: "Erreur mise à jour statut." });
  }
});

// GET /api/admin/jour -> récap du jour (nb commandes + total estimé)
router.get("/jour", async (req, res) => {
  try {
    const [[stat]] = await pool.query(
      `SELECT COUNT(*) AS nb, COALESCE(SUM(total),0) AS total_jour
         FROM commandes WHERE DATE(cree_le) = CURDATE()`
    );
    res.json(stat);
  } catch (e) {
    res.status(500).json({ erreur: "Erreur récap jour." });
  }
});

// --- Gestion de disponibilité (rupture de stock) ---

// GET /api/admin/disponibilites -> tout (produits + options) pour l'admin
router.get("/disponibilites", async (req, res) => {
  try {
    const [produits] = await pool.query(
      "SELECT id, nom, categorie_id, dispo FROM produits ORDER BY categorie_id, ordre"
    );
    const [options] = await pool.query(
      "SELECT id, type, nom, dispo FROM options_choix ORDER BY type, ordre"
    );
    res.json({ produits, options });
  } catch (e) {
    res.status(500).json({ erreur: "Erreur disponibilités." });
  }
});

// PUT /api/admin/produits/:id/dispo  { dispo: 0|1 }
router.put("/produits/:id/dispo", async (req, res) => {
  const dispo = req.body.dispo ? 1 : 0;
  try {
    await pool.query("UPDATE produits SET dispo = ? WHERE id = ?", [dispo, req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erreur: "Erreur mise à jour produit." });
  }
});

// PUT /api/admin/options/:id/dispo  { dispo: 0|1 }
// Désactiver un ingrédient (ex : poulet) masque automatiquement, côté
// client, tout ce qui en dépend : l'option viande "poulet" disparaît du
// configurateur (filtrée par dispo=1 dans /api/menu), donc les tacos/
// sandwichs ne la proposent plus. Pour les produits composés contenant
// l'ingrédient (ex : "Chicken Chika", "Le Chef"), on les passe aussi en
// rupture par correspondance de nom. Réversible en un clic.
router.put("/options/:id/dispo", async (req, res) => {
  const dispo = req.body.dispo ? 1 : 0;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. L'option elle-même
    const [[opt]] = await conn.query(
      "SELECT nom, type FROM options_choix WHERE id = ?",
      [req.params.id]
    );
    if (!opt) throw new Error("Option introuvable.");
    await conn.query("UPDATE options_choix SET dispo = ? WHERE id = ?", [dispo, req.params.id]);

    // 2. Cascade : produits composés dont le nom contient l'ingrédient
    //    (ex : ingrédient "Poulet" -> "Assiette Poulet", "Panini Poulet"...)
    //    On utilise le 1er mot significatif de l'option comme motif.
    const motCle = opt.nom.split(" ")[0]; // "Poulet", "Chicken", "Kebab"...
    if (motCle && motCle.length >= 3) {
      await conn.query(
        "UPDATE produits SET dispo = ? WHERE nom LIKE ?",
        [dispo, `%${motCle}%`]
      );
    }

    await conn.commit();
    res.json({ ok: true, ingredient: opt.nom, motCle });
  } catch (e) {
    await conn.rollback();
    console.error("Erreur cascade dispo :", e.message);
    res.status(500).json({ erreur: e.message });
  } finally {
    conn.release();
  }
});

// PUT /api/admin/allergenes/:id  { allergenes }
router.put("/allergenes/:id", async (req, res) => {
  try {
    await pool.query("UPDATE produits SET allergenes = ? WHERE id = ?", [
      String(req.body.allergenes || ""),
      req.params.id,
    ]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erreur: "Erreur allergènes." });
  }
});

module.exports = router;
