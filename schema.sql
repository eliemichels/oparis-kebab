-- =============================================================
--  O PARIS KEBAB — Schéma de base de données MariaDB
--  À exécuter dans phpMyAdmin ou :  mysql -u root -p < schema.sql
--  Encodage UTF-8 (accents, €) géré partout.
-- =============================================================

CREATE DATABASE IF NOT EXISTS oparis_kebab
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE oparis_kebab;

-- On repart propre si on relance le script (ordre = contraintes FK)
DROP TABLE IF EXISTS commande_item_options;
DROP TABLE IF EXISTS commande_items;
DROP TABLE IF EXISTS commandes;
DROP TABLE IF EXISTS produit_options;
DROP TABLE IF EXISTS options_choix;
DROP TABLE IF EXISTS produits;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS parametres;

-- -------------------------------------------------------------
--  1. CATÉGORIES  (Sandwichs, Assiettes, Tacos, etc.)
-- -------------------------------------------------------------
CREATE TABLE categories (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nom           VARCHAR(80)  NOT NULL,
  ordre         INT          NOT NULL DEFAULT 0,   -- ordre d'affichage
  actif         TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- -------------------------------------------------------------
--  2. PRODUITS
--  Un produit peut avoir jusqu'à 4 prix selon la logique du menu :
--    prix_seul / prix_menu        (sandwich seul vs menu frites+boisson)
--    prix_classic / prix_maxi     (assiettes, tacos : taille)
--  Les champs non utilisés restent NULL.
--  'allergenes' est vide par défaut : le gérant le remplira en admin.
--  'dispo' = disponibilité (0 = rupture de stock, masqué côté client).
-- -------------------------------------------------------------
CREATE TABLE produits (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  categorie_id  INT          NOT NULL,
  nom           VARCHAR(120) NOT NULL,
  description   VARCHAR(255) DEFAULT NULL,
  prix_seul     DECIMAL(5,2) DEFAULT NULL,
  prix_menu     DECIMAL(5,2) DEFAULT NULL,
  prix_classic  DECIMAL(5,2) DEFAULT NULL,
  prix_maxi     DECIMAL(5,2) DEFAULT NULL,
  allergenes    VARCHAR(255) NOT NULL DEFAULT '',
  dispo         TINYINT(1)   NOT NULL DEFAULT 1,
  ordre         INT          NOT NULL DEFAULT 0,
  CONSTRAINT fk_produit_cat FOREIGN KEY (categorie_id)
    REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -------------------------------------------------------------
--  3. CHOIX D'OPTIONS  (viandes, sauces, suppléments, boissons)
--  'type' regroupe les choix : 'viande', 'sauce', 'supplement', 'boisson'.
--  'prix' = surcoût (0 pour les sauces, 1.00–1.50 pour les suppléments,
--            prix de vente pour les boissons).
--  'dispo' permet de désactiver un ingrédient -> rupture en cascade.
-- -------------------------------------------------------------
CREATE TABLE options_choix (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  type          ENUM('viande','sauce','supplement','boisson','pain','boisson_menu') NOT NULL,
  nom           VARCHAR(80)  NOT NULL,
  prix          DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  dispo         TINYINT(1)   NOT NULL DEFAULT 1,
  ordre         INT          NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- -------------------------------------------------------------
--  4. LIAISON PRODUIT <-> OPTIONS
--  Quels groupes d'options sont proposés pour un produit donné, et
--  combien de choix (ex : tacos = 1 à 3 viandes ; sandwich = 1 viande).
-- -------------------------------------------------------------
CREATE TABLE produit_options (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  produit_id    INT NOT NULL,
  type          ENUM('viande','sauce','supplement','boisson','pain','boisson_menu') NOT NULL,
  min_choix     INT NOT NULL DEFAULT 0,
  max_choix     INT NOT NULL DEFAULT 1,
  CONSTRAINT fk_po_produit FOREIGN KEY (produit_id)
    REFERENCES produits(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -------------------------------------------------------------
--  5. COMMANDES
--  Pas de paiement en ligne : on enregistre nom, téléphone, mode et
--  heure de retrait. numero = identifiant lisible (ex : 20260617-0007).
--  statut suit le cycle de vie de la commande.
-- -------------------------------------------------------------
CREATE TABLE commandes (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  numero        VARCHAR(20)  NOT NULL UNIQUE,
  client_nom    VARCHAR(120) NOT NULL,
  client_tel    VARCHAR(20)  NOT NULL,
  mode_retrait  ENUM('sur_place','a_emporter') NOT NULL DEFAULT 'a_emporter',
  heure_retrait VARCHAR(10)  DEFAULT NULL,         -- ex "19:30"
  total         DECIMAL(7,2) NOT NULL DEFAULT 0.00,
  commentaire   VARCHAR(500) DEFAULT NULL,
  statut        ENUM('nouvelle','en_preparation','prete','recuperee') NOT NULL DEFAULT 'nouvelle',
  cree_le       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -------------------------------------------------------------
--  6. LIGNES DE COMMANDE
--  On fige le nom et le prix au moment de la commande (le menu peut
--  changer ensuite). 'personnalisation' = résumé lisible (sans tomate,
--  galette, etc.) ; le détail structuré est dans commande_item_options.
-- -------------------------------------------------------------
CREATE TABLE commande_items (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  commande_id      INT NOT NULL,
  produit_nom      VARCHAR(120) NOT NULL,
  formule          VARCHAR(40)  DEFAULT NULL,      -- "Menu" / "Seul" / "Maxi"...
  prix_unitaire    DECIMAL(6,2) NOT NULL,
  quantite         INT NOT NULL DEFAULT 1,
  personnalisation TEXT DEFAULT NULL,
  CONSTRAINT fk_item_commande FOREIGN KEY (commande_id)
    REFERENCES commandes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -------------------------------------------------------------
--  7. OPTIONS CHOISIES PAR LIGNE  (détail structuré : viandes, sauces…)
-- -------------------------------------------------------------
CREATE TABLE commande_item_options (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  item_id       INT NOT NULL,
  type          VARCHAR(20)  NOT NULL,
  nom           VARCHAR(80)  NOT NULL,
  prix          DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  CONSTRAINT fk_opt_item FOREIGN KEY (item_id)
    REFERENCES commande_items(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -------------------------------------------------------------
--  8. PARAMÈTRES  (code admin, message de délai, etc.)
-- -------------------------------------------------------------
CREATE TABLE parametres (
  cle           VARCHAR(50) PRIMARY KEY,
  valeur        VARCHAR(255) NOT NULL
) ENGINE=InnoDB;


-- =============================================================
--  DONNÉES INITIALES — menu réel O Paris Kebab
-- =============================================================

-- Catégories
INSERT INTO categories (id, nom, ordre) VALUES
  (1,'Sandwichs',1),
  (2,'Assiettes',2),
  (3,'Tacos',3),
  (4,'Sandwich Royal',4),
  (5,'Paninis',5),
  (6,'Burgers',6),
  (7,'Menu Kids',7),
  (8,'Boissons',8),
  (9,'Suppléments',9);

-- ---------- SANDWICHS (prix_seul / prix_menu) ----------
INSERT INTO produits (categorie_id,nom,description,prix_seul,prix_menu,ordre) VALUES
  (1,'Kebab','Servi avec salade, tomate, oignons, frites',6.50,8.00,1),
  (1,'Steak','Servi avec salade, tomate, oignons, frites',6.00,7.50,2),
  (1,'Chicken Chika','Servi avec salade, tomate, oignons, frites',7.00,8.50,3),
  (1,'Brochette de poulet','Servi avec salade, tomate, oignons, frites',7.00,8.50,4),
  (1,'Merguez','Servi avec salade, tomate, oignons, frites',6.50,8.00,5),
  (1,'Kefta','Servi avec salade, tomate, oignons, frites',6.50,8.00,6),
  (1,'Triple Steak','3 steaks 45g + fromage',7.00,8.50,7),
  (1,'Agneau','Servi avec salade, tomate, oignons, frites',8.00,9.50,8),
  (1,'Le Chef','Chicken + kefta + 2 fromages',9.50,11.00,9),
  (1,'S4','4 steaks 45g + œuf + 2 fromages',8.00,9.50,10),
  (1,'S5','5 steaks + œuf + 2 fromages',9.50,11.00,11);

-- ---------- ASSIETTES (prix_classic / prix_maxi) ----------
INSERT INTO produits (categorie_id,nom,description,prix_classic,prix_maxi,ordre) VALUES
  (2,'Assiette Kebab','Salade mixte, frites, blé maison',10.00,12.00,1),
  (2,'Assiette Poulet','Salade mixte, frites, blé maison',11.00,13.00,2),
  (2,'Assiette Agneau','Salade mixte, frites, blé maison',12.00,14.00,3),
  (2,'Assiette Steak','Salade mixte, frites, blé maison',10.00,12.00,4),
  (2,'Assiette Kefta','Salade mixte, frites, blé maison',10.00,12.00,5),
  (2,'Assiette Mixte','Salade mixte, frites, blé maison',14.00,16.00,6),
  (2,'Assiette Du Chef','Salade mixte, frites, blé maison',16.00,18.00,7);

-- ---------- TACOS (3 formats : 1 / 2 / 3 viandes, Classic/Maxi) ----------
-- Le nombre de viandes est imposé par le format (géré via produit_options).
-- Prix logiques (le gérant ajustera en admin).
INSERT INTO produits (categorie_id,nom,description,prix_classic,prix_maxi,ordre) VALUES
  (3,'Tacos 1 viande','Galette toastée, salade, tomate, oignon, fromage fondu, 1 viande',6.50,8.50,1),
  (3,'Tacos 2 viandes','Galette toastée, salade, tomate, oignon, fromage fondu, 2 viandes',7.50,9.50,2),
  (3,'Tacos 3 viandes','Galette toastée, salade, tomate, oignon, fromage fondu, 3 viandes',8.50,10.50,3);

-- ---------- SANDWICH ROYAL (prix_seul = prix Royal) ----------
INSERT INTO produits (categorie_id,nom,prix_seul,ordre) VALUES
  (4,'Royal Kefta',6.50,1),
  (4,'Royal Steak',6.50,2),
  (4,'Royal Poulet',7.00,3),
  (4,'Royal Chicken Steak',7.00,4),
  (4,'Royal Agneau',7.50,5),
  (4,'Royal Merguez',7.50,6);

-- ---------- PANINIS (prix_seul) ----------
INSERT INTO produits (categorie_id,nom,description,prix_seul,ordre) VALUES
  (5,'Panini Chef','Kebab + fromage',5.50,1),
  (5,'Panini Special','Kebab + kefta + fromage',5.50,2),
  (5,'Panini Kefta','Kefta + fromage',5.00,3),
  (5,'Panini Steak','Steak + fromage',5.00,4),
  (5,'Panini Merguez','Merguez + fromage',5.00,5),
  (5,'Panini Chicken Chika','Chicken + fromage',4.50,6),
  (5,'Panini Poulet','Salade, tomate, blanc de poulet, fromage',5.00,7),
  (5,'Panini Thon','Thon + fromage',5.00,8),
  (5,'Panini 3 Fromages','Trois fromages',4.50,9);

-- ---------- BURGERS (prix_seul / prix_menu quand "Menu") ----------
INSERT INTO produits (categorie_id,nom,description,prix_seul,prix_menu,ordre) VALUES
  (6,'Cheese','Salade, tomate, fromage, steak 100g',3.00,5.50,1),
  (6,'Chicken Steak','Salade, tomate, fromage, steak poulet 100g',3.50,6.00,2),
  (6,'Double Cheese','2 steaks 100g + 2 fromages',5.50,NULL,3),
  (6,'Double Chicken Steak','2 steaks poulet 100g + 2 fromages',5.50,NULL,4),
  (6,'Special Cheese','Cheese + œuf + frites',4.50,NULL,5),
  (6,'Royal Cheese','Steak haché poulet 100g + 2 fromages',6.50,NULL,6),
  (6,'Menu Nuggets','Nuggets + frites + boisson',6.00,NULL,7);

-- ---------- MENU KIDS ----------
INSERT INTO produits (categorie_id,nom,description,prix_seul,ordre) VALUES
  (7,'Menu Kids','Nuggets ou Cheese + frites + jouet + boisson',5.00,1),
  (7,'Menu 11','Nuggets, frites, boisson',NULL,2);

-- ---------- BOISSONS (canettes et bouteilles 50cl) ----------
INSERT INTO produits (categorie_id,nom,description,prix_seul,ordre) VALUES
  (8,'Coca-Cola','Canette 33cl',1.50,1),
  (8,'Coca-Cola Cherry','Canette 33cl',1.50,2),
  (8,'Coca-Cola Zero','Canette 33cl',1.50,3),
  (8,'Fanta Orange','Canette 33cl',1.50,4),
  (8,'7Up','Canette 33cl',1.50,5),
  (8,'7Up Cherry','Canette 33cl',1.50,6),
  (8,'Oasis Tropical','Canette 33cl',1.50,7),
  (8,'Oasis Pomme-Cassis','Canette 33cl',1.50,8),
  (8,'Lipton Ice Tea','Canette 33cl',1.50,9),
  (8,'Pepsi','Canette 33cl',1.50,10),
  (8,'Orangina','Canette 33cl',1.50,11),
  (8,'Boisson énergisante','Canette 25cl',2.00,12),
  (8,'Coca-Cola 50cl','Bouteille 50cl',2.50,13),
  (8,'Fanta 50cl','Bouteille 50cl',2.50,14),
  (8,'Oasis 50cl','Bouteille 50cl',2.50,15),
  (8,'Eau Cristalline 50cl','Bouteille eau plate 50cl',1.00,16),
  (8,'Eau gazeuse 50cl','Bouteille eau gazeuse 50cl',1.50,17);

-- ---------- SUPPLÉMENTS / DESSERTS (vendables seuls) ----------
INSERT INTO produits (categorie_id,nom,description,prix_seul,ordre) VALUES
  (9,'Tiramisu','Dessert maison',3.00,1);

-- =============================================================
--  OPTIONS  (viandes, sauces, suppléments payants, pains)
-- =============================================================

-- Viandes (pour tacos / sandwich / royal)
INSERT INTO options_choix (type,nom,prix,ordre) VALUES
  ('viande','Kebab',0,1),
  ('viande','Kefta',0,2),
  ('viande','Merguez',0,3),
  ('viande','Brochette de poulet',0,4),
  ('viande','Brochette d''agneau',0,5),
  ('viande','Chicken Chika',0,6),
  ('viande','Triple Steak',0,7),
  ('viande','Steak',0,8),
  ('viande','Poulet',0,9),
  ('viande','Agneau',0,10);

-- Sauces (le client en choisit 1 ou plusieurs ; surcoût 0)
INSERT INTO options_choix (type,nom,prix,ordre) VALUES
  ('sauce','Blanche',0,1),
  ('sauce','Algérienne',0,2),
  ('sauce','Harissa',0,3),
  ('sauce','Samouraï',0,4),
  ('sauce','Barbecue',0,5),
  ('sauce','Ketchup',0,6),
  ('sauce','Mayonnaise',0,7),
  ('sauce','Andalouse',0,8),
  ('sauce','Biggy Burger',0,9);

-- Suppléments payants
INSERT INTO options_choix (type,nom,prix,ordre) VALUES
  ('supplement','Frites',2.50,1),
  ('supplement','Extra fromage',1.00,2),
  ('supplement','Extra viande',1.50,3),
  ('supplement','Œuf',1.00,4),
  ('supplement','Oignons frits',1.00,5),
  ('supplement','Cheddar',1.00,6),
  ('supplement','Tiramisu',1.50,7);

-- Boissons incluses dans un MENU (le client en choisit une, surcoût 0)
INSERT INTO options_choix (type,nom,prix,ordre) VALUES
  ('boisson_menu','Coca-Cola',0,1),
  ('boisson_menu','Coca-Cola Zero',0,2),
  ('boisson_menu','Fanta Orange',0,3),
  ('boisson_menu','7Up',0,4),
  ('boisson_menu','Oasis Tropical',0,5),
  ('boisson_menu','Ice Tea',0,6),
  ('boisson_menu','Eau 50cl',0,7);

-- (Les boissons en bouteille/canette sont des produits de la catégorie 8,
--  vendus seuls. Les boissons de menu ci-dessus servent au système menu.)

-- =============================================================
--  LIAISONS PRODUIT <-> OPTIONS  (règles min/max)
--  Rappels de règles métier :
--   - Sauce : max 3, gratuites. Obligatoire (min 1) sur sandwichs/tacos,
--     optionnelle (min 0) sur les assiettes.
--   - Tacos : nb de viandes IMPOSÉ par le format (min = max). Pas de pain.
--   - boisson_menu : cliquer une boisson fait passer le produit en "menu"
--     (géré côté front/serveur). max_choix élevé : 1 incluse, les suivantes
--     facturées +1,50 € (logique de prix dans menu.js / commandes.js).
--   - Crudités (sans salade/tomate/oignon) : géré côté front pour les
--     sandwichs (champ "retraits"), pas une option en base.
-- =============================================================

-- ---- TACOS : viandes imposées par le format + sauce 1-3 (pas de pain) ----
INSERT INTO produit_options (produit_id, type, min_choix, max_choix)
SELECT id,'viande',1,1 FROM produits WHERE nom='Tacos 1 viande';
INSERT INTO produit_options (produit_id, type, min_choix, max_choix)
SELECT id,'viande',2,2 FROM produits WHERE nom='Tacos 2 viandes';
INSERT INTO produit_options (produit_id, type, min_choix, max_choix)
SELECT id,'viande',3,3 FROM produits WHERE nom='Tacos 3 viandes';
INSERT INTO produit_options (produit_id, type, min_choix, max_choix)
SELECT id,'sauce',1,3 FROM produits WHERE categorie_id=3;
INSERT INTO produit_options (produit_id, type, min_choix, max_choix)
SELECT id,'supplement',0,6 FROM produits WHERE categorie_id=3;
INSERT INTO produit_options (produit_id, type, min_choix, max_choix)
SELECT id,'boisson_menu',0,5 FROM produits WHERE categorie_id=3;

-- ---- SANDWICHS (catégorie 1) : sauce 1-3, suppléments, boisson(menu) ----
INSERT INTO produit_options (produit_id, type, min_choix, max_choix)
SELECT id,'sauce',1,3 FROM produits WHERE categorie_id=1;
INSERT INTO produit_options (produit_id, type, min_choix, max_choix)
SELECT id,'supplement',0,6 FROM produits WHERE categorie_id=1;
INSERT INTO produit_options (produit_id, type, min_choix, max_choix)
SELECT id,'boisson_menu',0,5 FROM produits WHERE categorie_id=1;

-- ---- ASSIETTES (catégorie 2) : sauce OPTIONNELLE (0-3), pas de boisson ----
INSERT INTO produit_options (produit_id, type, min_choix, max_choix)
SELECT id,'sauce',0,3 FROM produits WHERE categorie_id=2;
-- Viande au choix UNIQUEMENT pour Assiette Mixte et Assiette Du Chef
INSERT INTO produit_options (produit_id, type, min_choix, max_choix)
SELECT id,'viande',1,1 FROM produits WHERE nom IN ('Assiette Mixte','Assiette Du Chef');
-- Boisson en option (+1,50 € chacune, pas de prix menu sur les assiettes)
INSERT INTO produit_options (produit_id, type, min_choix, max_choix)
SELECT id,'boisson_menu',0,5 FROM produits WHERE categorie_id=2;

-- ---- SANDWICH ROYAL (catégorie 4) : sauce 1-3 ----
INSERT INTO produit_options (produit_id, type, min_choix, max_choix)
SELECT id,'sauce',1,3 FROM produits WHERE categorie_id=4;
INSERT INTO produit_options (produit_id, type, min_choix, max_choix)
SELECT id,'boisson_menu',0,5 FROM produits WHERE categorie_id=4;

-- ---- PANINIS (catégorie 5) : sauce 1-3 + boisson(menu), pas de crudités ----
INSERT INTO produit_options (produit_id, type, min_choix, max_choix)
SELECT id,'sauce',1,3 FROM produits WHERE categorie_id=5;
INSERT INTO produit_options (produit_id, type, min_choix, max_choix)
SELECT id,'boisson_menu',0,5 FROM produits WHERE categorie_id=5;

-- ---- BURGERS (catégorie 6) : sauce 1-3, suppléments, boisson(menu) ----
INSERT INTO produit_options (produit_id, type, min_choix, max_choix)
SELECT id,'sauce',1,3 FROM produits WHERE categorie_id=6;
INSERT INTO produit_options (produit_id, type, min_choix, max_choix)
SELECT id,'supplement',0,6 FROM produits WHERE categorie_id=6;
INSERT INTO produit_options (produit_id, type, min_choix, max_choix)
SELECT id,'boisson_menu',0,5 FROM produits WHERE categorie_id=6;

-- =============================================================
--  PARAMÈTRES
-- =============================================================
INSERT INTO parametres (cle, valeur) VALUES
  ('code_admin','kebab2026'),                                  -- À CHANGER par le gérant
  ('message_delai','Délai estimé : à confirmer selon affluence'),
  ('heure_limite_commande','21:45'),
  ('horaires','Mar-Dim 11h-22h, lundi fermé');

-- =============================================================
--  FIN DU SCRIPT
-- =============================================================
