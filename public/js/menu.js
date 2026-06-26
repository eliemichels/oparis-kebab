// =============================================================
//  menu.js — Page menu O Paris Kebab
//  Charge le menu via l'API, affiche les produits par catégorie,
//  gère le configurateur dépliant, le panier (tiroir) et la commande.
// =============================================================
(function () {
  "use strict";

  // --- État global ---
  var DATA = null;          // { categories, produits, options, regles }
  var PANIER = [];          // lignes ajoutées par le client
  var euros = function (n) { return (Math.round(n * 100) / 100).toFixed(2).replace(".", ",") + " €"; };

  // --- Éléments ---
  var elContenu = document.getElementById("menuContenu");
  var elCats = document.getElementById("catsBar");
  var elDelai = document.getElementById("menuDelai");

  // ---------------------------------------------------------
  //  1. CHARGEMENT DU MENU + PARAMÈTRES
  // ---------------------------------------------------------
  function charger() {
    fetch("/api/menu")
      .then(function (r) { if (!r.ok) throw new Error("Réponse " + r.status); return r.json(); })
      .then(function (data) {
        DATA = data;
        afficherCats();
        afficherProduits();
      })
      .catch(function (e) {
        elContenu.innerHTML =
          '<p class="menu-loading">Impossible de charger le menu. Vérifiez que le serveur est démarré.<br><small>' +
          e.message + "</small></p>";
      });

    // Message de délai (indicatif)
    fetch("/api/parametres")
      .then(function (r) { return r.json(); })
      .then(function (p) {
        if (p.message_delai) {
          elDelai.textContent = p.message_delai + " · Paiement sur place au retrait.";
        }
      })
      .catch(function () {});
  }

  // ---------------------------------------------------------
  //  2. ONGLETS CATÉGORIES
  // ---------------------------------------------------------
  function afficherCats() {
    elCats.innerHTML = "";
    DATA.categories.forEach(function (c, i) {
      var b = document.createElement("button");
      b.className = "cat-tab" + (i === 0 ? " actif" : "");
      b.textContent = c.nom;
      b.addEventListener("click", function () {
        document.querySelectorAll(".cat-tab").forEach(function (t) { t.classList.remove("actif"); });
        b.classList.add("actif");
        var cible = document.getElementById("cat-" + c.id);
        if (cible) cible.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      elCats.appendChild(b);
    });
  }

  // ---------------------------------------------------------
  //  3. AFFICHAGE DES PRODUITS PAR CATÉGORIE
  // ---------------------------------------------------------
  function afficherProduits() {
    elContenu.innerHTML = "";
    DATA.categories.forEach(function (cat) {
      var produits = DATA.produits.filter(function (p) { return p.categorie_id === cat.id; });
      if (!produits.length) return;

      var bloc = document.createElement("section");
      bloc.className = "cat-bloc";
      bloc.id = "cat-" + cat.id;
      bloc.innerHTML = "<h2>" + cat.nom + "</h2>";

      var grid = document.createElement("div");
      grid.className = "prod-grid";
      produits.forEach(function (p) { grid.appendChild(carteProduit(p)); });
      bloc.appendChild(grid);
      elContenu.appendChild(bloc);
    });
  }

  // Renvoie le prix d'affichage de base (le plus bas pertinent)
  function prixBase(p) {
    if (p.prix_seul != null) return Number(p.prix_seul);
    if (p.prix_classic != null) return Number(p.prix_classic);
    if (p.prix_menu != null) return Number(p.prix_menu);
    if (p.prix_maxi != null) return Number(p.prix_maxi);
    return 0;
  }

  // Une carte produit avec son configurateur replié
  function carteProduit(p) {
    var carte = document.createElement("article");
    carte.className = "prod";

    // Le produit a-t-il des options à configurer ?
    var regles = DATA.regles.filter(function (r) { return r.produit_id === p.id; });
    var aOptions = regles.length > 0 || (p.prix_classic != null && p.prix_maxi != null);

    var head = document.createElement("div");
    head.className = "prod__head";
    head.innerHTML =
      '<div class="prod__info"><b>' + p.nom + "</b>" +
      (p.description ? "<span>" + p.description + "</span>" : "") +
      (aOptions ? '<span class="prod__toggle">Composer / commander ▾</span>' : "") +
      "</div>" +
      '<div class="prod__prix"><b>' + euros(prixBase(p)) + "</b>" +
      (aOptions ? "<small>dès</small>" : "") + "</div>";

    if (!aOptions) {
      // Produit simple (boisson, tiramisu…) : bouton Ajouter direct
      var add = document.createElement("button");
      add.className = "prod__adddirect";
      add.textContent = "Ajouter · " + euros(prixBase(p));
      add.addEventListener("click", function () {
        PANIER.push({
          produit_id: p.id, nom: p.nom, formule: null,
          options: [], retraits: [], quantite: 1,
          prix: prixBase(p), detail: "",
        });
        majPanier(); ouvrirTiroir();
      });
      carte.appendChild(head);
      carte.appendChild(add);
      return carte;
    }

    var config = document.createElement("div");
    config.className = "config";
    config.appendChild(construireConfig(p));

    head.addEventListener("click", function () {
      config.classList.toggle("ouvert");
    });

    carte.appendChild(head);
    carte.appendChild(config);
    return carte;
  }

  // ---------------------------------------------------------
  //  4. CONFIGURATEUR (selon les règles produit<->options)
  // ---------------------------------------------------------
  function construireConfig(p) {
    var box = document.createElement("div");

    // État de configuration de CE produit
    var etat = {
      formule: null,     // "Classic"/"Maxi" pour assiettes ; sinon null
      options: {},       // { type: [ {id,nom,prix} ] }
      retraits: [],      // ["Sans tomate", ...]
      qte: 1,
    };

    // Règles de ce produit
    var regles = DATA.regles.filter(function (r) { return r.produit_id === p.id; });
    var regleBoisson = regles.find(function (r) { return r.type === "boisson_menu"; });
    // "passe en menu" possible si prix_menu défini ET boisson autorisée
    var aMenu = (p.prix_seul != null && p.prix_menu != null && !!regleBoisson);
    box._aMenu = aMenu;

    // -- a) Taille Classic/Maxi (assiettes, tacos) --
    if (p.prix_classic != null && p.prix_maxi != null) {
      etat.formule = "Classic";
      box.appendChild(groupeTaille([["Classic", p.prix_classic], ["Maxi", p.prix_maxi]], etat, p, box));
    }

    // -- b) Options (viande, sauce, supplément) sauf boisson --
    regles.forEach(function (regle) {
      if (regle.type === "boisson_menu") return;
      var choix = DATA.options.filter(function (o) { return o.type === regle.type; });
      if (!choix.length) return;
      box.appendChild(groupeOptions(regle, choix, etat, p, box));
    });

    // -- c) Crudités à retirer : sandwichs(1), royal(4), burgers(6) --
    if (p.categorie_id === 1 || p.categorie_id === 4 || p.categorie_id === 6) {
      box.appendChild(groupeRetraits(etat, p, box));
    }

    // -- d) Boisson (système menu) : toujours visible si le produit l'autorise.
    //    Cliquer une boisson => passe au prix MENU (frites incluses).
    //    1ère boisson incluse, chaque boisson en plus = +1,50 €.
    if (regleBoisson) {
      var choixBoissons = DATA.options.filter(function (o) { return o.type === "boisson_menu"; });
      var grpBoisson = groupeBoisson(choixBoissons, etat, p, box);
      box.appendChild(grpBoisson);
    }

    // -- e) Zone message --
    var msg = document.createElement("p");
    msg.className = "config__msg";
    msg.hidden = true;
    box._msg = msg;
    box.appendChild(msg);

    // -- f) Pied : quantité + total + ajouter --
    box._etat = etat;
    box._produit = p;
    box.appendChild(piedConfig(etat, p, box));

    majTotal(etat, p, box);
    return box;
  }

  // Groupe TAILLE (Classic/Maxi) — pour assiettes & tacos
  function groupeTaille(formules, etat, p, box) {
    var g = document.createElement("div");
    g.className = "config__groupe";
    g.innerHTML = "<p>Taille</p>";
    var grid = document.createElement("div");
    grid.className = "opt-grid";
    formules.forEach(function (f, i) {
      var o = document.createElement("button");
      o.type = "button";
      o.className = "opt" + (i === 0 ? " actif" : "");
      o.innerHTML = f[0] + ' <span class="px">' + euros(Number(f[1])) + "</span>";
      o.addEventListener("click", function () {
        grid.querySelectorAll(".opt").forEach(function (x) { x.classList.remove("actif"); });
        o.classList.add("actif");
        etat.formule = f[0];
        majTotal(etat, p, box);
      });
      grid.appendChild(o);
    });
    g.appendChild(grid);
    return g;
  }

  // Groupe BOISSON (système menu : 1 incluse, +1,50 € par boisson sup.)
  function groupeBoisson(choix, etat, p, box) {
    etat.options["boisson_menu"] = [];
    var g = document.createElement("div");
    g.className = "config__groupe";
    var hint = box_aMenu(p)
      ? "(1 boisson = menu, frites incluses · boisson en + : +1,50 €)"
      : "(+1,50 € par boisson)";
    g.innerHTML = '<p>Boisson <span class="hint">' + hint + "</span></p>";
    var grid = document.createElement("div");
    grid.className = "opt-grid";
    choix.forEach(function (c) {
      var o = document.createElement("div");
      o.className = "opt opt--boisson";
      o.dataset.nom = c.nom;
      o.innerHTML =
        '<button type="button" class="bm-moins" aria-label="Retirer" style="display:none">−</button>' +
        '<span class="bm-nom">' + c.nom + "</span>" +
        '<span class="bm-qte" style="display:none"></span>' +
        '<button type="button" class="bm-plus" aria-label="Ajouter">+</button>';

      // + : ajoute une unité ; clic sur le nom aussi
      function ajoute() {
        etat.options["boisson_menu"].push(c);
        majBoissonUI(grid, etat); majTotal(etat, p, box);
      }
      function retire() {
        retirerBoisson(etat, c);
        majBoissonUI(grid, etat); majTotal(etat, p, box);
      }
      o.querySelector(".bm-plus").addEventListener("click", function (e) { e.stopPropagation(); ajoute(); });
      o.querySelector(".bm-moins").addEventListener("click", function (e) { e.stopPropagation(); retire(); });
      o.querySelector(".bm-nom").addEventListener("click", ajoute);

      grid.appendChild(o);
    });
    g.appendChild(grid);
    box._grpBoissonGrid = grid;
    return g;
  }

  function retirerBoisson(etat, c) {
    var arr = etat.options["boisson_menu"];
    var idx = arr.findIndex(function (x) { return x.nom === c.nom; });
    if (idx >= 0) arr.splice(idx, 1);
  }

  // Met à jour l'affichage des boissons (compteur + boutons −/+)
  function majBoissonUI(grid, etat) {
    var arr = etat.options["boisson_menu"];
    grid.querySelectorAll(".opt--boisson").forEach(function (o) {
      var nom = o.dataset.nom;
      var n = arr.filter(function (x) { return x.nom === nom; }).length;
      var badge = o.querySelector(".bm-qte");
      var moins = o.querySelector(".bm-moins");
      if (n > 0) {
        o.classList.add("actif");
        badge.style.display = "";
        badge.textContent = "×" + n;
        moins.style.display = "";
      } else {
        o.classList.remove("actif");
        badge.style.display = "none";
        moins.style.display = "none";
      }
    });
  }

  // Groupe OPTIONS (viande/sauce/supplement) avec min/max
  function groupeOptions(regle, choix, etat, p, box) {
    etat.options[regle.type] = [];
    var labels = {
      viande: "Viande", sauce: "Sauce", supplement: "Suppléments",
      pain: "Pain", boisson_menu: "Boisson",
    };
    var g = document.createElement("div");
    g.className = "config__groupe";
    var hint;
    if (regle.min_choix === regle.max_choix && regle.min_choix > 0) {
      hint = "(choisissez-en " + regle.min_choix + ")";
    } else if (regle.max_choix > 1) {
      hint = "(de " + regle.min_choix + " à " + regle.max_choix + ")";
    } else {
      hint = (regle.min_choix > 0 ? "(obligatoire)" : "(optionnel)");
    }
    g.innerHTML = "<p>" + (labels[regle.type] || regle.type) +
      ' <span class="hint">' + hint + "</span></p>";

    var grid = document.createElement("div");
    grid.className = "opt-grid";

    choix.forEach(function (c, i) {
      var o = document.createElement("button");
      o.type = "button";
      o.className = "opt";
      o.innerHTML = c.nom + (Number(c.prix) > 0 ? ' <span class="px">+' + euros(Number(c.prix)) + "</span>" : "");
      // Pré-sélection du pain (1er choix) si obligatoire
      if (regle.type === "pain" && i === 0 && regle.min_choix >= 1) {
        o.classList.add("actif"); etat.options[regle.type].push(c);
      }
      o.addEventListener("click", function () {
        var sel = etat.options[regle.type];
        var idx = sel.findIndex(function (x) { return x.id === c.id; });
        if (idx >= 0) {
          sel.splice(idx, 1);
          o.classList.remove("actif");
        } else {
          if (regle.max_choix === 1) {
            sel.length = 0;
            grid.querySelectorAll(".opt").forEach(function (x) { x.classList.remove("actif"); });
          }
          if (sel.length < regle.max_choix) {
            sel.push(c);
            o.classList.add("actif");
          }
        }
        majTotal(etat, p, box);
      });
      grid.appendChild(o);
    });

    g.appendChild(grid);
    g._regle = regle;
    return g;
  }

  // Groupe RETRAITS (sans salade/tomate/oignon) — choix libre
  function groupeRetraits(etat, p, box) {
    var g = document.createElement("div");
    g.className = "config__groupe";
    g.innerHTML = '<p>Garniture <span class="hint">(retirez ce que vous voulez)</span></p>';
    var grid = document.createElement("div");
    grid.className = "opt-grid config__retraits";
    ["Sans salade", "Sans tomate", "Sans oignon"].forEach(function (txt) {
      var o = document.createElement("button");
      o.type = "button";
      o.className = "opt";
      o.textContent = txt;
      o.addEventListener("click", function () {
        var idx = etat.retraits.indexOf(txt);
        if (idx >= 0) { etat.retraits.splice(idx, 1); o.classList.remove("actif"); }
        else { etat.retraits.push(txt); o.classList.add("actif"); }
      });
      grid.appendChild(o);
    });
    g.appendChild(grid);
    return g;
  }

  // Pied : quantité, total live, bouton ajouter
  function piedConfig(etat, p, box) {
    var foot = document.createElement("div");
    foot.className = "config__foot";

    var qte = document.createElement("div");
    qte.className = "config__qte";
    qte.innerHTML = '<button type="button" class="moins">−</button><b class="val">1</b><button type="button" class="plus">+</button>';
    qte.querySelector(".moins").addEventListener("click", function () {
      etat.qte = Math.max(1, etat.qte - 1); qte.querySelector(".val").textContent = etat.qte; majTotal(etat, p, box);
    });
    qte.querySelector(".plus").addEventListener("click", function () {
      etat.qte = etat.qte + 1; qte.querySelector(".val").textContent = etat.qte; majTotal(etat, p, box);
    });

    var ajouter = document.createElement("button");
    ajouter.type = "button";
    ajouter.className = "config__ajouter";
    ajouter.textContent = "Ajouter";
    ajouter.addEventListener("click", function () {
      if (ajouter.disabled) return;
      ajouterAuPanier(etat, p, box);
    });

    foot.appendChild(qte);
    foot.appendChild(ajouter);
    box._btnAjouter = ajouter;
    return foot;
  }

  // ---------------------------------------------------------
  //  4 bis. VALIDATION des minimums (renvoie un message ou null)
  // ---------------------------------------------------------
  function verifierContraintes(etat, p, box) {
    var regles = DATA.regles.filter(function (r) { return r.produit_id === p.id; });
    var manques = [];
    regles.forEach(function (regle) {
      if (regle.type === "boisson_menu") return; // jamais obligatoire (optionnelle)
      var sel = etat.options[regle.type] || [];
      if (sel.length < regle.min_choix) {
        if (regle.type === "viande") manques.push("Choisissez " + regle.min_choix + " viande(s)");
        else if (regle.type === "sauce") manques.push("Choisissez au moins " + regle.min_choix + " sauce(s)");
        else manques.push("Il manque des choix (" + regle.type + ")");
      }
    });
    return manques.length ? manques.join(" · ") : null;
  }

  // Info "menu activé" quand au moins une boisson est choisie
  function suggestionMenu(etat, p, box) {
    if (!box._aMenu) return null;
    var b = (etat.options["boisson_menu"] || []).length;
    if (b >= 1) {
      return "✅ Menu activé : frites + boisson incluses (prix menu " + euros(Number(p.prix_menu)) + ")";
    }
    return null;
  }

  // ---------------------------------------------------------
  //  5. CALCUL DE PRIX + mise à jour du bouton/validation
  // ---------------------------------------------------------
  function calcPrix(etat, p) {
    var base;
    var nbBoissons = (etat.options["boisson_menu"] || []).length;

    if (box_aMenu(p) && nbBoissons >= 1) {
      // Au moins 1 boisson -> prix MENU (frites + 1 boisson incluses)
      base = Number(p.prix_menu);
    } else if (etat.formule === "Maxi") {
      base = Number(p.prix_maxi);
    } else if (etat.formule === "Classic") {
      base = Number(p.prix_classic);
    } else {
      base = p.prix_seul != null ? Number(p.prix_seul) : Number(p.prix_classic);
    }
    if (isNaN(base)) base = 0;

    var sup = 0;
    Object.keys(etat.options).forEach(function (type) {
      if (type === "boisson_menu") {
        var nb = etat.options[type].length;
        if (box_aMenu(p)) {
          // Produit "menu" (sandwich…) : 1ère incluse, +1,50 € les suivantes
          sup += Math.max(0, nb - 1) * 1.5;
        } else {
          // Tacos/assiettes (pas de prix menu) : +1,50 € par boisson, dès la 1ère
          sup += nb * 1.5;
        }
      } else {
        etat.options[type].forEach(function (o) { sup += Number(o.prix) || 0; });
      }
    });
    return (base + sup) * etat.qte;
  }

  // Le produit peut-il passer en menu ? (prix_menu + boisson autorisée)
  function box_aMenu(p) {
    if (p.prix_seul == null || p.prix_menu == null) return false;
    return DATA.regles.some(function (r) { return r.produit_id === p.id && r.type === "boisson_menu"; });
  }

  function majTotal(etat, p, box) {
    var prix = calcPrix(etat, p);
    var manque = verifierContraintes(etat, p, box);
    var suggestion = suggestionMenu(etat, p, box);
    var btn = box._btnAjouter;
    var msg = box._msg;

    if (manque) {
      btn.disabled = true;
      btn.textContent = "Compléter les choix";
      msg.hidden = false; msg.className = "config__msg config__msg--err"; msg.textContent = manque;
    } else {
      btn.disabled = false;
      btn.textContent = "Ajouter · " + euros(prix);
      if (suggestion) {
        msg.hidden = false; msg.className = "config__msg config__msg--info"; msg.textContent = suggestion;
      } else {
        msg.hidden = true;
      }
    }
  }

  // ---------------------------------------------------------
  //  6. PANIER
  // ---------------------------------------------------------
  function ajouterAuPanier(etat, p, box) {
    var nbBoissons = (etat.options["boisson_menu"] || []).length;
    var estMenu = box_aMenu(p) && nbBoissons >= 1;

    // Résumé lisible des choix
    var details = [];
    if (estMenu) details.push("Menu (frites incluses)");
    if (etat.formule === "Maxi") details.push("Maxi");
    // viandes / sauces / suppléments
    ["viande", "sauce", "supplement"].forEach(function (type) {
      (etat.options[type] || []).forEach(function (o) { details.push(o.nom); });
    });
    // boissons (avec compte)
    if (nbBoissons) {
      var compte = {};
      etat.options["boisson_menu"].forEach(function (o) { compte[o.nom] = (compte[o.nom] || 0) + 1; });
      Object.keys(compte).forEach(function (nom) {
        details.push(compte[nom] > 1 ? nom + " ×" + compte[nom] : nom);
      });
    }
    etat.retraits.forEach(function (r) { details.push(r); });

    // Options à plat pour l'envoi serveur
    var optionsPlates = [];
    Object.keys(etat.options).forEach(function (type) {
      etat.options[type].forEach(function (o) {
        optionsPlates.push({ id: o.id, nom: o.nom, type: type, prix: Number(o.prix) });
      });
    });

    PANIER.push({
      produit_id: p.id,
      nom: p.nom,
      formule: estMenu ? "Menu" : etat.formule,
      options: optionsPlates,
      retraits: etat.retraits.slice(),
      quantite: etat.qte,
      prix: calcPrix(etat, p),
      detail: details.join(", "),
    });

    majPanier();
    box.classList.remove("ouvert");        // referme le configurateur
    ouvrirTiroir();                         // montre le panier
  }

  function majPanier() {
    var items = document.getElementById("panierItems");
    var total = 0, compte = 0;
    if (!PANIER.length) {
      items.innerHTML = '<p class="panier-vide">Votre panier est vide.</p>';
    } else {
      items.innerHTML = "";
      PANIER.forEach(function (ligne, i) {
        total += ligne.prix; compte += ligne.quantite;
        var d = document.createElement("div");
        d.className = "pitem";
        d.innerHTML =
          '<div class="pitem__top"><b>' + ligne.quantite + "× " + ligne.nom +
          '</b><span class="pitem__prix">' + euros(ligne.prix) + "</span></div>" +
          (ligne.detail ? '<div class="pitem__detail">' + ligne.detail + "</div>" : "") +
          '<button class="pitem__sup" data-i="' + i + '">Retirer</button>';
        items.appendChild(d);
      });
      items.querySelectorAll(".pitem__sup").forEach(function (b) {
        b.addEventListener("click", function () {
          PANIER.splice(Number(b.dataset.i), 1); majPanier();
        });
      });
    }
    document.getElementById("panierTotal").textContent = euros(total);
    document.getElementById("panierCompte").textContent = compte;
    var elArt = document.getElementById("panierArticles");
    if (elArt) elArt.textContent = compte + (compte > 1 ? " articles" : " article");
    document.getElementById("allerCommande").disabled = PANIER.length === 0;
  }

  // Bouton "Vider le panier"
  var btnVider = document.getElementById("viderPanier");
  if (btnVider) btnVider.addEventListener("click", function () {
    if (PANIER.length && confirm("Vider tout le panier ?")) { PANIER = []; majPanier(); }
  });

  // ---------------------------------------------------------
  //  7. TIROIR PANIER (ouverture / fermeture)
  // ---------------------------------------------------------
  var drawer = document.getElementById("drawer");
  var overlay = document.getElementById("drawerOverlay");
  function ouvrirTiroir() { drawer.classList.add("ouvert"); overlay.hidden = false; drawer.setAttribute("aria-hidden", "false"); }
  function fermerTiroir() { drawer.classList.remove("ouvert"); overlay.hidden = true; drawer.setAttribute("aria-hidden", "true"); }
  document.getElementById("ouvrirPanier").addEventListener("click", ouvrirTiroir);
  document.getElementById("fermerPanier").addEventListener("click", fermerTiroir);
  overlay.addEventListener("click", fermerTiroir);

  // ---------------------------------------------------------
  //  8. TUNNEL DE COMMANDE
  // ---------------------------------------------------------
  var cmdOverlay = document.getElementById("commandeOverlay");
  document.getElementById("allerCommande").addEventListener("click", function () {
    if (!PANIER.length) return;
    cmdOverlay.hidden = false;
    document.getElementById("commandeForm").hidden = false;
    document.getElementById("commandeSucces").hidden = true;
  });
  document.getElementById("fermerCommande").addEventListener("click", function () { cmdOverlay.hidden = true; });
  cmdOverlay.addEventListener("click", function (e) { if (e.target === cmdOverlay) cmdOverlay.hidden = true; });

  document.getElementById("envoyerCommande").addEventListener("click", function () {
    var nom = document.getElementById("clientNom").value.trim();
    var tel = document.getElementById("clientTel").value.trim();
    var mode = document.getElementById("clientMode").value;
    var heure = document.getElementById("clientHeure").value;
    var commentaire = (document.getElementById("clientCommentaire") || {}).value || "";
    var err = document.getElementById("commandeErreur");

    if (nom.length < 2 || tel.length < 6) {
      err.hidden = false; err.textContent = "Merci d'indiquer un nom et un téléphone valides.";
      return;
    }
    err.hidden = true;
    this.disabled = true; this.textContent = "Envoi…";

    var self = this;
    fetch("/api/commandes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: { nom: nom, tel: tel, mode: mode, heure: heure, commentaire: commentaire },
        items: PANIER,
      }),
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        self.disabled = false; self.textContent = "Confirmer la commande";
        if (!res.ok) {
          err.hidden = false; err.textContent = res.j.erreur || "Commande refusée.";
          return;
        }
        // Succès
        document.getElementById("commandeForm").hidden = true;
        var s = document.getElementById("commandeSucces");
        s.hidden = false;
        s.innerHTML =
          '<div class="succes"><div class="succes__ico">✓</div>' +
          "<h3>Commande reçue !</h3>" +
          '<div class="num">N° ' + res.j.numero + "</div>" +
          "<p>" + res.j.message + "</p>" +
          '<p><b>Total à régler sur place : ' + euros(Number(res.j.total)) + "</b></p></div>";
        PANIER = []; majPanier();
      })
      .catch(function () {
        self.disabled = false; self.textContent = "Confirmer la commande";
        err.hidden = false; err.textContent = "Erreur réseau. Réessayez.";
      });
  });

  // --- Go ---
  charger();
})();
