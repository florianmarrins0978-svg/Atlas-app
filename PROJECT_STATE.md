# État du projet

**Dernière mise à jour :** 2026-08-07 · branche `claude/migrate-app-atlas-zz31ac`
· dernière migration `drizzle/0024_envois_factures.sql`

*(Le numéro du dernier commit ne figure plus ici : il était faux dès le commit
suivant, et une ligne fausse coûte plus cher qu'une ligne absente. `git log
--oneline -20` le dit sans risque de se tromper.)*

Ce fichier dit **où en est le produit**, pas ce qu'on aimerait qu'il soit. Une
ligne « fait » qui ne l'est pas coûte plus cher qu'une ligne absente.

---

## Ce qu'est Atlas

Un agent au service de l'artisan patron, « comme un comptable » : il prépare les
devis, les envoie au client avec une proposition de date, recueille la réponse,
planifie le chantier, construit la facture à la fin, et tient le relevé de TVA
collectée.

Le parcours complet et ses points d'arrêt sont décrits dans **`docs/AGENT.md`** —
c'est le document de référence du produit.

**Trois arrêts, décidés et non négociables :**

1. Avant l'envoi du devis — une seule question : *une date, ou deux au choix du
   client ?*
2. À la réponse du client — le chantier se planifie, ou revient au patron.
3. Avant le départ de la facture — *rien n'a changé depuis le devis ?*

---

## Terminé et vérifié

### Le socle (antérieur à cette série de travaux)

Chantiers, photos, note vocale, transcription, informations structurées, calcul
du prix, devis PDF, planning, catalogue, réglages tarifs. Authentification
(Auth.js), isolation par entreprise (RLS `FORCE`), stockage de fichiers,
limitation de débit, purge planifiée, journalisation. Assistant IA en lecture
seule avec quinze outils.

### Le parcours devis → facture

| Brique | Où c'est |
|---|---|
| Envoi du devis au client, une ou deux dates | `src/app/chantiers/[id]/export/EnvoiAuClient.tsx` |
| Canal de communication recueilli à la création du chantier | `src/app/chantiers/nouveau/` |
| Jours libres du patron, calculés une seule fois pour tous les usages | `src/server/disponibilites.ts` |
| Page publique de réponse du client (sans session) | `src/app/devis/[jeton]/` |
| Cycle d'envoi, jeton, expiration, réponse | `src/server/repositories/envois-devis.ts` |
| Suivi de ce que devient le devis (5 états) | `src/lib/etat-envoi.ts` |
| Statut affiché d'un chantier, de brouillon à facturé | `src/lib/chantier-etat.ts` |
| Notification « devis retourné » à l'accueil | `src/app/Notifications.tsx` |
| Reprise d'un devis retourné en nouvelle version | `src/app/chantiers/[id]/export/actions.ts` |
| Onglet « Terminés » et fin de chantier | `src/app/termines/` |
| Facture bâtie depuis le devis, arrêt 3 | `src/app/chantiers/[id]/facture/` |
| Installation sur téléphone : icône, plein écran, marges de sécurité | `src/app/layout.tsx`, `src/app/globals.css`, `scripts/generer-icones.mjs` |
| Relevé de TVA collectée, par trimestre | `src/app/termines/tva/` + `src/server/trimestre.ts` |
| Devis PDF reprenant le modèle du patron, sur autant de pages qu'il faut | `src/server/pdf/devis-pdf.ts` |
| Découpage de la dictée en prestations, matériel, déchets, durée, équipe | `src/server/orchestrateur/analyse-demande.ts` |
| Planning en demi-journées et nombre d'équipes (le client ne voit que la date) | `src/server/disponibilites.ts` + `drizzle/0019_creneaux_et_equipes.sql` |
| Correction demandée par le client, avec son message porté au patron | `src/app/devis/[jeton]/formulaire.tsx` + `src/lib/etat-envoi.ts` |
| Écrire le devis soi-même, sans passer par la proposition de prix | `src/app/chantiers/[id]/informations/InformationsClient.tsx` → `prix?saisie=manuelle` |
| Transmission au client : messagerie ouverte **au bon destinataire**, canal changeable, coordonnée saisissable sur place | `src/app/chantiers/[id]/export/TransmettreAuClient.tsx` |
| **De la dictée au devis en un seul geste** : prestations, durée, équipe, prix, devis | `src/server/services/devis-depuis-dictee.ts` + `src/app/chantiers/[id]/DevisDepuisDictee.tsx` |
| La dictée est lue mot à mot quand aucun modèle ne répond — et l'écran le dit | `src/server/ai/lecture-litterale.ts` + `drizzle/0021_lecture_dictee.sql` |
| Rédiger le devis **entièrement à la main**, depuis la fiche du chantier | `src/app/chantiers/[id]/page.tsx` → `prix?saisie=manuelle` |
| Durée du chantier à la molette (½ journée → 100 jours), sur les deux écrans | `src/lib/durees-chantier.ts` + `src/app/chantiers/[id]/BandeDuree.tsx` |
| L'espace d'essai se met à jour seul, et l'application annonce sa version | `.devcontainer/mettre-a-jour.sh` + `src/server/version-executee.ts` |
| Créer un chantier sans rien saisir : son nom se déduit du client, de l'adresse, ou de la date | `src/lib/nom-chantier.ts` |
| **Le devis écrit à la main, document entier** : émetteur, IBAN, client, quantités, prix unitaires, TVA, conditions | `src/app/chantiers/[id]/devis-complet/` |
| **Emporter toutes ses données**, en un appui : un ZIP avec les 26 tables, les photos, les enregistrements et les PDF | `src/server/repositories/export-entreprise.ts` + `src/app/api/mes-donnees/` + `src/lib/archive-zip.ts` |
| **L'agent s'arrête et demande ce qui fait le prix** (technique, diamètre), et se tait sur le reste | `src/lib/questions-chiffrage.ts` + `drizzle/0022_precisions_chantier.sql` |
| **Il retient ce que le patron chiffre**, et le lui rappelle sur le chantier comparable suivant | `src/lib/lecons-prix.ts` + `drizzle/0023_lecons_prix.sql` |
| **L'adresse se propose pendant la frappe** et se choisit d'un doigt — Base Adresse Nationale, jamais Google, et le champ reste libre | `src/components/atlas/ChampAdresse.tsx` + `src/server/adresses/base-adresse-nationale.ts` |

### Conformité RGPD

| Brique | Où c'est |
|---|---|
| Registre des traitements, sous-traitants, conservation | `docs/RGPD.md` |
| Grille de choix des fournisseurs d'IA, et leurs tarifs relevés | `docs/TRANSCRIPTION.md` |
| Relevé des tarifs d'IA à leur source (le réseau de l'agent les refuse) | `.github/workflows/relever-tarifs-ia.yml` |
| Refus de démarrer en production avec l'IA simulée | `src/server/env.ts` |
| Ce que l'application utilise vraiment, dit à l'écran | `src/lib/etat-ia.ts`, `src/app/reglages/` |
| Acceptation des documents légaux, avec empreinte | `src/app/documents-legaux/` |
| Purge de l'audio après transcription réussie | `src/server/retention.ts` |
| Export des données d'un client | `src/server/repositories/donnees-client.ts` |
| Effacement d'un client, respectant la conservation légale | idem |

### Mise en ligne

L'application-coque statique (`appli/`) est publiée sur GitHub Pages à
`https://florianmarrins0978-svg.github.io/Atlas-app/`. Le workflow `.github/workflows/pages.yml`
vérifie le site **à son adresse publique** après déploiement.

**Ce site n'est PAS le produit.** Ce sont cinq maquettes reprises d'Arborea —
Nouveau devis, Devis, Factures, TVA déductible, Mes tarifs — sans base ni
serveur, et qui portent encore le nom d'Arborea. Elles ne montrent ni les
chantiers, ni le planning, ni l'envoi au client, ni la facture, ni la TVA
collectée. Un bandeau le dit désormais en tête de chaque écran : le patron
lui-même s'y était trompé, ce qui était prévisible et entièrement de notre
faute.

L'application Next.js, elle, **n'est hébergée nulle part** — voir « Ce qui
bloque ». Mais elle est **essayable en entier dès maintenant**, y compris depuis
un téléphone, via l'espace de travail décrit dans
[`docs/ESSAYER.md`](docs/ESSAYER.md). Distinguer les deux importe : l'essai ne
demande aucune décision, aucun compte et aucun budget ; seule la mise en
production les demande.

---

## Le lecteur du patron n'exécute pas JavaScript — les maquettes doivent s'en passer

**Constaté le 2026-08-10, et payé une fois.** Trois bancs d'essai lui ont été
envoyés avec leurs barres d'onglets construites en JavaScript. Chez lui, ils
arrivaient **vides** : les textes s'affichaient, les téléphones étaient des
rectangles nus. La contrainte était déjà écrite dans son propre fichier de
maquettes — « son lecteur n'en exécute pas ; les pages engendrées en JavaScript
lui arrivaient vides » — et n'existait nulle part ici.

Ce que cela impose à **toute maquette qui lui est destinée** :

- **Aucune balise `<script>`, aucun gestionnaire en ligne.** Le contrôle est
  mécanique : chercher `<script`, ` on…=`, `javascript:` dans la source.
- **Ce qui doit réagir au doigt se fait en CSS.** Une barre d'onglets se bâtit
  avec quatre `input[type=radio]`, des `label`, et
  `input:nth-of-type(n):checked ~ .trait`. Les colonnes étant égales, un onglet
  vaut exactement `translateX(100%)` : rien à mesurer.
- **Un repère qui suit le défilement se fait avec `position: sticky`**, pas
  avec un calcul. Une pastille collée à `top: 50%` dans la liste **est**, par
  construction, sur l'élément centré ; avec `scroll-snap-align: center` sur
  chaque ligne, celui-ci vient se caler dessous. Rien à mesurer, et surtout
  rien qui puisse se désynchroniser du défilement — ce qu'un suivi image par
  image finit toujours par faire sur un téléphone chargé. Trois pièges,
  éprouvés le 2026-08-10 :
  - **Le point d'ancrage détermine la position au repos.** Placé en tête de
    liste, le repère est déjà au centre avant tout défilement ; placé dans le
    flux à hauteur d'une ligne précise, il s'y tient jusqu'à ce qu'elle
    remonte. C'est ce second placement que le patron demande.
  - **Le `50 %` se calcule sur la boîte de contenu de la zone de défilement.**
    Un rembourrage bas posé sur cette zone la rétrécit et décale le repère de
    la moitié — la marge de fin qui permet à la dernière ligne d'atteindre le
    centre doit donc être posée sur le **contenu**, jamais sur le conteneur.
  - **`scroll-snap-stop: always` est ce qui fait « un élément à la fois ».**
    Sans lui, un geste vif saute trois lignes et le repère paraît sauter avec
    elles ; avec lui, chaque glissement avance d'une ligne et d'une seule.
    C'est ce que le patron demande — « elle glisse, elle s'arrête pile poil
    centrée » — et ça ne s'obtient pas en réglant l'accroche seule.
  - **L'accroche ne se vérifie pas à la molette synthétique.** Chromium sans
    interface ne l'applique pas : le contrôle rend la même valeur quelle que
    soit la correction. L'éprouver par un défilement programmé, auquel le
    moteur applique bien l'accroche.
- **Éprouver avec `javaScriptEnabled: false`.** Une page bâtie en JS passe tous
  les contrôles ordinaires et arrive quand même vide chez lui. Le contrôle
  ouvre la page dans ce mode, compte les onglets, et **charge en contre-épreuve
  une page bâtie en JS pour vérifier qu'il y en trouve zéro** — sans quoi il ne
  prouverait rien. Aucun script du dépôt ne le fait à ce jour : il vit dans
  l'espace de travail de la conversation, et devra être rapatrié ici le jour où
  des maquettes seront produites depuis le dépôt.

Cela ne concerne pas l'application elle-même, qui est un Next.js qu'il ouvre
dans Safari. Uniquement ce qu'on lui **transmet à lire**.

---

## Une identité visuelle est en cours de remplacement — ne pas se fier au code seul

**Constaté le 2026-08-10, hors du dépôt**, puis précisé en lisant ses maquettes.
Le patron explore une identité que rien ici ne mentionne. Elle est engendrée de
son côté par un script nommé `engendrer-maquette-fil.mjs`, **absent du dépôt**,
et ses pages portent la consigne « ne pas les modifier à la main ».

**Quatre chartes**, pas une, et l'accent n'est jamais le vert pin d'Arborea :

| Charte | Fond | Encre | Accent |
|---|---|---|---|
| Origine | `#edece6` | `#16170f` | `#8f7130` |
| Ivoire | `#efece6` | `#221f1a` | `#8a7452` |
| Sylve (sombre) | `#16241c` | `#e6e6da` | `#c3b184` |
| Océan | `#e6ecf2` | `#0d1b2c` | `#1e4f86` |

**Trois formes de liste** sont mises en concurrence : *le fil* (une tige
verticale porte les jours, une seule perle sur ce qui attend une réponse),
*l'ourlet* (un cheveu vertical qui prend la couleur d'attente là où un geste est
dû), *la plage amincie*.

