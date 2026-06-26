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

      // Prix de base selon la formule choisie
      let base = 0;
      switch (it.formule) {
        case "Menu":    base = p.prix_menu; break;
        case "Maxi":    base = p.prix_maxi; break;
        case "Classic": base = p.prix_classic; break;
        default:        base = p.prix_seul ?? p.prix_classic; break;
      }
      base = Number(base) || 0;

      // Surcoût des options (vérifié en BDD, pas via le client)
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
        surcout += Number(orow[0].prix) || 0;
        optionsValides.push(orow[0]);
        compteParType[orow[0].type] = (compteParType[orow[0].type] || 0) + 1;
      }

      // VALIDATION SERVEUR des minimums/maximums (sécurité : on ne se fie
      // pas au JS du navigateur). On relit les règles du produit en base.
      const [regles] = await conn.query(
        "SELECT type, min_choix, max_choix FROM produit_options WHERE produit_id = ?",
        [it.produit_id]
      );
      for (const regle of regles) {
        const n = compteParType[regle.type] || 0;
        // La boisson n'est obligatoire que pour une formule Menu
        let min = regle.min_choix;
        if (regle.type === "boisson_menu") min = it.formule === "Menu" ? 1 : 0;
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
      const resume = optionsValides
        .map((o) => o.nom)
        .concat(it.retraits || []) // ex "sans tomate"
        .join(", ");

      lignesPretes.push({
        nom: p.nom,
        formule: it.formule || null,
        prixUnitaire,
        qte,
        resume,
        options: optionsValides,
      });
    }

    // 2. Insertion de la commande
    const numero = genererNumero();
    const [cmd] = await conn.query(
      `INSERT INTO commandes (numero, client_nom, client_tel, mode_retrait, heure_retrait, total)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        numero,
        client.nom,
        client.tel,
        client.mode === "sur_place" ? "sur_place" : "a_emporter",
        client.heure || null,
        total.toFixed(2),
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
