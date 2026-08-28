# 🎵 Songspot FR

Devine la chanson française à partir d'un extrait de **0,1 s à 15 s**.
Clone français de [songspot.net](https://songspot.net/) — interface 100 % en français, catalogue 100 % FR.

Joue **immédiatement** avec le catalogue intégré, ou connecte ton compte Spotify pour
jouer avec **tes propres Titres aimés**.

---

## 🔗 Jouer avec tes Titres aimés Spotify (le plus important)

C'est la fonctionnalité phare : le jeu pioche ses chansons dans **ta** bibliothèque Spotify.

### 1. Créer une app Spotify (2 min)

1. Va sur <https://developer.spotify.com/dashboard> → **Create app**
2. Note le **Client ID** et le **Client Secret**
3. Dans l'onglet **Settings → Redirect URIs**, ajoute exactement :
   ```
   http://localhost:3000/api/auth/spotify/callback      (en dev)
   https://TON-SITE.com/api/auth/spotify/callback       (en prod)
   ```
4. Le scope `user-library-read` est demandé automatiquement — tu n'as rien à cocher.

### 2. Renseigner les identifiants

Copie `.env.example` en `.env.local` et remplis :

```env
SPOTIFY_CLIENT_ID=ton_client_id
SPOTIFY_CLIENT_SECRET=ton_client_secret
# Optionnel : doit pointer vers ton redirect URI ci-dessus
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/auth/spotify/callback
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 3. Lancer et connecter

```bash
npm install
npm run dev          # http://localhost:3000
```

Ouvre le jeu, clique sur **« Connecter Spotify »**, autorise l'app, puis sélectionne
le mode **« Titres aimés »**. Le jeu charge **tous** tes titres aimés (pas de limite),
les mélange pour un tirage équitable, et lance la partie.

> Pas de Spotify ? Aucun problème — le mode **Top France** fonctionne hors-ligne
> avec le catalogue intégré de 95 titres français (Aya Nakamura, Jul, Stromae, Piaf…).

---

## 🚀 Démarrage rapide

```bash
npm install
npm run dev          # http://localhost:3000
```

C'est tout. Sans identifiants Spotify, le jeu utilise le catalogue de secours intégré.

### Commandes utiles

```bash
npm run dev          # serveur de dev (http://localhost:3000)
npm run build        # build de production
npm start            # sert le build de production
npm run lint         # ESLint (0 erreur / 0 warning)
npx tsc --noEmit     # vérification des types TypeScript
npm test             # 300 tests (23 suites), 0 échec
```

---

## 🎮 Comment jouer

1. L'extrait démarre à **0,1 s** (à peine un flash de son).
2. Devine le titre et l'artiste — tape et choisis dans l'autocomplétion.
3. Pas trouvé ? Clique pour **révéler** la chanson et passer au stade suivant.
4. Chaque stade donne un extrait plus long : **0,1 s → 0,5 s → 2 s → 8 s → 15 s**.
   Plus tu devines tôt, plus tu marques de points.
5. Filtre par **difficulté** (popularité) et par **ère** (avant 2000 / 2000s / 2010s / 2020s).
6. **Reroll** pour changer de chanson, **Partager** pour défier un ami.

---

## ✨ Fonctionnalités

- **Deux modes** : Top France (catalogue intégré) et Tes Titres aimés (Spotify)
- **5 stades de difficulté** : de 0,1 s (impossible) à 15 s (facile)
- **Filtres** difficulté + ère, combinables
- **Hors-ligne** : fonctionne sans compte Spotify ni identifiants
- **Responsive** : conçu pour mobile (iPhone SE et +)
- **FAQ** intégrée (`/faq`) et page d'accueil 100 % en français

---

## 🧱 Stack technique

Next.js 15 · React 19 · Tailwind v4 · TypeScript (strict) · Zod · Vitest
· Web API Spotify (client credentials + OAuth « Titres aimés »)

---

## 🌐 Déployer (GitHub + Vercel)

1. **GitHub** : crée le dépôt, puis :
   ```bash
   git remote add origin git@github.com:TON-USER/songspot-fr.git
   git push -u origin master
   ```
   La CI (`.github/workflows/ci.yml`) lance lint + typecheck + build + tests à chaque push.
2. **Vercel** : *New Project* → importe le dépôt (framework Next.js détecté auto).
   Aucune variable d'env requise pour jouer (catalogue de secours).
3. Pour le mode **Titres aimés**, ajoute dans *Settings → Environment Variables* :
   `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, et `SPOTIFY_REDIRECT_URI`
   (qui doit valoir `https://ton-site.vercel.app/api/auth/spotify/callback`).
4. Mets `NEXT_PUBLIC_BASE_URL` à `https://ton-site.vercel.app`.

---

## 📄 Licence

[MIT](./LICENSE) — projet indépendant **non affilié** à Spotify ni à songspot.net.
Les extraits audio appartiennent à leurs ayants droit (Spotify / SoundHelix pour la démo) ;
aucune piste complète n'est téléchargée.

---

*Songspot FR — Next.js 15 · React 19 · Tailwind v4 · 95 titres FR · 300 tests Vitest · lint 0.*
