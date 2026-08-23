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

### Ce qui a été établi sur cette photo, et ce qui ne l'a pas été

**Sa question du 23 août 2026 :** *« tu es sûr que la photo utilisée n'est pas
une photo de l'INRAE, parce qu'il ne faut pas les prendre pour des cons »*. Elle
est juste : c'est la seule affirmation du document qui pourrait se retourner
contre lui.

**Ce qui est vérifié dans le dépôt** — et qui tient :

| | |
|---|---|
| l'adresse enregistrée | `commons.wikimedia.org/wiki/Special:FilePath/Apiognomonia veneta leaf.JPG` — Wikimedia Commons, pas `ephytia.inrae.fr` |
| la seule image de TOUTES les fiches | une seule, celle-là ; aucune autre n'a d'image |
| aucune adresse INRAE/Ephytia | ne pointe vers un fichier image, nulle part |
| l'espèce photographiée | *Platanus occidentalis* — le platane d'Amérique, cohérent avec un cliché de l'USDA et non avec un relevé français |
| les figures d'Ephytia | **écartées à dessein** : deux portent un « © » nominatif (CHAMONT S. (INRA), Arnaud Giraudel, Jean-Pierre Henry) |
| l'import | **refuse** toute image dont la licence porte « © » ou « droits réservés » (`import-fiches-phyto.ts`, refus n° 7) |

**VÉRIFIÉ LE 23 AOÛT 2026 — et la vérification a corrigé quelque chose.** Le
mandataire réseau bloque `commons.wikimedia.org` depuis l'environnement de
l'agent, et la vignette servie par Commons ne porte aucune métadonnée : rien
n'était donc éprouvable ici. C'est le patron qui a ouvert la page sur son
téléphone et transmis trois captures.

| Ce que la page dit | Ce que le dépôt en a fait |
|---|---|
| bandeau **PD-USDA** — *« work of a United States Department of Agriculture employee, taken or made as part of that person's official duties […] the image is in the public domain »* | la licence enregistrée était **juste**, mot pour mot |
| **Author : Clemson University** | absent du dépôt |
| **Permission : « Cite: Clemson University - USDA Cooperative Extension Slide Series, Bugwood.org »** | le crédit disait « USDA, via Wikimedia Commons » — pas faux, mais **pas la citation demandée** |
| Source : Forestry Images / The Bugwood Network (University of Georgia, USDA Forest Service), image n° 1234089, 18 août 2003 | absent du dépôt |
| Description : *« Symptoms of the fungal plant pathogen Apiognomonia veneta on the leaf of a Platanus occidentalis tree »* | conforme à la légende enregistrée |

**Le crédit a donc été corrigé** pour porter la citation que la source réclame,
dans la fiche, sous la photo à l'écran et dans l'annotation n° 4 du document.
Une demande d'autorisation qui cite mal une autre source se dessert elle-même —
et c'est précisément la question que le patron a posée : *« il ne faut pas les
prendre pour des cons »*.

**La leçon, plus large que cette photo :** une licence recopiée sans la page qui
la porte laisse passer ce que la page EXIGE en plus. Le contrôle d'intégrité
compare le fichier source à la base ; il ne compare rien à l'original hors du
dépôt. Pour toute image future, relever aussi le champ **Permission** de la page
Commons, pas seulement son bandeau de licence.

**Si la photo change un jour**, la page à rouvrir est
<https://commons.wikimedia.org/wiki/File:Apiognomonia_veneta_leaf.JPG>. Sans
bandeau de domaine public, la photo sort de la fiche et le document se refait :
la phrase de la page 1 deviendrait fausse.
