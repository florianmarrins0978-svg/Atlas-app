# État du projet

**Dernière mise à jour :** 2026-08-03 · branche `claude/app-name-choice-hk5jz4`
· dernier commit `08cfdff` · dernière migration `drizzle/0018_factures.sql`

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

### Conformité RGPD

| Brique | Où c'est |
|---|---|
| Registre des traitements, sous-traitants, conservation | `docs/RGPD.md` |
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

## Ce qui reste, et que je peux faire seul

Voir `TODO.md` pour le détail et l'ordre.

- **Agenda Google** — la connexion du compte demande des identifiants que je n'ai
  pas ; le reste (lecture des disponibilités, écriture de l'intervention) est
  codable.
- **Code SMS en renfort de l'acceptation** — l'empreinte, l'horodatage et
  l'adresse sont déjà conservés.
- **Relance automatique** — l'état « à relancer » existe et s'affiche, le lien
  reste proposé pour un renvoi ; l'automatiser suppose un fournisseur d'envoi.

---

## Ce qui bloque, et qui n'avancera pas en codant

Cinq points, tous dans **`docs/A-FAIRE.md`**, tous en attente d'une décision du
patron :

1. Choisir les deux fournisseurs d'IA définitifs (transcription, raisonnement).
2. Faire rédiger le contrat de sous-traitance par un juriste.
3. Choisir un hébergement européen — **sans lui, personne d'autre que le patron
   ne peut se servir de l'application**. N'empêche NI d'essayer NI de finir le
   produit : voir `docs/ESSAYER.md`. La marche à suivre, les fournisseurs
   candidats et le partage des tâches sont détaillés dans `docs/A-FAIRE.md` §3.
4. Constituer une société et souscrire une assurance cyber.
5. Brancher un fournisseur SMS et e-mail — **sans lui, rien ne quitte
   l'application** : le lien du devis est remis au patron, qui le transmet
   lui-même, et la facture attend le même branchement.

---

## Le terrain n'est pas vierge : deux concurrents directs

Découverts le 2026-08-03 **en cherchant un nom** — pas au cours d'une étude de
marché. C'est écrit ici parce qu'une conversation qui l'ignore raisonnerait
comme si le créneau était libre, et il ne l'est pas.

| Concurrent | Ce qu'il a pris | Ce qu'on en apprend |
|---|---|---|
| [`ouvra.app`](https://ouvra.app/) — SAS Automate, Paris | **Un métier** : plombiers-chauffagistes uniquement. Devis signé sur place, Factur-X 2026, relances automatiques. Catalogue de prestations pré-rempli, TVA du secteur. | Se restreindre à un métier permet de livrer un catalogue et des mentions légales *déjà justes*. C'est exactement ce que notre §3 d'`AGENT.md` refuse de deviner. |
| [`fabro.app`](https://fabro.app/en/) — app iOS artisans | **L'absence de réseau** : 100 % hors ligne, données sur le téléphone, multi-pays. | Sur un chantier, il n'y a pas de réseau. Notre parcours suppose l'inverse à chaque étape. |

**Notre angle reste distinct** : ni l'un ni l'autre ne part de la **dictée** ni
ne fait travailler un **agent** entre la note vocale et la facture. Ils
numérisent un formulaire ; nous supprimons le formulaire. Mais l'angle n'est
plus une évidence à ne pas défendre.

## Le nom « Atlas » est provisoire, et probablement indéposable

« Atlas » n'a jamais été choisi ni vérifié : c'est un nom de travail. Le mot est
massivement occupé dans les classes 9 et 42, ce qui rend le dépôt de marque et
la visibilité App Store douteux. **Un nom définitif est en cours d'arbitrage
avec le patron** (branche `claude/app-name-choice-hk5jz4`) ; rien n'est renommé
tant qu'il n'a pas tranché.

Onze candidats ont déjà été écartés sur occupation vérifiée — Silex, Ouvra,
Vulcain, Sève, Orme, Fabro, Amadou, Braise (voisin de Braze), entre autres. La
leçon vaut pour les suivants : **vérifier l'occupation avant de proposer**, un
mot ordinaire libre en classes 9/42 est devenu l'exception.

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

---

## Vérifications au dernier point

| | |
|---|---|
| Suites base de données | 44/44 |
| Suites navigateur (bout en bout) | 23/23 |
| Types, lint | propres |
| CI GitHub | verte au commit `78c746a` ; `07fa28c` en cours au moment d'écrire |