Ce que cela change pour le code, et pourquoi c'est écrit ici :

- **La navigation basse perd ses icônes.** Quatre libellés en petites capitales
  — 9,5 px, `letter-spacing: .28em`, graisse 500 — en grille de quatre colonnes
  égales. L'onglet actif prend la couleur d'encre et **un trait d'un pixel sur
  toute la largeur de sa colonne** (`box-shadow: inset 0 -1px 0`), pas sous le
  seul mot. `AtlasBottomNav` code aujourd'hui l'inverse : icône + libellé,
  accent porté par la couleur du texte.
- **Deux refus explicites, à ne pas défaire :** aucun cheveu sous « ATLAS » —
  seul reste celui qui ferme l'en-tête, au-dessus de « Nouveau chantier » ; et
  la couleur ne décore pas, elle ne se pose que là où un geste est attendu.
- `src/lib/design-tokens.ts` et `docs/DESIGN_SYSTEM.md` décrivent donc une
  identité que le patron est en train de quitter.

### Ce que le patron a arrêté le 2026-08-10, sur maquettes

Cinq choix faits, après avoir touché chaque variante sur son téléphone :

| | Retenu | Ce que ça veut dire |
|---|---|---|
| Charte | **Origine** | fond `#edece6`, encre `#16170f`, bronze `#8f7130` |
| Trait du bandeau | **G** | il dépasse sa cible et revient ; le mot choisi monte de 2 px, le mot quitté redescend |
| La perle du fil | **elle suit** | posée devant le 22 juillet au repos, accrochée à mi-hauteur dès que ce chantier remonte, **un chantier par glissement** |
| « Nouveau chantier » | **l'écran recule** | la liste passe à 93 % et s'assombrit, la feuille monte devant, son contenu arrive après elle dans l'ordre de lecture |
| Retirer un chantier | **le tiroir des retirés** (P) | on fait glisser **le texte** de la ligne vers la gauche, « Retirer » se découvre ; la ligne **tombe** et un tiroir s'ouvre au-dessus du bandeau : « Retiré à l'instant — Annuler » |

