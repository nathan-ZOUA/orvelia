# ORVÉLIA — Documentation Technique Complète : Architecture, Paiements Flutterwave, Shopify & Déploiement

**Direction Artistique & Architecture Principale :** Nathan Zoua (`NZ`)  
**Positionnement :** *Luxury meets modern technology* — Plateforme E-commerce Internationale & Souveraine  
**Stack de Référence :** Next.js (App Router, TypeScript strict), Tailwind CSS, PostgreSQL, Prisma ORM (25 modèles), Flutterwave v3 + Adaptateur CinetPay, Connecteur Shopify Storefront/Admin API.

---

## 1. AUDIT ARCHITECTURAL : SHOPIFY HEADLESS (OPTION A) VS FULL-STACK AUTONOME + CONNECTEUR SHOPIFY (OPTION B)

Conformément à la section 14 du cahier des charges, voici l’analyse comparative rigoureuse permettant de trancher l’architecture en fonction des réalités techniques du paiement au Cameroun (`XAF` / FCFA) et à l’international (`EUR`, `USD`, `XOF`).

| Critère Technique & Métier | OPTION A — Shopify Headless Natif (Storefront API + Shopify Checkout) | OPTION B — E-Commerce Full-Stack Autonome + Connecteur Shopify (RECOMMANDÉ & IMPLÉMENTÉ) |
| :--- | :--- | :--- |
| **Checkout & Expérience Utilisateur** | Redirection obligatoire vers le domaine de checkout Shopify (`checkout.shopify.com`) sauf abonnement Shopify Plus (à partir de 2 300 $/mois). | **Checkout 100 % intégré en 6 étapes** sur le domaine ORVÉLIA sans rupture visuelle, avec achat invité ou compte client. |
| **Mobile Money au Cameroun (MTN MoMo & Orange Money CM)** | Dépend d’applications tierces de redirection externe sur le checkout Shopify ; fréquentes frictions UX et incompatibilités de devise `XAF` selon le pays du compte Shopify Payments. | **Intégration directe API serveur-à-serveur Flutterwave (`mobile_money_franco`)** : déclenchement natif du push USSD (`*126#` MTN / `#150#` Orange) et vérification webhook directe. |
| **Règle de Filtrage Géographique des Paiements (ex: Wave)** | Difficile de masquer dynamiquement un sous-moyen de paiement d'une passerelle externe selon le pays de livraison sans Shopify Plus Checkout UI Extensions. | **Matrice de capacités serveur stricte** : Wave est automatiquement masqué pour le Cameroun (`CM` / `XAF`) et activé uniquement pour le Sénégal (`SN`) et la Côte d’Ivoire (`CI`) en `XOF`. |
| **Machine à États & Idempotence** | Gérée en boîte noire par Shopify (`Paid`, `Pending`, `Refunded`). | **Machine à états explicite à 6 états** (`PENDING`, `SUCCESS`, `FAILED`, `CANCELLED`, `EXPIRED`, `REFUNDED`) avec journalisation complète dans la table `PaymentEvents`. |
| **Chat Client Temps Réel & Dashboard Unifié** | Nécessite des applications payantes tierces (Gorgias, Zendesk) facturées au ticket. | **Chat temps réel intégré** (`Conversations` + `Messages`) relié directement aux commandes autorisées du client dans le même back-office. |
| **Compétences Shopify Valorisées** | Storefront API uniquement côté vitrine. | **Double compétence démontrée** : Moteur e-commerce PostgreSQL/Prisma complet + Connecteur GraphQL `Storefront API` & `Admin API` (`src/lib/shopify/shopify-connector.ts`) pour synchroniser les produits et stocks avec une boutique Shopify de développement. |

### Décision Architecturale Finale
Nous retenons **l’Option B (Architecture Full-Stack Autonome avec Connecteur Hybride Shopify)**. Ce choix garantit une compatibilité native et sans friction avec **MTN Mobile Money** et **Orange Money au Cameroun** via Flutterwave en `XAF`, tout en démontrant la maîtrise complète de Shopify (`Storefront API`, `Admin API`, `Shopify CLI` et synchronisation des stocks).

---

## 2. GUIDE DE CONFIGURATION MARCHANDE FLUTTERWAVE (CAMEROUN & INTERNATIONAL)

