// =============================================================
//  routes/commandes.js — Création des commandes (client, public)
//  Pas de paiement en ligne. La commande est horodatée, reçoit un
//  numéro unique, et le total est recalculé côté serveur (sécurité :
//  on ne fait pas confiance au prix envoyé par le navigateur).
// =============================================================
const express = require("express");
const router = express.Router();
const pool = require("../db");

// Génère un numéro lisible : AAAAMMJJ-XXXX
function genererNumero() {
  const d = new Date();
  const j = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rnd = String(Math.floor(1000 + Math.random() * 9000));
  return `${j}-${rnd}`;
}

// Vérifie la coupure de commande (aucune commande après 21h45)
async function commandeAutorisee() {
  const [rows] = await pool.query(
    "SELECT valeur FROM parametres WHERE cle = 'heure_limite_commande'"
  );
  const limite = (rows[0] && rows[0].valeur) || "21:45";
  const [h, m] = limite.split(":").map(Number);
  const now = new Date();
  const apresLimite =
    now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
  // Fermé le lundi (getDay() === 1) ou avant 11h
  const ferme = now.getDay() === 1 || now.getHours() < 11;
  return !apresLimite && !ferme;
}

// POST /api/commandes
// Corps attendu :
// { client:{nom,tel,mode,heure}, items:[{produit_id, nom, formule, options:[{type,nom,prix,id}], quantite}] }
router.post("/commandes", async (req, res) => {
  const { client, items } = req.body || {};

  // --- Validations de base ---
  if (!client || !client.nom || !client.tel) {
    return res.status(400).json({ erreur: "Nom et téléphone obligatoires." });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ erreur: "Panier vide." });
  }
  if (!(await commandeAutorisee())) {
    return res.status(403).json({
      erreur:
        "Les commandes sont fermées pour le moment (service 11h–21h45, fermé le lundi).",
    });
  }

  // --- Transaction : tout réussit ou rien n'est écrit ---
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Recalcul du total côté serveur à partir de la BDD
    let total = 0;
    const lignesPretes = [];

    for (const it of items) {
      const [prow] = await conn.query(
        "SELECT nom, prix_seul, prix_menu, prix_classic, prix_maxi, dispo FROM produits WHERE id = ?",
        [it.produit_id]
      );
      if (!prow.length || prow[0].dispo !== 1) {
        throw new Error(`Produit indisponible (id ${it.produit_id}).`);
      }
      const p = prow[0];

      // Vérifie qu'aucun ingrédient CLÉ du produit n'est en rupture
      const [clesRupture] = await conn.query(
        `SELECT oc.nom
           FROM produit_ingredients pi
           JOIN options_choix oc ON oc.id = pi.option_id
          WHERE pi.produit_id = ? AND oc.dispo <> 1`,
        [it.produit_id]
      );
      if (clesRupture.length) {
        throw new Error(`${p.nom} indisponible (rupture : ${clesRupture[0].nom}).`);
      }

      // Compte les boissons (système menu)
      const nbBoissons = (it.options || []).filter(function (o) {
        return o.type === "boisson_menu";
      }).length;
      const peutMenu = (p.prix_seul != null && p.prix_menu != null);
      const estMenu = peutMenu && nbBoissons >= 1;

      // Prix de base : si au moins 1 boisson -> prix menu, sinon seul/taille
      let base = 0;
      if (estMenu) {
        base = p.prix_menu;
      } else if (it.formule === "Maxi") {
        base = p.prix_maxi;
      } else if (it.formule === "Classic") {
        base = p.prix_classic;
      } else {
        base = p.prix_seul ?? p.prix_classic;
      }
      base = Number(base) || 0;

      // Surcoût des options (revérifié en BDD)
      let surcout = 0;
      const optionsValides = [];
      const compteParType = {};
      for (const o of it.options || []) {
        if (!o.id) continue;
        const [orow] = await conn.query(
          "SELECT nom, type, prix, dispo FROM options_choix WHERE id = ?",
          [o.id]
        );
        if (!orow.length || orow[0].dispo !== 1) {
          throw new Error(`Option indisponible : ${o.nom || o.id}`);
        }
        // La boisson_menu : prix géré à part (1ère incluse, +1,50 les suivantes)
        if (orow[0].type !== "boisson_menu") {
          surcout += Number(orow[0].prix) || 0;
        }
        optionsValides.push(orow[0]);
        compteParType[orow[0].type] = (compteParType[orow[0].type] || 0) + 1;
      }
      // Boissons supplémentaires : +1,50 € chacune au-delà de la 1ère
      if (nbBoissons > 1) surcout += (nbBoissons - 1) * 1.5;

      // VALIDATION SERVEUR des minimums/maximums (sécurité).
      const [regles] = await conn.query(
        "SELECT type, min_choix, max_choix FROM produit_options WHERE produit_id = ?",
        [it.produit_id]
      );
      for (const regle of regles) {
        const n = compteParType[regle.type] || 0;
        // La boisson est toujours optionnelle (min 0)
        const min = regle.type === "boisson_menu" ? 0 : regle.min_choix;
        if (n < min) {
          throw new Error(`${p.nom} : il manque des choix (${regle.type}).`);
        }
        if (n > regle.max_choix) {
          throw new Error(`${p.nom} : trop de choix (${regle.type}).`);
        }
      }

      const qte = Math.max(1, parseInt(it.quantite, 10) || 1);
      const prixUnitaire = base + surcout;
      total += prixUnitaire * qte;

      // Résumé lisible des personnalisations
      const resume = (estMenu ? ["Menu (frites incluses)"] : [])
        .concat(optionsValides.map((o) => o.nom))
        .concat(it.retraits || [])
        .join(", ");

      lignesPretes.push({
        nom: p.nom,
        formule: estMenu ? "Menu" : (it.formule || null),
        prixUnitaire,
        qte,
        resume,
        options: optionsValides,
      });
    }

    // 2. Insertion de la commande
    const numero = genererNumero();
    const [cmd] = await conn.query(
      `INSERT INTO commandes (numero, client_nom, client_tel, mode_retrait, heure_retrait, total, commentaire)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        numero,
        client.nom,
        client.tel,
        client.mode === "sur_place" ? "sur_place" : "a_emporter",
        client.heure || null,
        total.toFixed(2),
        (client.commentaire || "").slice(0, 500) || null,
      ]
    );
    const commandeId = cmd.insertId;

    // 3. Lignes + options
    for (const l of lignesPretes) {
      const [item] = await conn.query(
        `INSERT INTO commande_items (commande_id, produit_nom, formule, prix_unitaire, quantite, personnalisation)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [commandeId, l.nom, l.formule, l.prixUnitaire.toFixed(2), l.qte, l.resume || null]
      );
      for (const o of l.options) {
        await conn.query(
          "INSERT INTO commande_item_options (item_id, type, nom, prix) VALUES (?, ?, ?, ?)",
          [item.insertId, o.type, o.nom, Number(o.prix).toFixed(2)]
        );
      }
    }

    await conn.commit();
    res.status(201).json({
      ok: true,
      numero,
      total: total.toFixed(2),
      message: "Commande enregistrée. Paiement sur place (carte ou espèces) au retrait.",
    });
  } catch (e) {
    await conn.rollback();
    console.error("Erreur POST /commandes :", e.message);
    res.status(400).json({ erreur: e.message || "Commande refusée." });
  } finally {
    conn.release();
  }
});

module.exports = router;
