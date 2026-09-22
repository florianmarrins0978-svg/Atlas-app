# Les points au milieu des phrases — relevés, puis retirés

Sa règle du 22 septembre 2026, devant « Probable · Peuplier » : *« Plus jamais
tu mets de point entre le nom et probable ! Retiens pour les autres fiches, et
plus jamais de tiret, fais des phrases normales. »*

Puis sa demande : *« va me chercher tous les · qui servent à rien dans
l'application comme le 6 à facturer · 19 facturés »*.

Puis son arbitrage, une fois le relevé sous les yeux : *« pour dernière
prestation tu peux remplacer le · par le "le". Pour les autres supprime-les
simplement. Ne lance aucune batterie. »*

---

## Ce qui a été fait

| | |
|---|---|
| relevé dans `src/`, commentaires du code retirés | **123 lignes, 149 points** |
| **retirés** — écrans, documents qui partent chez ses clients, écrans techniques | **72 lignes, toutes** |
| laissés : les conditions générales | 42 lignes — voir plus bas |
| laissés : hors produit — `/design`, fournisseur d'IA de développement, consigne envoyée au modèle | 6 lignes |
| laissés : faux positifs — du code qui **retire** des points d'une saisie | 3 lignes |

**Il reste zéro point du milieu de phrase dans ce que le produit affiche.**

## Par quoi chacun a été remplacé

Sa consigne était « supprime-les simplement ». Elle a été suivie à la lettre
**partout où l'espace seule se lit** :

| Avant | Après |
|---|---|
| `F-2026-019 · émise le 12 août` | `F-2026-019 émise le 12 août` |
| `Jardin Martin · ½` | `Jardin Martin ½` |
| `Devis · n° 12` | `Devis n° 12` |
| ` · vous` (catalogue) | ` vous` |
| ` · absent` (fiche de chantier) | ` absent` |
| `6 à facturer · 19 facturés` | `6 à facturer  19 facturés` — l'œil sépare déjà les deux comptes |

**Et par une virgule là où l'espace seule collait deux nombres, ou changeait
le sens.** « 12 août 1 250 € prévus » se lit comme un seul nombre coupé ;
« Devis envoyé à relancer » ne dit plus la même chose que « Devis envoyé, à
relancer » :

| Avant | Après |
|---|---|
| `BROUILLON · SANS PHOTO` · `À VÉRIFIER · 6 PHOTOS` | `BROUILLON, SANS PHOTO` · `À VÉRIFIER, 6 PHOTOS` |
| `Devis envoyé · à relancer` | `Devis envoyé, à relancer` |
| `Devis en attente · 5 jours` | `Devis en attente, 5 jours` |
| `12 août · 1 250 € prévus` | `12 août, 1 250 € prévus` |
| `Facturé le 20 août · F-2026-019` | `Facturé le 20 août, F-2026-019` |
| `44300 Nantes · Devis 5 sept.` | `44300 Nantes, Devis 5 sept.` |
| `2 chantiers · complet` | `2 chantiers, complet` |
| `06 12 34 56 78 · 12 rue des Lilas` | `06 12 34 56 78, 12 rue des Lilas` |
| `Probable · Peuplier` | `Probable, peuplier` |
| `Matin · 2 demi-journées · équipe Nord` (PDF) | `Matin, 2 demi-journées, équipe Nord` |
| `15 SAMU · 18 Pompiers` (PDF de sécurité) | `15 SAMU, 18 Pompiers` |
| `2 à 4 m de haut · tronc de ⌀ 20 cm` | `2 à 4 m de haut, tronc de ⌀ 20 cm` |

**Et le seul remplacement qu'il a dicté :**

| Avant | Après |
|---|---|
| `DERNIÈRE PRESTATION · 12 août` | `DERNIÈRE PRESTATION le 12 août` |

## Pourquoi pas « Probable sur un peuplier »

`CLAUDE.md` §3 donne cette phrase en exemple, et elle demande un genre — « un »
peuplier, « une » aubépine. **Aucune donnée du dépôt ne porte ce genre** : ni la
table des taxons, ni la fiche. L'écrire reviendrait à le deviner, ce que la même
règle interdit (*« ce qui a besoin d'un genre se lit dans la donnée, jamais
deviné »*). L'écran dit donc « Probable, peuplier » — et la phrase complète
reste possible le jour où le genre entre en base.

## Trois choses trouvées en chemin, qui n'étaient pas dans la demande

