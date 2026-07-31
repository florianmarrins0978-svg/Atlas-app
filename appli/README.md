# appli/ — l'application Arborea

Copie de l'application du dépôt [`Arborea-`](https://github.com/florianmarrins0978-svg/Arborea-) :
les écrans, la coque Capacitor et la batterie de tests. **Le site vitrine n'a
pas été repris** (`index.html`, `index-classic.html`, `images/`) : ce dossier
ne contient que l'outil de travail.

C'est du HTML/CSS/JS statique, sans build ni serveur : chaque écran est un
fichier autonome, et les données du patron (grille de tarifs, devis en cours)
restent dans le `localStorage` de son appareil.

> À ne pas confondre avec l'application Next.js à la racine du dépôt, qui est
> un projet distinct : elle a un serveur, une base de données et des routes API.
> Les deux cohabitent sans interférer — aucun fichier partagé, aucun outillage
> commun.

## Les écrans

| Fichier | Écran |
|---|---|
| `app.html` | Accueil de l'espace pro |
| `devis-vocal.html` | Note de chantier dictée → devis proposé |
| `devis-modele.html` | Devis (édition, PDF, envoi au client) |
| `facture-modele.html` | Facture |
| `tva-modele.html` | TVA déductible |
| `mes-tarifs.html` | Grille de tarifs du patron |
| `nav.js` | Barre de navigation partagée par tous les écrans |
| `index.html` | Point d'entrée : redirige vers `app.html` |

`PRINCIPES.md` est la référence de conception — notamment la règle absolue :
**l'IA n'invente jamais un prix**. Un poste absent de la grille reste vide et
signalé en rouge, jamais deviné.

## Développer

```bash
cd appli
npm install
python3 -m http.server 8080     # puis ouvrir http://127.0.0.1:8080/
```

## Tester

Obligatoire avant chaque mise en ligne — voir [`tests/README.md`](tests/README.md).

```bash
BASE_URL=http://127.0.0.1:8080 npm run test:e2e
```

Sortie attendue : `✅ PASS: 52   ❌ FAIL: 0`.

## Publier

Tout `push` sur `main` touchant à `appli/` déclenche
[`.github/workflows/pages.yml`](../.github/workflows/pages.yml), en trois temps :

1. **Tests** — la batterie tourne sur les fichiers du dépôt. S'il en manque un
   seul, rien n'est publié et la version en ligne reste celle d'avant.
2. **Publication** — `appli/` est envoyé sur GitHub Pages et servi à la racine
   du site projet.
3. **Vérification du site en ligne** — chaque écran est demandé à l'adresse
   publique, on contrôle que la racine mène bien à l'appli, puis **toute la
   batterie est rejouée contre le site réel**.

L'étape 3 n'est pas un doublon de l'étape 1 : entre les deux se glissent le
découpage de l'artefact, la propagation, le chemin de sous-dossier et le passage
en HTTPS. Elle vérifie ce que l'artisan ouvrira vraiment, pas ce que contient le
dépôt.

## Applications iOS & Android

Voir [`CAPACITOR.md`](CAPACITOR.md) : `npm run build:www` assemble le bundle
`www/`, puis `npx cap add ios|android`. Les dossiers `www/`, `ios/`, `android/`
et `node_modules/` sont régénérés et ignorés par git.