**Ce que le retrait retenu suppose.** Le geste n'efface pas : il déplace vers
un état réversible tant qu'on est sur l'écran. Trois règles en découlent, et
elles ont été payées à l'essai sur la maquette :

- **La date et le fil ne glissent pas avec le texte.** Faire partir la ligne
  d'un bloc coupe le nom en plein mot et laisse le fil traverser les lettres :
  ça se lit comme un défaut d'affichage, pas comme un geste. Seule la colonne
  du texte bouge, et un voile de 16 px la fait se **dissoudre** au bord plutôt
  que d'être tranchée. La marge négative du glisseur et le retrait intérieur du
  volet s'annulent, sinon la première lettre est mangée **au repos**.
- **« Annuler » doit viser la ligne réellement retirée.** Un libellé unique
  pointant toujours la même case rend la première ligne quand on retire la
  deuxième — l'annulation *supprime*. Chaque ligne porte son libellé, et on
  n'affiche que celui du dernier retrait, détecté par
  `:has(#cN:checked ~ .sup:checked)`.
- **Le décompte suit ce qui reste.** « Huit en cours » au-dessus de six lignes
  est le genre de détail qui décide seul du sentiment de soin. Sans script, une
  chaîne de `~ .sup:checked` compte les cases cochées.

**Réserve :** le tiroir et le décompte reposent sur `:has()`. S'il manque, la
ligne part quand même mais le tiroir ne s'ouvre pas — dégradation acceptable,
à confirmer sur l'iPhone du patron. Dans l'application, le tiroir devra porter
un délai réel avant l'écriture en base ; la maquette, elle, ne fait que cacher.

