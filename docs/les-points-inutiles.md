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

---

## Le garde-fou — 23 septembre 2026

Sa demande du lendemain : *« mets cette règle en garde-fou, que les sessions
futures ne recommencent pas à mettre des points inutiles là où elles peuvent
faire des phrases »*.

`scripts/test-aucun-tiret.ts` (qui a absorbé celui des points le 23 septembre,
voir plus bas), joué par `npm test`, donc par la
batterie. Il lit les 152 000 lignes de `src/`, commentaires retirés, et refuse
tout « · » qui n'est pas déclaré **avec sa raison** :

| Déclaré | Pourquoi |
|---|---|
| les conditions générales | des puces, dans un texte déjà publié et accepté |
| `/design/a`, `/design/b` | hors produit |
| le fournisseur d'IA de développement | rien de ce qu'il écrit n'atteint un écran |
| la consigne envoyée au modèle | mise en forme pour lui, pas pour l'écran |

Les trois fichiers qui **retirent** des points d'une saisie sont ignorés : les
faire rougir reviendrait à demander de retirer le nettoyage.

**Son message ne dit pas seulement non**, il donne la phrase à écrire : une
espace quand elle se lit seule, une virgule quand l'espace collerait deux
nombres, un mot de liaison quand il en faut un.

**Et il sait échouer** : confronté à un point remis dans `Notifications.tsx`,
il rougit et nomme la ligne. Vérifié, pas supposé.

### Ce que le garde-fou a trouvé au passage

Les deux contrôles de style — points et flèches — lisent désormais le code par
le même module, `scripts/_sans-commentaires.ts`. Deux copies auraient divergé,
et la copie d'origine avait déjà un trou : elle prenait le « // » d'une adresse
`https://…` pour un commentaire et cessait de lire la ligne.

En la remplaçant, deux commentaires de `dev.ts` ont surgi : une expression
régulière `/['"]/` y ouvrait une chaîne qui n'a jamais existé, et cinq cents
lignes échappaient au contrôle des flèches. La lecture des chaînes s'arrête
maintenant à la fin de leur ligne — seule une chaîne à gabarit peut contenir un
retour à la ligne, c'est la règle du langage.

## Le check-up du 23 septembre

`main` avait avancé de **63 commits** depuis le relevé.

| | |
|---|---|
| des points neufs ? | **non**, aucun |
| un point retiré par quelqu'un d'autre ? | **oui, un** : le rapport d'intervention du client. Une autre session l'a corrigé le 22 septembre, sur la même règle. Sa version est gardée — elle va plus loin : « Mardi 22 septembre chez M. Bernard », une phrase, le jour en gras |
| après fusion | **zéro** point du milieu de phrase dans ce que le produit affiche |


---

## Les deux trous que SA question a trouvés — 23 septembre 2026

*« Si dans la maquette il met des points n'importe où, quand il va pousser sur
main il va pousser avec les points ? Donc c'est pas bon. »*

Il a raison deux fois : la planche est ce qu'il OUVRE depuis son téléphone, et
une planche validée se recopie en code — c'est le chemin normal de ce dépôt.

### 1. Les maquettes

Le contrôle lit désormais ce qu'un lot **ajoute** sous `appli/` et
`maquettes/`. Pas le reste : **2 320 points dorment dans 231 planches**, dont
des dizaines d'essais archivés. Les faire rougir toutes, c'est un garde-fou
éteint dans la journée — c'est la règle qui fait vivre celui des pansements
depuis le 7 septembre, et la mécanique est maintenant partagée avec lui.

Éprouvé : un point ajouté dans une planche le fait rougir et nomme la ligne.

### 2. Le catalogue d'arrosage — et celui-là était DANS l'application

Le contrôle ne lisait que le TypeScript. `src/lib/arrosage/catalogue.js` est un
`.js` : **61 libellés y portaient un point**, et ils partent sur le plan, dans
la liste des pièces, et chez le fournisseur.

| Avant | Après |
|---|---|
| `PGP-ADJ · buse 1 (rouge std)` | `PGP-ADJ buse 1 (rouge std)` |
| `escamotable 10 cm · SAM` | `escamotable 10 cm, SAM` |
| `2,5 bar · par 20` | `2,5 bar, par 20` |

Corrigés dans les **deux** copies du catalogue — celle de l'application et
celle de la page publiée —, qui restent identiques à la ligne près
(`verifier-arrosage-une-seule-source.mjs` le vérifie).

Sept maquettes citaient ces libellés en dur : elles suivent le catalogue.

### Un contrôle qui tenait au point lui-même

`verifier-maquette-arrosage-plan.mjs` isolait le modèle d'une buse en
**découpant sur le point médian**. Le point parti, il rendait le nom entier,
ne le retrouvait pas dans la liste des pièces, et rougissait sur du code juste.
Il lit maintenant le mot « buse ». C'est sa règle du 20 août : un contrôle ne
doit pas réclamer ce qu'il a fait retirer.

### Et la lecture partagée avait un trou

`https://` n'est pas un commentaire : le « // » d'une adresse coupait la ligne
en deux, et tout ce qui suivait devenait invisible au contrôle. Corrigé, avec
le commentaire `<!-- -->` des maquettes ajouté au passage.

## Ce qui reste, et qu'il faut savoir

| | |
|---|---|
| les 2 320 points des planches archivées | laissés. Il ne les rouvrira pas, et les corriger ferait rougir leurs vérificateurs |
| **7 générateurs de maquettes** en écrivent encore (99 points) | régénérer l'une de ces planches fera rougir le contrôle. C'est voulu : c'est le bon moment pour corriger le générateur, puisque la planche repart chez lui. `TODO.md` le porte |
| les tirets `—` | deuxième relevé, toujours à faire |

---

## Les deux lots combinés — 23 septembre 2026

Sa demande : *« j'ai une session qui taffe sur les tirets, combinez-vous »*.

Une autre session traitait la même règle par l'autre bout, et **son contrôle
refusait déjà le point médian**. Deux contrôles pour une règle, c'est la
divergence assurée (`CLAUDE.md` §3) : un seul reste, **le sien**, parce qu'il
lit l'arbre TypeScript pour savoir où sont les vraies chaînes — là où celui-ci
lisait caractère par caractère. `test-aucun-point-median.ts` est supprimé.

| Ce qui vient de son lot | Ce qui vient de celui-ci |
|---|---|
| le garde-fou d'écriture, qui refuse la phrase avant qu'elle soit posée | la lecture des **`.js` de `src/`** : 10 tirets de plus trouvés dans le catalogue |
| le refus à la poussée vers `main`, **même en niveau 1** — une maquette est inerte, donc aucun contrôle ne s'y jouait | le NOM d'un matériel sans virgule : « PGP-ADJ buse 1 » |
| les phrases, meilleures : « Devis en attente depuis 5 jours » | le contrôle de la maquette du plan, qui tenait au point médian |
| les tirets, partout | l'exception des conditions générales, que nous avions posée tous les deux |

**Ce qui n'est pas visé** : `maquettes/`, que `pages.yml` ne publie pas. 398
lignes y portent encore un tiret ou un point — des planches sans adresse, qu'il
ne peut pas ouvrir depuis son téléphone.