Conformément à la règle absolue n°3 (*N'invente pas de clés API*) et à la section 9.E, voici la procédure exacte pour ouvrir, vérifier et connecter votre compte marchand Flutterwave à ORVÉLIA.

### Étape 1 — Création du compte marchand Flutterwave
1. Rendez-vous sur le portail officiel [Flutterwave for Business](https://flutterwave.com/) et cliquez sur **Create Account**.
2. Sélectionnez le pays d’enregistrement de votre entreprise (ex. **Cameroon** pour encaisser nativement en `XAF` via MTN Mobile Money et Orange Money, ainsi que les cartes Visa/Mastercard internationales).
3. Renseignez l’adresse email professionnelle de la marque (ex. `finance@orvelia.luxury`).

### Étape 2 — Documents requis pour la vérification KYC / KYB au Cameroun
Pour passer du mode **Test (Sandbox)** au mode **Live (Production)**, téléversez dans **Settings > Business Verification** :
* **Pièce d’identité officielle** du dirigeant (CNI biométrique camerounaise ou Passeport en cours de validité).
* **Registre du Commerce et du Crédit Mobilier (RCCM)** de l’entreprise.
* **Attestation d’Immatriculation Fiscale (NIU - Numéro d’Identifiant Unique)** délivrée par la DGI.
* **Justificatif de domicile ou de siège social** (facture ENEO/Camwater ou contrat de bail commercial de moins de 3 mois).
* **Coordonnées bancaires (RIB)** d’un compte professionnel en FCFA (`XAF`) ou compte de règlement mobile marchand pour les reversements (Settlements).

### Étape 3 — Récupération des clés API (Sandbox & Production)
1. Connectez-vous au tableau de bord Flutterwave.
2. Ouvrez **Settings > Developers > API Keys**.
3. En mode **Test Mode**, copiez les trois clés suivantes dans votre fichier `.env.local` (basé sur `.env.example`) :
   * `FLW_PUBLIC_KEY` (commence par `FLWPUBK_TEST-...`)
   * `FLW_SECRET_KEY` (commence par `FLWSECK_TEST-...` — **ne jamais exposer côté client**, pas de préfixe `NEXT_PUBLIC_`)
   * `FLW_ENCRYPTION_KEY` (clé de chiffrement 3DES 24 caractères)

### Étape 4 — Configuration sécurisée des Webhooks
1. Dans le tableau de bord Flutterwave, allez dans **Settings > Developers > Webhooks**.
2. Renseignez l’URL publique HTTPS de votre endpoint backend :
   `https://votre-domaine-orvelia.com/api/webhooks/flutterwave`
3. Définissez un **Secret Hash** robuste (ex. généré avec `openssl rand -hex 32`) et reportez exactement la même valeur dans la variable d’environnement `FLW_WEBHOOK_SECRET_HASH`.
4. Cochez les options **Send webhook notifications for failed transactions** et **Enable webhook retries**.
5. Notre endpoint `src/app/api/webhooks/flutterwave/route.ts` vérifie l’en-tête HTTP `verif-hash` en temps constant (`crypto.timingSafeEqual`), puis effectue systématiquement un appel serveur-à-serveur `GET https://api.flutterwave.com/v3/transactions/{id}/verify` pour contrôler que `status === "successful"`, `amount >= order.totalAmountXaf` et `currency === order.currency` avant de passer la commande à l’état `PAID`.

### Étape 5 — Tests en Sandbox et Passage en Production
* **Cartes de test 3-D Secure Flutterwave** : utilisez les cartes de test fournies dans la documentation Flutterwave Sandbox pour simuler les scénarios `SUCCESS`, `FAILED` (fonds insuffisants) et `PENDING` (attente OTP).
* **Mobile Money Sandbox** : utilisez un numéro au format `237670000000` (MTN) ou `237690000000` (Orange) en mode Test pour valider la transition d’état `PENDING -> SUCCESS`.
* **Passage en Production** : une fois le dossier KYB approuvé par Flutterwave, désactivez le bouton *Test Mode* dans le dashboard Flutterwave, remplacez les clés `FLWPUBK_TEST-` / `FLWSECK_TEST-` par vos clés `FLWPUBK-` / `FLWSECK-` dans les variables d’environnement Vercel, et effectuez une transaction réelle de test de 500 FCFA.

---

## 3. PROCÉDURE SHOPIFY : BOUTIQUE DE DÉVELOPPEMENT & SYNCHRONISATION

1. **Création d’un compte Shopify Partners** : créez un compte gratuit sur [Shopify Partners](https://partners.shopify.com/).
2. **Création d’une boutique de développement** : dans **Stores > Add store > Create development store**, nommez la boutique `orvelia-dev.myshopify.com` avec les données de test activées.
3. **Configuration de l’application Custom App** :
   * Dans l’admin Shopify (`Settings > Apps and sales channels > Develop apps`), créez l’application `ORVÉLIA Hybrid Connector (NZ)`.
   * Activez les scopes **Storefront API** : `unauthenticated_read_product_listings`, `unauthenticated_read_product_inventory`, `unauthenticated_write_checkouts`.
   * Activez les scopes **Admin API** : `read_products`, `write_products`, `read_inventory`, `write_inventory`, `read_orders`, `write_orders`.
4. **Branchement** : copiez `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_ACCESS_TOKEN` et `SHOPIFY_ADMIN_ACCESS_TOKEN` dans `.env.local`. Le module `src/lib/shopify/shopify-connector.ts` synchronise alors le catalogue GraphQL tout en conservant le checkout local Flutterwave.

---

## 4. RAPPORT DE TESTS AUTOMATISÉS & CONTRÔLE QUALITÉ

L’ensemble des règles métier critiques d’ORVÉLIA est vérifié par notre suite de tests automatisés (`tests/run_verification_suite.py`) exécutée dans le sandbox :

1. **Recalcul serveur des montants, taxes (TVA 19,25 %) et codes promotionnels (`ORVELIA10`, `PRIVILEGE20`)** : garantit qu’un montant manipulé côté client est rejeté.
2. **Machine à états des paiements (`PENDING`, `SUCCESS`, `FAILED`, `CANCELLED`, `EXPIRED`, `REFUNDED`)** : vérifie que les transitions illégales (ex. `FAILED -> SUCCESS` ou double confirmation `SUCCESS -> SUCCESS`) sont bloquées.
3. **Matrice géographique des moyens de paiement** : vérifie que **MTN Mobile Money** et **Orange Money** sont proposés au Cameroun (`CM` / `XAF`), et que **Wave** est strictement masqué au Cameroun mais disponible au Sénégal (`SN`) et en Côte d’Ivoire (`CI`) en `XOF`.
4. **Vérification cryptographique des Webhooks (`timingSafeEqual`)** : rejette toute requête dont le `verif-hash` est absent ou invalide.
5. **Gestion atomique des stocks** : bloque tout ajout au panier ou validation de commande lorsque `quantityRequested > quantityAvailable` et décrémente le stock uniquement lors du passage à `SUCCESS`.
6. **Parité Multilingue (`FR`, `EN`, `AR`) & Support RTL** : vérifie que 100 % des clés de traduction sont présentes dans les 3 langues et que la sélection de l’arabe active `dir="rtl"` et la typographie arabe dédiée.
7. **Accessibilité & Contrastes Thèmes Clair / Sombre (WCAG 2.2 AA)** : vérifie les ratios de contraste des tokens sémantiques Light (`#F7F5F0` / `#111111`) et Dark (`#111111` / `#F7F5F0` / `#B99A62`) pour empêcher tout texte ton sur ton.

---

## 5. PROCÉDURE DE DÉPLOIEMENT PRODUCTION (SOUS VOTRE AUTORISATION EXPLICITE)

Conformément à la section 21 (Phase 8), **aucun déploiement en production n’est déclenché sans votre accord explicite**. Lorsque vous souhaiterez publier la plateforme :

1. **Base de données PostgreSQL managée (Neon, Supabase ou Railway)** :
   * Créez une instance PostgreSQL 16 en région Europe (Francfort/Paris) pour minimiser la latence entre l’Europe et l’Afrique Centrale.
   * Exécutez `npx prisma migrate deploy` pour créer les 25 tables relationnelles et leurs index.
2. **Hébergement Applicatif Vercel** :
   * Importez le dépôt Git sur Vercel.
   * Configurez toutes les variables listées dans `.env.example` dans **Project Settings > Environment Variables**.
   * Ajoutez votre domaine personnalisé (`orvelia.luxury`) avec certificat TLS/SSL automatique.
3. **Validation Finale Post-Déploiement** :
   * Vérifiez la réception du webhook Flutterwave sur `https://orvelia.luxury/api/webhooks/flutterwave`.
   * Exécutez la suite Playwright / Lighthouse sur l’URL de pré-production avant ouverture au public.
