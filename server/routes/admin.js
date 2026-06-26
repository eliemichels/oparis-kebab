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

// =============================================================
//  GESTION DES PRODUITS (ajout / modification / suppression)
// =============================================================

// GET /api/admin/categories -> liste des catégories (pour le formulaire)
router.get("/categories", async (req, res) => {
  try {
    const [cats] = await pool.query(
      "SELECT id, nom FROM categories ORDER BY ordre"
    );
    res.json(cats);
  } catch (e) {
    res.status(500).json({ erreur: "Erreur catégories." });
  }
});

// GET /api/admin/produits -> tous les produits (même indisponibles), avec leur catégorie
router.get("/produits", async (req, res) => {
  try {
    const [produits] = await pool.query(
      `SELECT p.id, p.categorie_id, c.nom AS categorie_nom, p.nom, p.description,
              p.prix_seul, p.prix_menu, p.prix_classic, p.prix_maxi,
              p.allergenes, p.dispo, p.ordre
         FROM produits p
         JOIN categories c ON c.id = p.categorie_id
        ORDER BY p.categorie_id, p.ordre`
    );
    res.json(produits);
  } catch (e) {
    res.status(500).json({ erreur: "Erreur liste produits." });
  }
});

// Petite aide : convertit "" ou undefined en NULL, sinon en nombre
function prixOuNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

// POST /api/admin/produits -> ajouter un produit
router.post("/produits", async (req, res) => {
  const b = req.body || {};
  if (!b.categorie_id || !b.nom) {
    return res.status(400).json({ erreur: "Catégorie et nom obligatoires." });
  }
  try {
    const [r] = await pool.query(
      `INSERT INTO produits
         (categorie_id, nom, description, prix_seul, prix_menu, prix_classic, prix_maxi, allergenes, dispo, ordre)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.categorie_id,
        b.nom,
        b.description || null,
        prixOuNull(b.prix_seul),
        prixOuNull(b.prix_menu),
        prixOuNull(b.prix_classic),
        prixOuNull(b.prix_maxi),
        b.allergenes || "",
        b.dispo === 0 || b.dispo === false ? 0 : 1,
        parseInt(b.ordre, 10) || 0,
      ]
    );
    res.status(201).json({ ok: true, id: r.insertId });
  } catch (e) {
    console.error("Erreur ajout produit :", e.message);
    res.status(500).json({ erreur: "Erreur ajout produit." });
  }
});

// PUT /api/admin/produits/:id -> modifier un produit
router.put("/produits/:id", async (req, res) => {
  const b = req.body || {};
  if (!b.categorie_id || !b.nom) {
    return res.status(400).json({ erreur: "Catégorie et nom obligatoires." });
  }
  try {
    await pool.query(
      `UPDATE produits SET
         categorie_id = ?, nom = ?, description = ?,
         prix_seul = ?, prix_menu = ?, prix_classic = ?, prix_maxi = ?,
         allergenes = ?, ordre = ?
       WHERE id = ?`,
      [
        b.categorie_id,
        b.nom,
        b.description || null,
        prixOuNull(b.prix_seul),
        prixOuNull(b.prix_menu),
        prixOuNull(b.prix_classic),
        prixOuNull(b.prix_maxi),
        b.allergenes || "",
        parseInt(b.ordre, 10) || 0,
        req.params.id,
      ]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("Erreur modif produit :", e.message);
    res.status(500).json({ erreur: "Erreur modification produit." });
  }
});

// DELETE /api/admin/produits/:id -> supprimer un produit
router.delete("/produits/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM produits WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error("Erreur suppression produit :", e.message);
    res.status(500).json({ erreur: "Erreur suppression produit." });
  }
});

// =============================================================
//  INGRÉDIENTS CLÉS (un produit "meurt" si un de ses ingrédients
//  clés est en rupture). Liaison produit <-> options_choix.
// =============================================================

// GET /api/admin/ingredients-cles -> { produit_id: [option_id, ...] }
router.get("/ingredients-cles", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT produit_id, option_id FROM produit_ingredients"
    );
    const map = {};
    rows.forEach((r) => {
      if (!map[r.produit_id]) map[r.produit_id] = [];
      map[r.produit_id].push(r.option_id);
    });
    res.json(map);
  } catch (e) {
    res.status(500).json({ erreur: "Erreur ingrédients clés." });
  }
});

// PUT /api/admin/produits/:id/ingredients-cles  { option_ids: [..] }
// Remplace l'ensemble des ingrédients clés d'un produit.
router.put("/produits/:id/ingredients-cles", async (req, res) => {
  const produitId = req.params.id;
  const ids = Array.isArray(req.body.option_ids) ? req.body.option_ids : [];
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM produit_ingredients WHERE produit_id = ?", [produitId]);
    for (const optId of ids) {
      await conn.query(
        "INSERT IGNORE INTO produit_ingredients (produit_id, option_id) VALUES (?, ?)",
        [produitId, optId]
      );
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    console.error("Erreur maj ingrédients clés :", e.message);
    res.status(500).json({ erreur: "Erreur enregistrement ingrédients clés." });
  } finally {
    conn.release();
  }
});

module.exports = router;