**Aucun chantier facturé n'apparaît sur cet écran** — ils vivent sous
« Terminés ». Le refus (« sa facture figure au relevé de TVA ») se joue donc
là-bas, et c'est là qu'il faudra l'écrire.

**Conséquence assumée sur la perle**, signalée deux fois et maintenue : elle ne
désigne plus le chantier dont le devis est revenu, puisqu'elle suit le doigt.
Seul reste le libellé « Devis retourné », en bronze. Ne pas « corriger » cela
par erreur en croyant retrouver l'intention d'origine.

**Réserve non levée :** « Nouveau chantier » est aujourd'hui une **page**
(`/chantiers/nouveau`, avec sa flèche de retour vers la liste), pas une
feuille modale. L'ouverture retenue raconte une feuille. Soit l'écran devient
une vraie feuille — et la flèche cède la place à un geste de fermeture vers le
bas —, soit l'ouverture devra changer le jour de l'intégration. Le patron a
tranché sur le style ; ce point de produit reste ouvert.

### Le planning, et les équipes nommées — 2026-08-10

Deux écrans de plus ont été arrêtés le même jour, sur maquettes :
`maquettes/atlas-planning.html` (le mois, les demi-journées, les équipes) et
`maquettes/atlas-equipes.html` (Réglages : nommer les équipes). Les deux sont
tenus par `npm run verifier:maquette` ; la spécification d'intégration est dans
`docs/INTEGRER-ORIGINE.md` §6 ter, la suite technique dans `TODO.md` §5.

