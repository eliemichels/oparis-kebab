/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19-11.8.3-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: oparis_kebab
-- ------------------------------------------------------
-- Server version	11.8.3-MariaDB-0+deb13u1 from Debian

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nom` varchar(80) NOT NULL,
  `ordre` int(11) NOT NULL DEFAULT 0,
  `actif` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categories`
--

LOCK TABLES `categories` WRITE;
/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `categories` VALUES
(1,'Sandwichs',1,1),
(2,'Assiettes',2,1),
(3,'Tacos',3,1),
(4,'Sandwich Royal',4,1),
(5,'Paninis',5,1),
(6,'Burgers',6,1),
(7,'Menu Kids',7,1),
(8,'Boissons',8,1),
(9,'Suppléments',9,1);
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `commande_item_options`
--

DROP TABLE IF EXISTS `commande_item_options`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `commande_item_options` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `item_id` int(11) NOT NULL,
  `type` varchar(20) NOT NULL,
  `nom` varchar(80) NOT NULL,
  `prix` decimal(5,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `fk_opt_item` (`item_id`),
  CONSTRAINT `fk_opt_item` FOREIGN KEY (`item_id`) REFERENCES `commande_items` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `commande_item_options`
--

LOCK TABLES `commande_item_options` WRITE;
/*!40000 ALTER TABLE `commande_item_options` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `commande_item_options` VALUES
(1,1,'sauce','Algérienne',0.00),
(2,1,'sauce','Ketchup',0.00),
(3,1,'sauce','Harissa',0.00),
(4,1,'boisson_menu','Coca-Cola',0.00);
/*!40000 ALTER TABLE `commande_item_options` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `commande_items`
--

DROP TABLE IF EXISTS `commande_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `commande_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `commande_id` int(11) NOT NULL,
  `produit_nom` varchar(120) NOT NULL,
  `formule` varchar(40) DEFAULT NULL,
  `prix_unitaire` decimal(6,2) NOT NULL,
  `quantite` int(11) NOT NULL DEFAULT 1,
  `personnalisation` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_item_commande` (`commande_id`),
  CONSTRAINT `fk_item_commande` FOREIGN KEY (`commande_id`) REFERENCES `commandes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `commande_items`
--

LOCK TABLES `commande_items` WRITE;
/*!40000 ALTER TABLE `commande_items` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `commande_items` VALUES
(1,1,'Steak','Menu',7.50,1,'Menu (frites incluses), Algérienne, Ketchup, Harissa, Coca-Cola');
/*!40000 ALTER TABLE `commande_items` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `commandes`
--

DROP TABLE IF EXISTS `commandes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `commandes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `numero` varchar(20) NOT NULL,
  `client_nom` varchar(120) NOT NULL,
  `client_tel` varchar(20) NOT NULL,
  `mode_retrait` enum('sur_place','a_emporter') NOT NULL DEFAULT 'a_emporter',
  `heure_retrait` varchar(10) DEFAULT NULL,
  `total` decimal(7,2) NOT NULL DEFAULT 0.00,
  `commentaire` varchar(500) DEFAULT NULL,
  `statut` enum('nouvelle','en_preparation','prete','recuperee') NOT NULL DEFAULT 'nouvelle',
  `cree_le` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `numero` (`numero`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `commandes`
--

LOCK TABLES `commandes` WRITE;
/*!40000 ALTER TABLE `commandes` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `commandes` VALUES
(1,'20260618-1143','Pomo','0646784500','a_emporter',NULL,7.50,'Ntm','nouvelle','2026-06-18 16:56:50');
/*!40000 ALTER TABLE `commandes` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `options_choix`
--

DROP TABLE IF EXISTS `options_choix`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `options_choix` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `type` enum('viande','sauce','supplement','boisson','pain','boisson_menu') NOT NULL,
  `nom` varchar(80) NOT NULL,
  `prix` decimal(5,2) NOT NULL DEFAULT 0.00,
  `dispo` tinyint(1) NOT NULL DEFAULT 1,
  `ordre` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `options_choix`
--

LOCK TABLES `options_choix` WRITE;
/*!40000 ALTER TABLE `options_choix` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `options_choix` VALUES
(1,'viande','Kebab',0.00,1,1),
(2,'viande','Kefta',0.00,1,2),
(3,'viande','Merguez',0.00,1,3),
(4,'viande','Brochette de poulet',0.00,1,4),
(5,'viande','Brochette d\'agneau',0.00,1,5),
(6,'viande','Chicken Chika',0.00,1,6),
(7,'viande','Triple Steak',0.00,1,7),
(8,'viande','Steak',0.00,1,8),
(9,'viande','Poulet',0.00,1,9),
(10,'viande','Agneau',0.00,1,10),
(11,'sauce','Blanche',0.00,1,1),
(12,'sauce','Algérienne',0.00,1,2),
(13,'sauce','Harissa',0.00,1,3),
(14,'sauce','Samouraï',0.00,1,4),
(15,'sauce','Barbecue',0.00,1,5),
(16,'sauce','Ketchup',0.00,1,6),
(17,'sauce','Mayonnaise',0.00,1,7),
(18,'sauce','Andalouse',0.00,1,8),
(19,'sauce','Biggy Burger',0.00,1,9),
(20,'supplement','Frites',2.50,1,1),
(21,'supplement','Extra fromage',1.00,1,2),
(22,'supplement','Extra viande',1.50,1,3),
(23,'supplement','Œuf',1.00,1,4),
(24,'supplement','Oignons frits',1.00,1,5),
(25,'supplement','Cheddar',1.00,1,6),
(26,'supplement','Tiramisu',1.50,1,7),
(27,'boisson_menu','Coca-Cola',0.00,1,1),
(28,'boisson_menu','Coca-Cola Zero',0.00,1,2),
(29,'boisson_menu','Fanta Orange',0.00,1,3),
(30,'boisson_menu','7Up',0.00,1,4),
(31,'boisson_menu','Oasis Tropical',0.00,1,5),
(32,'boisson_menu','Ice Tea',0.00,1,6),
(33,'boisson_menu','Eau 50cl',0.00,1,7);
/*!40000 ALTER TABLE `options_choix` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `parametres`
--

DROP TABLE IF EXISTS `parametres`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `parametres` (
  `cle` varchar(50) NOT NULL,
  `valeur` varchar(255) NOT NULL,
  PRIMARY KEY (`cle`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `parametres`
--

LOCK TABLES `parametres` WRITE;
/*!40000 ALTER TABLE `parametres` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `parametres` VALUES
('code_admin','kebab2026'),
('heure_limite_commande','21:45'),
('horaires','Mar-Dim 11h-22h, lundi fermé'),
('message_delai','Délai estimé : à confirmer selon affluence');
/*!40000 ALTER TABLE `parametres` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `produit_options`
--

DROP TABLE IF EXISTS `produit_options`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `produit_options` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `produit_id` int(11) NOT NULL,
  `type` enum('viande','sauce','supplement','boisson','pain','boisson_menu') NOT NULL,
  `min_choix` int(11) NOT NULL DEFAULT 0,
  `max_choix` int(11) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `fk_po_produit` (`produit_id`),
  CONSTRAINT `fk_po_produit` FOREIGN KEY (`produit_id`) REFERENCES `produits` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=140 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `produit_options`
--

LOCK TABLES `produit_options` WRITE;
/*!40000 ALTER TABLE `produit_options` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `produit_options` VALUES
(1,19,'viande',1,1),
(2,20,'viande',2,2),
(3,21,'viande',3,3),
(4,19,'sauce',1,3),
(5,20,'sauce',1,3),
(6,21,'sauce',1,3),
(7,19,'supplement',0,6),
(8,20,'supplement',0,6),
(9,21,'supplement',0,6),
(10,19,'boisson_menu',0,5),
(11,20,'boisson_menu',0,5),
(12,21,'boisson_menu',0,5),
(13,1,'sauce',1,3),
(14,2,'sauce',1,3),
(15,3,'sauce',1,3),
(16,4,'sauce',1,3),
(17,5,'sauce',1,3),
(18,6,'sauce',1,3),
(19,7,'sauce',1,3),
(20,8,'sauce',1,3),
(21,9,'sauce',1,3),
(22,10,'sauce',1,3),
(23,11,'sauce',1,3),
(28,1,'supplement',0,6),
(29,2,'supplement',0,6),
(30,3,'supplement',0,6),
(31,4,'supplement',0,6),
(32,5,'supplement',0,6),
(33,6,'supplement',0,6),
(34,7,'supplement',0,6),
(35,8,'supplement',0,6),
(36,9,'supplement',0,6),
(37,10,'supplement',0,6),
(38,11,'supplement',0,6),
(43,1,'boisson_menu',0,5),
(44,2,'boisson_menu',0,5),
(45,3,'boisson_menu',0,5),
(46,4,'boisson_menu',0,5),
(47,5,'boisson_menu',0,5),
(48,6,'boisson_menu',0,5),
(49,7,'boisson_menu',0,5),
(50,8,'boisson_menu',0,5),
(51,9,'boisson_menu',0,5),
(52,10,'boisson_menu',0,5),
(53,11,'boisson_menu',0,5),
(58,12,'sauce',0,3),
(59,13,'sauce',0,3),
(60,14,'sauce',0,3),
(61,15,'sauce',0,3),
(62,16,'sauce',0,3),
(63,17,'sauce',0,3),
(64,18,'sauce',0,3),
(65,17,'viande',1,1),
(66,18,'viande',1,1),
(68,12,'boisson_menu',0,5),
(69,13,'boisson_menu',0,5),
(70,14,'boisson_menu',0,5),
(71,15,'boisson_menu',0,5),
(72,16,'boisson_menu',0,5),
(73,17,'boisson_menu',0,5),
(74,18,'boisson_menu',0,5),
(75,22,'sauce',1,3),
(76,23,'sauce',1,3),
(77,24,'sauce',1,3),
(78,25,'sauce',1,3),
(79,26,'sauce',1,3),
(80,27,'sauce',1,3),
(82,22,'boisson_menu',0,5),
(83,23,'boisson_menu',0,5),
(84,24,'boisson_menu',0,5),
(85,25,'boisson_menu',0,5),
(86,26,'boisson_menu',0,5),
(87,27,'boisson_menu',0,5),
(89,28,'sauce',1,3),
(90,29,'sauce',1,3),
(91,30,'sauce',1,3),
(92,31,'sauce',1,3),
(93,32,'sauce',1,3),
(94,33,'sauce',1,3),
(95,34,'sauce',1,3),
(96,35,'sauce',1,3),
(97,36,'sauce',1,3),
(104,28,'boisson_menu',0,5),
(105,29,'boisson_menu',0,5),
(106,30,'boisson_menu',0,5),
(107,31,'boisson_menu',0,5),
(108,32,'boisson_menu',0,5),
(109,33,'boisson_menu',0,5),
(110,34,'boisson_menu',0,5),
(111,35,'boisson_menu',0,5),
(112,36,'boisson_menu',0,5),
(119,37,'sauce',1,3),
(120,38,'sauce',1,3),
(121,39,'sauce',1,3),
(122,40,'sauce',1,3),
(123,41,'sauce',1,3),
(124,42,'sauce',1,3),
(125,43,'sauce',1,3),
(126,37,'supplement',0,6),
(127,38,'supplement',0,6),
(128,39,'supplement',0,6),
(129,40,'supplement',0,6),
(130,41,'supplement',0,6),
(131,42,'supplement',0,6),
(132,43,'supplement',0,6),
(133,37,'boisson_menu',0,5),
(134,38,'boisson_menu',0,5),
(135,39,'boisson_menu',0,5),
(136,40,'boisson_menu',0,5),
(137,41,'boisson_menu',0,5),
(138,42,'boisson_menu',0,5),
(139,43,'boisson_menu',0,5);
/*!40000 ALTER TABLE `produit_options` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `produits`
--

DROP TABLE IF EXISTS `produits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `produits` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `categorie_id` int(11) NOT NULL,
  `nom` varchar(120) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `prix_seul` decimal(5,2) DEFAULT NULL,
  `prix_menu` decimal(5,2) DEFAULT NULL,
  `prix_classic` decimal(5,2) DEFAULT NULL,
  `prix_maxi` decimal(5,2) DEFAULT NULL,
  `allergenes` varchar(255) NOT NULL DEFAULT '',
  `dispo` tinyint(1) NOT NULL DEFAULT 1,
  `ordre` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `fk_produit_cat` (`categorie_id`),
  CONSTRAINT `fk_produit_cat` FOREIGN KEY (`categorie_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=64 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `produits`
--

LOCK TABLES `produits` WRITE;
/*!40000 ALTER TABLE `produits` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `produits` VALUES
(1,1,'Kebab','Servi avec salade, tomate, oignons, frites',6.50,8.00,NULL,NULL,'',1,1),
(2,1,'Steak','Servi avec salade, tomate, oignons, frites',6.00,7.50,NULL,NULL,'',1,2),
(3,1,'Chicken Chika','Servi avec salade, tomate, oignons, frites',7.00,8.50,NULL,NULL,'',1,3),
(4,1,'Brochette de poulet','Servi avec salade, tomate, oignons, frites',7.00,8.50,NULL,NULL,'',1,4),
(5,1,'Merguez','Servi avec salade, tomate, oignons, frites',6.50,8.00,NULL,NULL,'',1,5),
(6,1,'Kefta','Servi avec salade, tomate, oignons, frites',6.50,8.00,NULL,NULL,'',1,6),
(7,1,'Triple Steak','3 steaks 45g + fromage',7.00,8.50,NULL,NULL,'',1,7),
(8,1,'Agneau','Servi avec salade, tomate, oignons, frites',8.00,9.50,NULL,NULL,'',1,8),
(9,1,'Le Chef','Chicken + kefta + 2 fromages',9.50,11.00,NULL,NULL,'',1,9),
(10,1,'S4','4 steaks 45g + œuf + 2 fromages',8.00,9.50,NULL,NULL,'',1,10),
(11,1,'S5','5 steaks + œuf + 2 fromages',9.50,11.00,NULL,NULL,'',1,11),
(12,2,'Assiette Kebab','Salade mixte, frites, blé maison',NULL,NULL,10.00,12.00,'',1,1),
(13,2,'Assiette Poulet','Salade mixte, frites, blé maison',NULL,NULL,11.00,13.00,'',1,2),
(14,2,'Assiette Agneau','Salade mixte, frites, blé maison',NULL,NULL,12.00,14.00,'',1,3),
(15,2,'Assiette Steak','Salade mixte, frites, blé maison',NULL,NULL,10.00,12.00,'',1,4),
(16,2,'Assiette Kefta','Salade mixte, frites, blé maison',NULL,NULL,10.00,12.00,'',1,5),
(17,2,'Assiette Mixte','Salade mixte, frites, blé maison',NULL,NULL,14.00,16.00,'',1,6),
(18,2,'Assiette Du Chef','Salade mixte, frites, blé maison',NULL,NULL,16.00,18.00,'',1,7),
(19,3,'Tacos 1 viande','Galette toastée, salade, tomate, oignon, fromage fondu, 1 viande',NULL,NULL,6.50,8.50,'',1,1),
(20,3,'Tacos 2 viandes','Galette toastée, salade, tomate, oignon, fromage fondu, 2 viandes',NULL,NULL,7.50,9.50,'',1,2),
(21,3,'Tacos 3 viandes','Galette toastée, salade, tomate, oignon, fromage fondu, 3 viandes',NULL,NULL,8.50,10.50,'',1,3),
(22,4,'Royal Kefta',NULL,6.50,NULL,NULL,NULL,'',1,1),
(23,4,'Royal Steak',NULL,6.50,NULL,NULL,NULL,'',1,2),
(24,4,'Royal Poulet',NULL,7.00,NULL,NULL,NULL,'',1,3),
(25,4,'Royal Chicken Steak',NULL,7.00,NULL,NULL,NULL,'',1,4),
(26,4,'Royal Agneau',NULL,7.50,NULL,NULL,NULL,'',1,5),
(27,4,'Royal Merguez',NULL,7.50,NULL,NULL,NULL,'',1,6),
(28,5,'Panini Chef','Kebab + fromage',5.50,NULL,NULL,NULL,'',1,1),
(29,5,'Panini Special','Kebab + kefta + fromage',5.50,NULL,NULL,NULL,'',1,2),
(30,5,'Panini Kefta','Kefta + fromage',5.00,NULL,NULL,NULL,'',1,3),
(31,5,'Panini Steak','Steak + fromage',5.00,NULL,NULL,NULL,'',1,4),
(32,5,'Panini Merguez','Merguez + fromage',5.00,NULL,NULL,NULL,'',1,5),
(33,5,'Panini Chicken Chika','Chicken + fromage',4.50,NULL,NULL,NULL,'',1,6),
(34,5,'Panini Poulet','Salade, tomate, blanc de poulet, fromage',5.00,NULL,NULL,NULL,'',1,7),
(35,5,'Panini Thon','Thon + fromage',5.00,NULL,NULL,NULL,'',1,8),
(36,5,'Panini 3 Fromages','Trois fromages',4.50,NULL,NULL,NULL,'',1,9),
(37,6,'Cheese','Salade, tomate, fromage, steak 100g',3.00,5.50,NULL,NULL,'',1,1),
(38,6,'Chicken Steak','Salade, tomate, fromage, steak poulet 100g',3.50,6.00,NULL,NULL,'',1,2),
(39,6,'Double Cheese','2 steaks 100g + 2 fromages',5.50,NULL,NULL,NULL,'',1,3),
(40,6,'Double Chicken Steak','2 steaks poulet 100g + 2 fromages',5.50,NULL,NULL,NULL,'',1,4),
(41,6,'Special Cheese','Cheese + œuf + frites',4.50,NULL,NULL,NULL,'',1,5),
(42,6,'Royal Cheese','Steak haché poulet 100g + 2 fromages',6.50,NULL,NULL,NULL,'',1,6),
(43,6,'Menu Nuggets','Nuggets + frites + boisson',6.00,NULL,NULL,NULL,'',1,7),
(44,7,'Menu Kids','Nuggets ou Cheese + frites + jouet + boisson',5.00,NULL,NULL,NULL,'',1,1),
(45,7,'Menu 11','Nuggets, frites, boisson',NULL,NULL,NULL,NULL,'',1,2),
(46,8,'Coca-Cola','Canette 33cl',1.50,NULL,NULL,NULL,'',1,1),
(47,8,'Coca-Cola Cherry','Canette 33cl',1.50,NULL,NULL,NULL,'',1,2),
(48,8,'Coca-Cola Zero','Canette 33cl',1.50,NULL,NULL,NULL,'',1,3),
(49,8,'Fanta Orange','Canette 33cl',1.50,NULL,NULL,NULL,'',1,4),
(50,8,'7Up','Canette 33cl',1.50,NULL,NULL,NULL,'',1,5),
(51,8,'7Up Cherry','Canette 33cl',1.50,NULL,NULL,NULL,'',1,6),
(52,8,'Oasis Tropical','Canette 33cl',1.50,NULL,NULL,NULL,'',1,7),
(53,8,'Oasis Pomme-Cassis','Canette 33cl',1.50,NULL,NULL,NULL,'',1,8),
(54,8,'Lipton Ice Tea','Canette 33cl',1.50,NULL,NULL,NULL,'',1,9),
(55,8,'Pepsi','Canette 33cl',1.50,NULL,NULL,NULL,'',1,10),
(56,8,'Orangina','Canette 33cl',1.50,NULL,NULL,NULL,'',1,11),
(57,8,'Boisson énergisante','Canette 25cl',2.00,NULL,NULL,NULL,'',1,12),
(58,8,'Coca-Cola 50cl','Bouteille 50cl',2.50,NULL,NULL,NULL,'',1,13),
(59,8,'Fanta 50cl','Bouteille 50cl',2.50,NULL,NULL,NULL,'',1,14),
(60,8,'Oasis 50cl','Bouteille 50cl',2.50,NULL,NULL,NULL,'',1,15),
(61,8,'Eau Cristalline 50cl','Bouteille eau plate 50cl',1.00,NULL,NULL,NULL,'',1,16),
(62,8,'Eau gazeuse 50cl','Bouteille eau gazeuse 50cl',1.50,NULL,NULL,NULL,'',1,17),
(63,9,'Tiramisu','Dessert maison',3.00,NULL,NULL,NULL,'',1,1);
/*!40000 ALTER TABLE `produits` ENABLE KEYS */;
UNLOCK TABLES;
commit;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;

-- Dump completed on 2026-06-26 13:57:58
