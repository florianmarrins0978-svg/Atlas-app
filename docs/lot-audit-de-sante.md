# Audit de santé du code Atlas — ce qui a été trouvé, ce qui a été fait

**5 septembre 2026.** Premier passage complet du dépôt en lecture seule
(1 857 fichiers suivis), puis le lot de corrections qui en découle.

Sa demande, en une ligne : *« oui espace le partout et fait les 4 »*.

---

## En un coup d'œil

| | |
|---|---|
| **Défauts visibles par l'utilisateur** | **un seul** — la visionneuse de photos, illisible sur deux apparences sur huit |
| Corrections livrées | 5 |
| Code mort retiré | 5 exports, 1 jeu de données, 3 scripts |
| Contrôles neufs | 2 (numéros de migration, or sur l'encre) |
| Ce que j'avais annoncé et qui était faux | **2 points, corrigés plus bas** |
| Ce qui reste ouvert | 2, dont un qui demande sa décision |

---

## Ce qui est SAIN, et qu'il faut dire en premier

Un audit qui ne rapporte que le mauvais fait croire que tout est mauvais. Sur
1 857 fichiers, voici ce qui a été cherché et **pas** trouvé :

| Cherché | Trouvé |
|---|---|
| `TODO`, `FIXME`, `HACK`, `XXX`, `WORKAROUND` laissés dans le code | **aucun** — les 24 occurrences sont des renvois à `TODO.md`, pas des aveux |
| accès direct à la base hors `withEntreprise` | 13, et **les 13 portent leur raison écrite** (catalogue partagé, table d'authentification, transactions) |
| maquettes `/design` servies en production | **non** — et le contrôle qui l'empêche APPELLE la mise en page au lieu de lire le fichier, donc il ne peut pas être trompé par un code commenté |
| suites qui rendent un vert sans rien mesurer | **aucune** dans ce qui a été lu : elles refusent de conclure sur une liste vide ou une boîte de zéro pixel |
| empilement de rustines | **aucun** — les gardes ouverts un par un portent tous leur date, leur raison, et ce qui avait été écarté |

C'est le résultat le plus important de cet audit, et il n'était pas acquis.

---

## Les cinq corrections, point par point

### 1. La visionneuse de photos était illisible sur Nuit et Sylve — CORRIGÉ

| | |
|---|---|
| **Le fichier** | `src/app/chantiers/[id]/Pellicule.tsx`, lignes 225-250 |
| **Le symptôme** | photo ouverte en plein écran, la croix pour sortir et le mot « Retirer » disparaissent dans le fond |
| **La mesure** | **1,09 sur Nuit, 1,12 sur Sylve** (il en faut 4,5 pour un texte) |

**Pourquoi.** Cet écran prend l'encre de la charte pour FOND, afin qu'on ne voie
que la photo. Sur les six apparences claires l'encre est presque noire, et tout
se lit. **Sur Nuit et Sylve l'encre est CLAIRE** — on posait donc un crème sur un
crème.

C'est exactement la faute du 22 août 2026, celle qui avait fait naître `surPlein`
après sa capture *« le mode nuit est illisible »*. Elle avait corrigé huit
endroits ; celui-ci, écrit le 11 août, en faisait un neuvième que personne n'a vu.

**Pourquoi personne ne l'a vu, et c'est le plus intéressant :**

- **aucune capture ne la montre** — la visionneuse exige qu'une photo soit
  ouverte, et aucune capture d'écran du dépôt ne l'ouvre ;
- **aucune suite ne l'ouvre** non plus ;
- **le contrôle des chartes ne pouvait pas la voir** : il mesure les chartes,
  jamais ce qu'un écran en fait. C'est sa propre leçon, écrite le 5 septembre au
  matin dans `ARCHITECTURE.md` §257 — et elle s'est vérifiée le soir même.

Ce défaut a donc été trouvé **par le calcul**, sur les valeurs de `chartes.ts`,
sans regarder un écran. C'est une première dans ce dépôt : les quatre défauts de
lisibilité précédents étaient tous sortis d'une image.

**Ce qui a été fait.**

| | |
|---|---|
| la croix et les pastilles | `surPlein` et `voile(surPlein, 0.12)` — les jetons qui existaient déjà pour ça |
| le mot « Retirer » | un jeton **neuf**, `orSurEncre` |

**Son doré ne bouge pas.** Sa consigne du 31 août — *« tout ce qui est en doré
sur la version originale apparaisse en doré sur les autres apparences »* — est
tenue au caractère près :

| | valeur du mot « Retirer » | contraste | avant |
|---|---|---|---|
| Origine, Brume, Pierre, Beurre, Moka, Prune | `#b98b47` — **inchangé** | 4,98 à 5,81 | inchangé |
| Sylve | `#806031` | 4,59 | 2,44 |
| Nuit | `#826231` | 4,56 | 2,49 |

**Pourquoi un jeton neuf et pas `orTexte`.** Les deux vont en sens contraire :
`orTexte` s'écarte du FOND (donc s'éclaircit sur une charte sombre), `orSurEncre`
s'écarte de l'ENCRE (donc s'assombrit). Employer l'un pour l'autre corrigerait
l'apparence qui n'en a pas besoin et laisserait intacte celle qui en a besoin.

**Le contrôle sait échouer**, et cela a été vérifié : `orSurEncre` ramené à `or`
fait rougir Nuit et Sylve, et elles seules.

### 2. Le numéro du client se lit espacé — CORRIGÉ

| | |
|---|---|
| **Le fichier** | `src/app/clients/[id]/page.tsx` |
| **Avant** | `0679984514` |
| **Après** | `06 79 98 45 14` |

`numeroLisible` existe depuis le 12 août 2026, et sa raison d'être est écrite
noir sur blanc : *« dix chiffres collés ne se vérifient pas d'un coup d'œil »*,
après qu'un devis n'est pas parti à cause d'une coordonnée mal relue. **Elle
n'avait qu'un seul appelant** — l'écran d'envoi. La fiche du client est pourtant
l'autre endroit où l'on vérifie qu'on a le bon client.

**« Partout » veut dire les endroits où le numéro se LIT. Trois endroits ont été
délibérément laissés, et voici pourquoi :**

| | pourquoi on n'y touche pas |
|---|---|
| les cases du devis | on y **tape** le numéro. L'espacer changerait ce qui s'enregistre en base, et le dépôt tient deux conventions de rangement, chacune justifiée |
| l'écran de la facture | le destinataire y a été **retiré à sa demande**. Le remettre pour l'espacer serait réclamer ce qu'il a fait enlever |
| les capsules « SMS / E-mail » | elles ne montrent pas le numéro, seulement le mot et « · absent » |

Le numéro se lit donc à **deux** endroits en tout, et les deux l'espacent.

### 3. Deux migrations ne peuvent plus prendre le même numéro — CORRIGÉ

| | |
|---|---|
| **Le fichier neuf** | `scripts/test-numeros-migrations.ts` (4 contrôles, verts) |

**Ce que l'audit a compté :** **onze numéros pris deux ou trois fois**, soit
vingt-quatre fichiers. `TODO.md` n'en connaissait qu'un depuis le 27 août, et le
comptait à deux fichiers là où il y en a trois.

**Rien ne casse aujourd'hui, et ce n'est pas une supposition :** chaque groupe a
été relevé, tables créées contre tables touchées, et aucun couple de même numéro
n'a de dépendance croisée. Chaque migration est suivie par son NOM de fichier,
donc les vingt-quatre s'appliquent bien, une seule fois.

**Ce qui n'est pas garanti, c'est l'ORDRE.** Il vient d'un tri alphabétique du
nom complet. Une base reconstruite depuis zéro les applique dans un ordre que
personne n'a choisi — et le jour où deux migrations de même numéro se toucheront,
la panne ne se verra pas sur les bases existantes : seulement en production, ou à
la restauration d'une sauvegarde.

**Ce que ce contrôle ne demande PAS :** renommer quoi que ce soit. Un fichier
déjà en ligne qui changerait de nom se **rejouerait** sur toute base à jour. Les
onze sont inscrits comme des faits acquis. Le contrôle ne défend que le douzième.

**L'asymétrie qu'il corrige, et qui est la vraie trouvaille :** les paragraphes
en double d'`ARCHITECTURE.md` avaient reçu leur garde-fou le 26 août. Les
migrations, non. **Le document était protégé, la base ne l'était pas.**

### 4. Cinq exports morts, et un commentaire qui promettait une garde — RETIRÉ

Cherchés par nom dans `src/`, `scripts/`, `drizzle/` et `appli/` — imports
directs, appels indirects, routes, configuration.

| | ce que c'était |
|---|---|
| `enComposantes` | annonçait « ce qu'attend `pdf-lib` », et **le PDF ne l'a jamais appelée** : il fait la conversion lui-même. Ce n'était pas une aide, c'était **une seconde source de vérité endormie** |
| `reservéAuPatron` | promettait *« les pages qui doivent quand même refuser, côté serveur »*, et n'était appelée par personne |
| 3 exports de `mock-data.ts` | données de maquettes d'avant leur découplage du 1er août |
| `mockChantiersTest` (69 lignes) | atteignable par une seule des fonctions ci-dessus |
| 3 scripts du tout premier commit | visaient un chemin de navigateur Linux et une adresse absente en production |

**Sur `reservéAuPatron`, à lire attentivement : aucun trou d'accès n'a été ouvert
ni comblé.** La garde existe, ailleurs et mieux — chaque écran pose la sienne, et
une adresse tapée à la main est refusée par la mise en page racine. Le défaut
était la **phrase**, qui désignait le mauvais endroit : elle rejouait, à trois
lignes de distance, la faute que le paragraphe voisin raconte en détail.

**Corrigé au passage :** un commentaire de `chantier-etat.ts` annonçait une
réexportation vers `mock-data.ts` qui n'existe plus, et faisait craindre de casser
les maquettes en ajoutant un état au produit.

### 5. Quatorze contrôles de maquettes rejoignent la chaîne — FAIT, mais voir ci-dessous

Les quinze contrôles endormis ont été **joués un par un** :

| | |
|---|---|
| verts | **13** |
| vert mais lent (74 s) | 1 — `verifier-maquette-bascule.mjs` |
| **rouge** | 1 — `verifier-maquette-logo.mjs`, « Page crashed » sous Playwright |

Les quatorze verts sont entrés dans `verifier:maquette`, qui compte désormais
77 maillons. **Le rouge est resté dehors, délibérément** : un maillon rouge dans
une chaîne en `&&` barre tout ce qui suit, et le dépôt l'a payé dix heures le
23 août 2026.

---

## CE QUE J'AI DIT ET QUI ÉTAIT FAUX

Deux verdicts de mon propre rapport ne tenaient pas. Les écrire vaut plus que les
points justes.

### A. « `estPort` : est-ce un oubli de validation ? » — NON

J'avais relevé qu'un contrôle de vocabulaire sur cinq n'était appelé nulle part,
et suggéré qu'un champ puisse ne pas être validé. **C'était faux.** Le champ en
question est validé **à l'entrée**, plus tôt et mieux, par le schéma d'import.
La fonction était redondante, pas manquante. Elle a été retirée pour cette
raison-là, pas pour celle que j'avais écrite.

### B. « Quinze contrôles ne sont jamais joués » — VRAI, ET À CÔTÉ

C'est plus large que ce que j'avais écrit, et dans le mauvais sens. Ces quinze
n'étaient pas exclus d'un garde qui tourne :

**rien ne lance `verifier:maquette`** — ni la CI, ni la batterie de livraison, ni
aucun script. Les cinquante maillons qui y étaient déjà dorment **exactement
autant** que les quinze qui n'y étaient pas.

Compléter la chaîne était donc utile mais insuffisant. Le vrai défaut est
au-dessus, et il demande un arbitrage — voir plus bas.

---

## Ce qui a été REFUSÉ, et ce que ça aurait coûté

| Refusé | Pourquoi |
|---|---|
| brancher la page du client sur les couleurs des documents | il a tranché le 4 septembre : *« non, garde les couleurs d'origine »*. Le « faire propre » aurait défait un arbitrage rendu planche en main |
| espacer le numéro dans les cases où on le tape | cela changerait ce qui s'enregistre en base |
| réafficher le destinataire sur l'écran de la facture pour l'espacer | il l'avait fait retirer |
| renuméroter les onze migrations en double | elles se rejoueraient sur toute base à jour |
| ajouter `verifier-maquette-logo.mjs` à la chaîne | rouge : il aurait barré les 76 autres |
| vider `mock-data.ts` complètement | ce fichier sert de MARQUE à un contrôle : un écran du produit qui l'importerait serait refusé. Le vider retirerait un garde-fou |

---

## Les chiffres

| | |
|---|---|
| `tsc --noEmit` | **0 erreur** |
| `lint` | **0 erreur**, 18 avertissements — **tous antérieurs**, aucun sur les fichiers de ce lot |
| `test-chartes-lisibles` | **14 / 14** (avec le couple neuf) |
| `test-numeros-migrations` | **4 / 4** (fichier neuf) |
| `test-maquettes-hors-production` | vert |
| `test-rubriques-reglages` | vert |
| `test-numero-lisible` | vert |
| `test-ligne-etat-chantier` | vert |
| `test-reglages-gardes` | vert |
| `test-import-fiches-phyto` | vert |
| `test-allure-documents` | vert |
| contrôles de maquettes réveillés | 14 verts sur 15 |

**LA BATTERIE COMPLÈTE N'A PAS ÉTÉ JOUÉE, et il faut le savoir.** Deux raisons,
et la seconde est la sienne :

1. il a demandé le 4 septembre à être **prévenu avant toute batterie**, ses
   sessions partageant le dossier ;
2. **une autre de ses sessions travaillait dans le même arbre pendant ce lot** —
   123 suites modifiées pour centraliser l'adresse du serveur et paralléliser les
   suites navigateur. Mesurer par-dessus aurait rendu des chiffres qui n'accusent
   personne.

Rien de ce lot ne touche ces 123 fichiers, et rien d'eux n'a été commité ici.

---

## Ce qui reste ouvert

### 1. Où la chaîne des maquettes doit-elle se jouer ? — SA DÉCISION

**Le constat :** 77 contrôles gardent les planches qu'il ouvre depuis son
téléphone, et **personne ne les lance**.

| | ce que ça coûte | ce que ça donne |
|---|---|---|
| **une étape dans la CI** *(ma recommandation)* | 10 à 20 minutes sur GitHub, rien sur sa machine. Playwright y est déjà installé | la chaîne tourne à chaque poussée |
| dans la batterie de livraison | les mêmes minutes **sur sa machine**, à chaque lot | rien de plus : ces contrôles gardent des planches, pas l'application |
| ne rien faire | rien | 77 contrôles qui rassurent sans rien garder |

**Une réserve honnête :** la CI est rouge sur `main` depuis le 2 septembre. Y
ajouter une étape maintenant noierait un rouge dans un autre. À faire une fois la
CI revenue au vert.

### 2. `verifier-maquette-logo.mjs` plante — n'importe quelle session

« Page crashed » sous Playwright, sur la planche du motif du sceau.
**Non diagnostiqué** : cela peut venir de la planche comme de l'environnement.
Laissé hors de la chaîne en attendant.

---

## Ce que je n'ai PAS pu vérifier

Un audit qui tait ses angles morts se lit comme un audit complet.

- **Aucun écran regardé.** Les contrastes sont **calculés**, pas mesurés à
  l'écran. Le dépôt rappelle que quatre défauts réels sont sortis d'une capture
  et d'aucun test — je n'ai pas eu ce moyen-là.
- **Aucune base montée**, aucune migration appliquée. L'affirmation « aucune
  dépendance croisée entre migrations de même numéro » vient de la lecture du
  SQL, pas d'une reconstruction depuis zéro.
- **Non parcourus faute de temps** : l'écran du planning (2 551 lignes), le
  schéma de la base (2 752), le calcul d'arrosage (2 843 — et c'est le domaine
  « sans droit à l'erreur »), les 91 migrations en détail, les 664 scripts
  autrement que par leur nom, et tout `src/server/ai/`.
- **La duplication fine** — deux fonctions presque identiques à quelques lignes
  près — demanderait une comparaison de contenu qui n'a pas été menée. Seuls des
  noms et des rôles ont été comparés.
