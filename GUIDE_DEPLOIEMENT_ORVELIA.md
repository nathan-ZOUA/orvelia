# 🌐 Guide de Déploiement Gratuit en Ligne — ORVÉLIA Platform

Votre plateforme **ORVÉLIA** est entièrement configurée avec une architecture moderne conteneurisée (`Dockerfile`, `render.yaml`, `railway.json`, `server.js`) prête à être déployée en 1 clic avec **Frontend, Backend et Base de données PostgreSQL 16**, sous une URL HTTPS sécurisée standard gratuite (sans aucun nom de domaine personnalisé).

---

## 🚀 Option 1 : Déploiement Automatique sur Render.com (Recommandé, 1 Clic)

Render lit directement le fichier [`render.yaml`](file:///c:/Users/zoua/Documents/DEV/projets/orvelia/render.yaml) à la racine de votre dépôt et crée **simultanément la Base de données PostgreSQL et le Serveur Web** :

1. **Rendez-vous sur [dashboard.render.com](https://dashboard.render.com/)** (connectez-vous directement avec votre compte GitHub `Nathan-Zoua`).
2. Cliquez sur le bouton bleu **"New +"** (en haut à droite), puis choisissez **"Blueprint"**.
3. Sélectionnez votre dépôt GitHub : **`nathan-ZOUA/orvelia`** (ou `orvelia`).
4. Render détecte automatiquement la configuration complète :
   * **Base de données** : `orvelia-db` (PostgreSQL 16, plan Free gratuit)
   * **Serveur Web** : `orvelia` (Node.js 20, plan Free gratuit)
   * **Variables d'environnement** : `DATABASE_URL` est connectée automatiquement de la base vers le backend !
   * **Migration automatique** : `prisma db push` applique automatiquement les 25 tables relationnelles.
5. Cliquez sur **"Apply"** :
   * Le déploiement s'exécute automatiquement en 2 minutes.
   * Votre lien d'accès direct simple et gratuit sera disponible sous la forme :
   * 👉 **`https://orvelia.onrender.com`** (ou `https://orvelia-enterprise.onrender.com`).

---

## 🚂 Option 2 : Déploiement sur Railway (Alternative)

Si vous préférez déployer sur Railway :

1. **Rendez-vous sur [railway.com/new](https://railway.com/new)**.
2. Cliquez sur **"Provision PostgreSQL"** (votre base de données est créée instantanément).
3. Dans le même projet, cliquez sur **"+ New"** > **"GitHub Repo"** > sélectionnez **`nathan-ZOUA/orvelia`**.
4. Dans les paramètres du service web, ajoutez la variable de référence :
   * `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
5. Cliquez sur **"Deploy"** :
   * Railway compile le conteneur Docker et génère votre lien direct :
   * 👉 **`https://orvelia.up.railway.app`**.

---

> [!NOTE]
> Aucun nom de domaine n'est configuré. L'application utilise nativement les sous-domaines gratuits sécurisés SSL HTTPS de la plateforme cloud.