**La règle du nommage, qui n'est pas un détail d'affichage** — elle vient d'une
demande explicite du patron : *« s'il n'a pas d'équipe et qu'il ne met rien, il
ne faut pas qu'il y ait quand même écrit équipe A équipe B »*.

- **À une équipe**, le planning n'écrit **aucun nom d'équipe** : une
  demi-journée est libre, ou elle porte le nom de son chantier. Réglages ne
  propose même pas de la nommer — offrir un champ dont la valeur ne sera jamais
  lue est un piège.
- **À deux et plus**, chaque équipe a sa ligne dans Réglages. Le champ vide
  affiche déjà « Équipe A » en gris : le repli est **montré** avant d'être subi.

Le principe qui tient les deux cas : **on n'invente jamais un nom, et on ne
laisse jamais deux lignes indiscernables.** Conséquence pour la base :
`equipes.nom` sera **nullable** — un nom absent est un état normal, pas une
donnée manquante — et **une seule fonction pure** décidera du libellé, pour le
planning comme pour la revalidation.

**Rien d'autre n'est tranché, et rien n'a été codé dans ce sens.** Mais une conversation
qui lirait le dépôt seul repartirait en vert pin avec des icônes, c'est-à-dire à
contresens. Quand le choix sera arrêté, ce sont `design-tokens.ts`,
`globals.css`, `manifest.json`, `AtlasBottomNav` et `docs/DESIGN_SYSTEM.md` qui
changent ensemble — les cinq, sinon deux chartes coexisteront comme en juillet.

---

## Ce qui reste, et que je peux faire seul

Voir `TODO.md` pour le détail et l'ordre.

