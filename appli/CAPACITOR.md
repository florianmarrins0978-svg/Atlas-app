# Arborea — App iOS & Android (Capacitor)

Ce dépôt produit **deux choses à partir d'un seul code** :

1. **La version web** (GitHub Pages) — le lien
   `…github.io/Atlas-app/`. Le site vitrine n'étant pas repris dans ce dépôt,
   la racine mène directement à l'accueil de l'appli (`app.html`). Elle
   fonctionne exactement comme avant, indépendamment de tout ce qui suit.
   Idéale pour tester et partager instantanément.
2. **Les apps iOS & Android** (App Store / Google Play) — la même appli, emballée
   dans une coque native grâce à [Capacitor](https://capacitorjs.com).

> La coque **n'a rien changé** aux écrans. Elle les entoure. La batterie de
> tests (`tests/e2e.js`) garantit que la version web reste sans bug.

---

## Ce dont on a besoin pour publier sur les stores

- **Node.js** (déjà requis pour les tests).
- **iOS** : un **Mac** avec **Xcode**, et un compte **Apple Developer**
  (**99 $/an**). La soumission à l'App Store ne peut se faire que depuis un Mac
  avec ton compte — personne ne peut le faire à ta place.
- **Android** : **Android Studio** (gratuit) et un compte **Google Play**
  (**25 $ une seule fois**). Se construit sur Mac, Windows ou Linux.

---

## Générer et lancer les apps

```bash
# 1. Installer les dépendances
npm install

# 2. Construire le bundle web de l'appli (dossier www/)
npm run build:www

# 3. Ajouter les plateformes (une seule fois)
npx cap add ios        # nécessite un Mac + Xcode
npx cap add android    # nécessite Android Studio

# 4. À chaque changement du code : régénérer + synchroniser
npm run cap:sync

# 5. Ouvrir dans l'outil natif pour builder / tester / soumettre
npx cap open ios       # ouvre Xcode
npx cap open android   # ouvre Android Studio
```

Les dossiers `www/`, `ios/`, `android/` et `node_modules/` sont **régénérés** et
donc ignorés par git (voir `.gitignore`).

---

## Point important : la dictée vocale dans l'app native

Le navigateur mobile (Safari/Chrome) fournit la reconnaissance vocale
gratuitement (API Web Speech), et **c'est ce qu'utilise la version web**.

Mais la **vue web intégrée** des apps natives (iOS/Android) ne fournit pas cette
API. Concrètement, dans l'app des stores :

- **Tout fonctionne** : écrans, tarifs, devis, PDF, envoi… et on peut **taper**
  la note de chantier (repli automatique déjà prévu — aucun plantage).
- **La dictée** aura besoin d'un **plugin natif** :
  [`@capacitor-community/speech-recognition`](https://github.com/capacitor-community/speech-recognition).
  On l'ajoutera au moment du vrai build natif, avec une détection de plateforme
  (Web Speech dans le navigateur, plugin natif dans l'app). Le point de
  branchement est déjà isolé dans `devis-vocal.html`.

De même, le partage du devis utilise l'API web `navigator.share` (fonctionne en
mobile) avec repli e-mail ; pour un partage 100 % natif, on pourra brancher
[`@capacitor/share`](https://capacitorjs.com/docs/apis/share).

---

## Permissions à déclarer (au build natif)

- **iOS** (`Info.plist`) :
  - `NSMicrophoneUsageDescription` — « Pour dicter vos chantiers. »
  - `NSCameraUsageDescription` — « Pour scanner vos factures (TVA). »
- **Android** (`AndroidManifest.xml`) :
  - `android.permission.RECORD_AUDIO`
  - `android.permission.CAMERA`

---

## Icône & écran de lancement

Placer une icône (1024×1024 PNG) et lancer un générateur d'assets
(`@capacitor/assets`) avant le build. `appId`/`appName` se règlent dans
`capacitor.config.json` (actuellement `com.arborea.app` / « Arborea » —
modifiables).
