# La pièce jointe du courriel à l'INRAE

**Ce que c'est.** Un document de trois pages A4, à joindre au courriel de
`docs/courriel-inrae.md`. Il montre, sur un exemple réel — l'anthracnose du
platane —, ce qu'Atlas fait d'une fiche Ephytia : l'écran obtenu, l'origine de
chaque ligne affichée, et ce que l'outil s'interdit.

**Pourquoi il existe.** Sa demande du 21 août 2026 : *« une photo tirée comme ça,
ça ne fait pas professionnel »*. Une copie d'écran brute jointe à une demande
d'autorisation adressée à un institut de recherche dit à peu près l'inverse de ce
que le courriel affirme sur le sérieux du travail.

## Regénérer le PDF

`document.html` est la source. Il appelle deux captures qui **ne sont pas dans le
dépôt** — `captures/` est ignoré, et une capture d'écran de deux mégaoctets n'a
rien à faire dans un historique où rien ne s'efface.

Il faut donc les refaire. Les deux tiennent en un script jetable, monté sur la
même mécanique que les suites navigateur :

1. monter la base et importer les fiches
   (`source scripts/monter-base-locale.sh`, puis
   `DATABASE_URL="$DATABASE_ADMIN_URL" npx tsx scripts/importer-fiches-phyto.ts donnees/phyto/fiches`) ;
2. démarrer le serveur, se connecter avec le compte de démonstration ;
3. poser un diagnostic **rendu** sur la fiche `anthracnose-platane` — en composant
   son résultat avec `composerResultat()`, jamais en le recopiant à la main
   (`CLAUDE.md` §3) ;
4. capturer l'écran de résultat dans `captures/inrae-ecran.png`, puis le bloc
   « D'où vient cette fiche » dans `captures/inrae-sources.png` ;
5. imprimer `document.html` en PDF avec Chromium (`page.pdf`, format A4,
   `printBackground: true`).

Les étapes 5 et 6 tiennent dans un script du dépôt, une fois les captures
faites :

```bash
node docs/piece-jointe-inrae/composer-pdf.mjs   # → captures/Atlas-INRAE.pdf
```

Il refuse de composer si une capture manque, mesure les trois pages **à la
largeur d'une A4**, et relit le PDF produit pour compter ses pages.

**Trois pièges rencontrés, et ils reviendront :**

- **la barre de navigation du bas mange la légende de la photo.** Elle est fixée
  au bas de la fenêtre : il faut une fenêtre haute (1500 px) et rogner
  au-dessus d'elle, sinon le crédit de l'image — précisément ce que le document
  doit montrer à l'INRAE — est coupé ;
- **une capture d'ÉLÉMENT colle au pixel près à sa boîte**, et le texte touche le
  bord. Capturer la région avec une quinzaine de pixels de marge.
- **le document se rend depuis `captures/`, jamais depuis `docs/`.** Ses deux
  `<img>` sont relatifs et les captures vivent dans `captures/`. Rendu depuis
  `docs/`, il compose sans une erreur et sans une page manquante — **et sans les
  photos**. Rien n'échoue, et le PDF ne prouve rien.

**Et mesurer les pages plutôt que de les supposer.** À 96 dpi, une A4 moins ses
marges laisse 1002 px de hauteur utile. **Mais mesurer À CETTE
LARGEUR-LÀ** : à 1280 px, la colonne fait presque le double, l'image du
téléphone posée en pourcentage grandit d'autant, et la page 1 s'annonce à
1468 px alors que le PDF tient en trois pages. Une mesure prise au mauvais
gabarit accuse à tort — 680 px de large (180 mm), et `emulateMedia('print')`. Une section plus haute déborde sur une
page suivante, ce qui ne se voit qu'une fois le PDF ouvert. Un aperçu qui mesure
la hauteur de chaque `section.page` et la compare à 1002 évite l'aller-retour ;
c'est ainsi que la première version, qui débordait de 148 px, a été prise.

## Ce qu'il reste à faire avant l'envoi

- **Le document ne porte ni nom ni entreprise** — c'est le courriel qui les
  porte. Si le patron préfère qu'il soit signé, l'ajouter en pied de page 3.
- **Vérifier que la photo montrée est toujours celle du domaine public** (USDA).
  Le document l'affirme noir sur blanc à l'INRAE : *« ici une photographie du
  domaine public, et non une photographie INRAE »*. Cette phrase devient fausse
  le jour où la fiche du platane recevra une image INRAE.