- **Agenda Google** — la connexion du compte demande des identifiants que je n'ai
  pas ; le reste (lecture des disponibilités, écriture de l'intervention) est
  codable.
- **Code SMS en renfort de l'acceptation** — l'empreinte, l'horodatage et
  l'adresse sont déjà conservés. **Sans objet en l'état**, pour la même raison.
- **Relance automatique** — l'état « à relancer » existe et s'affiche, le lien
  reste proposé pour un renvoi. **Sans objet en l'état** : aucun fournisseur
  d'envoi ne sera branché (`ARCHITECTURE.md` §13), la relance part de la
  messagerie du patron comme l'envoi.

---

## Ce qui bloque, et qui n'avancera pas en codant

**Quatre** points, tous dans **`docs/A-FAIRE.md`**, tous en attente d'une
décision du patron. Le cinquième — le fournisseur d'envoi — a été tranché le
2026-08-04 : il n'y en aura pas, et il est laissé barré ci-dessous pour éviter
qu'on le rouvre.

1. Choisir les deux fournisseurs d'IA définitifs (transcription, raisonnement).
   **Ce point a un effet visible tous les jours** : sans modèle, la dictée est
   seulement *recopiée*, jamais comprise. La recopie ne perd plus rien (voir
   `scripts/test-analyse-dictee.ts`) et elle mène désormais jusqu'au devis
   chiffré, mais elle ne sait pas qu'un chêne mort s'abat et qu'une haie se
   taille — et l'écran l'annonce plutôt que de la faire passer pour une analyse.
2. Faire rédiger le contrat de sous-traitance par un juriste.
3. Choisir un hébergement européen — **sans lui, personne d'autre que le patron
   ne peut se servir de l'application**. N'empêche NI d'essayer NI de finir le
   produit : voir `docs/ESSAYER.md`. La marche à suivre, les fournisseurs
   candidats et le partage des tâches sont détaillés dans `docs/A-FAIRE.md` §3.
4. Constituer une société et souscrire une assurance cyber.
5. ~~Brancher un fournisseur SMS et e-mail~~ — **tranché le 2026-08-04 : il n'y
   en aura pas** (`ARCHITECTURE.md` §13). Le patron ouvre lui-même sa
   messagerie, message et destinataire déjà remplis, et appuie sur envoyer.
   Ce point ne bloque donc plus, et il **allège** les points 2 et 3 : aucune
   donnée de client ne transitant chez un tiers, il n'y a aucun sous-traitant de
   plus à autoriser. Restent hors de portée, en conforts et non en blocages :
   relance automatique à sept jours, départ automatique de la facture, accusé de
   réception, code SMS à l'acceptation.

---

## Réserves assumées, à ne pas « corriger » par erreur

- **Atlas prépare, il n'émet pas.** La facture et le relevé de TVA sont
  préparés ; l'émission légale et la déclaration reviennent à l'outil comptable
  (`docs/AGENT.md` §6). Ce n'est pas « pas encore » : c'est définitif, et la
  réserve est affichée à l'écran du relevé.
- **Le dépôt est public**, décision du patron du 2026-08-01. `docs/RGPD.md` y
  compris. Voir `docs/QUESTIONS.md` §6 et §7.
- **La signature des commits est impossible** dans l'environnement d'exécution :
  la clé SSH configurée est un fichier vide sans partie privée. Signalé une fois,
  non contourné.
- **Une réponse à l'arrêt d'avant-chiffrage ne change pas encore le montant.**
  Ce n'est pas un oubli : `docs/EXEMPLE-DICTEE.md` §9c l'exige tant qu'aucun
  rapport n'a été observé entre les techniques et les prix. Ce qui manque est la
  mémoire (`TODO.md` §0 bis a et c), pas la question.
- **La sauvegarde *automatique* n'existe pas, et c'est un blocage réel** — pas
  un oubli. Elle exige une destination extérieure, donc l'hébergeur (point 3
  ci-dessus). Le bouton « Télécharger mes données » couvre l'essentiel en
  attendant. Voir `ARCHITECTURE.md` §25 et `TODO.md` §0.

---

## Éprouver ici : PostgreSQL et Redis tournent, sans Docker

**Corrigé le 2026-08-05, contre ce que le dépôt affirmait.** Docker manque bien,
mais les binaires PostgreSQL 16 et `redis-server` sont installés dans
l'environnement d'exécution de l'agent. Une commande monte le tout :

```bash
source scripts/monter-base-locale.sh   # cluster, rôles, Redis, migrations
npm test
```

La croyance inverse coûtait cher : « c'est la CI qui vérifiera » a été dit trois
fois alors que la CI n'avait jamais tourné, et les suites base n'étaient donc
éprouvées nulle part. **Cela ne remplace pas la CI** — le mandataire réseau et
l'absence de Docker restent réels pour le reste (voir `ARCHITECTURE.md` §15
et §17).

---

## Vérifications au dernier point

| | |
|---|---|
| Suites base de données | **61/61**, jouées dans l'environnement de l'agent |
| Suites navigateur (bout en bout) | 25/25 |
| Types, lint | propres |
| CI GitHub | verte au commit `78c746a` ; `07fa28c` en cours au moment d'écrire |