1. **La version servie était comparée par son point.** `demarrer.sh` écrit
   `%cd · %h · branche` dans `ATLAS_VERSION`, `version-executee.ts` écrit le
   même format, et `version-servie.ts` compare les deux **caractère pour
   caractère** pour dire si le serveur est en retard sur le dépôt. Changer un
   seul des deux aurait fait annoncer « en retard » en permanence dans
   Réglages. Les deux ont été changés ensemble.
2. **Le point portait une marge de 5 px sur la ligne des clients.** Une boîte
   flexible mange l'espace qui la commence : la marge existait pour que le
   point ne colle pas à l'adresse. Une virgule, elle, doit coller au mot
   qu'elle suit — la marge est partie avec le point.
3. **`abonnements.ts` remplaçait un tiret par un point** — les deux caractères
   qu'il refuse, l'un mis à la place de l'autre. C'est une virgule maintenant.

## Les contrôles qui réclamaient un point

Sa règle du 20 août : quand une suite rougit après un retrait qu'il a demandé,
**on adapte le contrôle, on ne remet pas le libellé**. Neuf suites le
réclamaient :

| La suite | Ce qui a changé |
|---|---|
| `test-libelle-occupation`, `test-planning-jour`, `test-ligne-etat-chantier`, `test-termines-par-mois`, `test-grille-prix`, `test-abonnements` | le libellé attendu suit le libellé rendu |
| `test-devis-qui-tarde-e2e`, `test-fiche-chantier-pdf` | idem |
| `test-version-executee` | il cherchait un point pour prouver qu'aucune branche n'est inventée sur un arbre détaché : il cherche la virgule |
| `test-diagnostic-ecrans-e2e` | il exigeait « un point médian » entre le crédit et la licence |
| `test-catalogue-mes-mots-e2e` | **visé plus profond** : il cherchait `/· vous/` dans toute la page. Le mot « vous » se lit partout ; la marque porte désormais un repère, `data-atlas="mes-mots-marque"`, qui survivra au prochain remaniement du libellé |

Deux suites interdisaient DÉJÀ le point — `test-fiche-client-e2e` et
`test-travaux-a-faire-e2e` : elles restent vertes, et elles gardent la règle.

## Ce qui n'a pas été touché, et pourquoi

| | |
|---|---|
| **les 42 points des conditions générales** | ce sont des puces de liste et des séparateurs de tableau dans un document juridique **déjà publié et accepté**. Les modifier demande une nouvelle version et une nouvelle acceptation par chaque compte : c'est sa décision, pas une correction de forme |
| **les maquettes** (`appli/`, `maquettes/`, les `engendrer-*`) | des planches déjà tranchées. Les réécrire ferait rougir leurs vérificateurs sans rien changer à l'application |
| **les commentaires du code** | ils ne s'affichent pas. Seuls ont été corrigés ceux qui CITAIENT un libellé d'écran — un commentaire périmé se relit comme vrai |
| **les tirets `—`** | sa deuxième règle du jour. Ce lot ne porte que les points ; le relevé des tirets reste à faire |

## Ce qui a été vérifié — et ce qui ne l'a pas été

**Sa consigne : aucune batterie.** Elle n'a donc pas été jouée.

| Joué ici | Verdict |
|---|---|
| `npx tsc --noEmit` | **vert** |
| `npm run lint` | **vert** (0 erreur ; 41 avertissements, tous antérieurs) |
| les six suites de règles pures adaptées | **vertes**, 9+9+…, 0 échec |
| l'écran d'accueil, regardé connecté | `BROUILLON, SANS PHOTO` · `À VÉRIFIER, 6 PHOTOS` — le point est bien parti |

| Pas vérifié | Pourquoi |
|---|---|
| Terminés, Ma TVA, le diagnostic, l'arrosage, la fiche client | le jeu de démonstration n'a ni chantier terminé, ni facture, ni photo de croquis, ni fiche de passage. **Pas vérifiable ICI** |
| les suites navigateur, les suites base | c'est la batterie, et elle n'a pas été lancée |

**Ce lot est de niveau 3** — il touche la TVA, les devis et les règlements, et
`abonnements.ts` atteint 68 points d'entrée. Le garde-fou de `main` exigera
`npm run verifier:avant-livraison` avant toute fusion : **rien n'arrivera sur
son espace tant que la batterie n'aura pas été jouée**, et c'est lui qui dit
quand.
