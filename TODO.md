# Prochaines tâches

Par ordre de priorité. Une tâche terminée se **barre** avec sa date plutôt que
de disparaître : savoir qu'elle a été traitée évite de la rouvrir.

Ce fichier porte le travail de **développement**. Ce qui bloque et n'avancera
pas en codant est dans `docs/A-FAIRE.md` — tenu pour le patron, dans son
langage, et rien n'y entre sans son accord.

---

## Bloqué par une décision du patron

Rien à coder tant que ces points ne sont pas tranchés. Ne pas les redécouvrir :
ils sont écrits, avec leur coût et leur propriétaire, dans `docs/A-FAIRE.md`.

| | Ce qui débloque | Ce que je fais alors |
|---|---|---|
| 1 | Deux fournisseurs d'IA retenus | **Le code n'attend plus rien pour Anthropic et OpenAI** depuis le 2026-08-06 : poser `ANTHROPIC_API_KEY` ou `OPENAI_API_KEY` suffit à brancher l'IA (`ARCHITECTURE.md` §26), et `npm run verifier:ia` dit l'état réel. Les quatre autres noms restent des coquilles vides : leur raccordement serait à écrire. Ce qui bloque n'est donc plus la technique mais le **contrat** — sans lui, seules des données inventées peuvent être dictées. Sans clé, la dictée est recopiée mot à mot (`src/server/ai/lecture-litterale.ts`) : elle va jusqu'au devis chiffré, mais elle ignore qu'un chêne mort s'abat et qu'une haie se taille |
| 2 | Contrat de sous-traitance rédigé | Remplacer les canevas sans valeur par les textes réels |
| 3 | Hébergement européen choisi | Déployer — **sans quoi personne ne peut se servir de l'application** |
| 4 | Société constituée, assurance souscrite | Rien côté code |
| 5 | ~~Fournisseur SMS et e-mail~~ — **tranché le 2026-08-04 : il n'y en aura pas** | Rien de bloqué. Le devis part de la messagerie du patron (`ARCHITECTURE.md` §13). Ne restent suspendus qu'aux conforts : relance automatique, accusé de réception, code SMS |
| 6 | Outil comptable choisi — le patron n'en a **aucun** au 2026-08-08 | Brancher son API : envoyer client, lignes, montants, taux et période, récupérer le numéro et le document émis. Quelques jours. **Rien à écrire avant le choix** — chaque outil a son API, ce serait du code à jeter. Ce qui n'est PAS en jeu : qu'Atlas n'émette pas légalement est définitif (`docs/AGENT.md` §6) |

---

## Ce que je peux faire seul

### 0 septies. Les deux portes de la création — **en attente de son choix**

**Sa demande du 11 août 2026, au soir :** *« on ne voit que création de chantier,
on ne voit pas devis à la main. Il faut qu'on puisse voir les deux, dans un style
très luxueux et très moderne. »*

Six propositions ont été montrées (`docs/maquettes/14-les-deux-portes.html`).
**Il a retenu la n° 4, la bascule**, et demandé plus élégant : six déclinaisons
de cette seule idée sont dans `docs/maquettes/15-la-bascule-affinee.html` — le
trait qui glisse, le point d'or, la plage, la perle, le cartouche, la bascule en
pied. **Rien n'est appliqué au produit tant qu'il n'a pas choisi laquelle** —
appliquer d'office reviendrait à trancher à sa place une question qu'il a posée.

Ce qui a fait retenir la bascule, et qui ne se rediscute pas : **deux boutons à
égalité obligent tout le monde à trancher**, alors que neuf fois sur dix la
réponse est « je dicterai ». C'est la raison pour laquelle le lien discret avait
été retenu le matin même. La bascule est la seule forme qui montre les deux
chemins sans rien demander — un seul bouton, dont le mot suit le choix.

Une fois le choix fait : le geste ne change pas (`creerPuisAller("fiche" |
"devis")`, une seule fonction de création), seule la mise en page du bloc
d'actions bouge, dans `FormulaireNouveauChantier.tsx`. **Et la porte du tiroir
sur la fiche chantier reste** : ce sont deux moments, pas deux chemins.

### ~~0 ter. Les suites navigateur mesuraient un écran que personne ne possède~~ — **close le 2026-08-11**

**Trouvé le 11 août 2026, et le patron l'a payé.** Les suites posaient un cadre
de 393 × 852. La hauteur **utile** d'un vrai iPhone 13, barre du navigateur
déduite, est de 390 × **664** (`devices["iPhone 13"]` de Playwright). Sur ce
cadre trop haut, un contrôle de chevauchement passait au vert alors que, sur son
téléphone, la bulle de l'assistant recouvrait « ou rédiger le devis à la main ».

**Fait.** L'écran vit désormais dans `ECRAN_DU_PATRON` (`scripts/e2e-browser.ts`)
et toutes les suites en héritent ; deux tolérances écrites à la main sont tombées
avec (« 400 px » de débordement toléré sur un écran de 393 ; une grille cadrée à
393 au lieu de 390).

**Ce que ça a trouvé : rien.** 46/47, l'unique rouge étant un dépassement de
délai du serveur de développement. Il fallait quand même le faire — un contrôle
qui mesure un écran inventé ne prouve rien, vert ou rouge — mais le dire tel
quel : le cadre honnête n'a révélé aucun défaut caché.

**Ce qui manquait vraiment**, et qui existe maintenant :
`scripts/test-rien-de-recouvert-e2e.ts`, qui cherche sur quatorze écrans ce que
le doigt n'atteint pas. Un seul écran vérifiait cela auparavant, pour un seul
bouton.

### ~~0 bis. Une session périmée~~ — **close le 2026-08-10, test compris**

`GET /api/session-perimee` efface les cookies et renvoie à la connexion ;
`GardeDocumentsLegaux` (layout racine) et `getCurrentCtx` y mènent.
`scripts/test-session-perimee-e2e.ts` le tient en cinq contrôles, dont un
parcours dans un vrai navigateur, JavaScript coupé.

**Trois défauts que ce test a trouvés, et qu'il faut connaître avant de toucher
à ce coin du code** (le détail est dans `CHANGELOG.md` du 2026-08-10) :

1. Une redirection lancée depuis une **page** ne peut pas être un 307 : elle
   rend sous la frontière de `src/app/loading.tsx`, où l'enveloppe est déjà
   partie. Next.js répond alors 200, et le renvoi est joué en JavaScript. Tout
   contrôle d'accès qui doit valoir sans JavaScript vit dans le **layout**.
2. `NextResponse.redirect` fabrique une adresse absolue depuis `request.url`,
   c'est-à-dire l'adresse d'**écoute** (`0.0.0.0`). Derrière le relais du
   patron, elle ne mène nulle part. Renvoyer relatif.
3. « Compte disparu » et « compte sans entreprise » ne se traitent pas pareil :
   effacer la session du second l'enfermerait dans une boucle
   connexion → effacement → connexion.

#### La forme d'origine du défaut, pour mémoire

**Constaté chez le patron le 10 août 2026, sur son banc.** Son navigateur
portait la session d'un compte de démonstration supprimé par un nouveau seed.
Le cookie restait valide, `auth()` rendait donc un `utilisateurId` — et
`resoudreEntrepriseId` levait `AucuneEntrepriseError`, qui n'est **attrapée
nulle part** (`src/server/session-ctx.ts`). Résultat : toutes les pages en 500,
et un écran qui ne dit rien de ce qu'il faut faire.

**Ce qu'il faut, et pourquoi ce n'est pas une ligne de code :** une session
valide sans adhésion doit ramener à l'écran de connexion, **et la session doit
être révoquée** — sinon la page de connexion renvoie vers l'accueil, qui
renvoie vers la connexion, en boucle. `getCurrentCtx` sert aussi les actions
serveur et les routes d'API : le remède doit valoir pour les trois, sans
affaiblir l'isolation. À écrire avec un test qui reproduit la panne : session
signée d'un utilisateur sans adhésion.

**En attendant**, le contournement est écrit dans `docs/ESSAYER.md` : ouvrir en
navigation privée, ou rejouer le seed.


### 0. Le banc d'essai tient debout — ~~à faire~~ **fait le 9 août 2026**

Veilleur qui relance le serveur mort, préchauffage de seize écrans, garde contre
un second serveur, et construction possible sans les secrets de production.
`ARCHITECTURE.md` §43 et §44.

**Ce qui reste sur ce sujet, et que je dois encore faire :**

- **Le chemin de MISE À JOUR n'est toujours pas éprouvé par la CI.** Elle bâtit
  un banc neuf à chaque fois ; le défaut des migrations du 9 août est passé par
  ce trou, et un autre y passera. Il faut un banc qui existe déjà, qui reçoit du
  code neuf, migrations comprises.
- **Le navigateur d'essai manque au conteneur.** `npm run verifier:connexion`
  tombe sur une pile Playwright illisible au lieu d'une phrase. À installer, et
  à faire dire une ligne claire quand il manque.
  **Précision du 9 août** : dans l'espace de travail de l'agent, le navigateur
  EST installé — mais sous `/opt/pw-browsers/chromium-1194`, alors que la
  version de Playwright du dépôt en réclame un autre numéro de build. Le
  message « Executable doesn't exist… run npx playwright install » envoie donc
  chercher une installation absente au lieu d'une version qui ne correspond
  pas. Contournement éprouvé : `chromium.launch({ executablePath:
  "/opt/pw-browsers/chromium" })` — c'est ce que fait
  `scripts/verifier-maquettes-page-unique.mjs`.
- **Les PDF et la dictée ne sont pas mesurés** — le premier exige un vrai
  stockage, la seconde un appel facturé. Dit plutôt que supposé.


### 0. La sauvegarde des données — À FAIRE, dans cet ordre

**Décidé avec le patron le 5 août 2026.** Il a demandé explicitement que ce
point soit écrit : *« oublie pas de le faire, note-le, enregistre-le ! »*

| | Quoi | Quand | État |
|---|---|---|---|
| **a** | ~~**Bouton « Télécharger mes données »** dans Réglages. Un fichier arrive sur son téléphone. Aucun terminal, aucun compte, aucune dépendance.~~ | | **fait le 2026-08-05** |
| **b** | **Sauvegarde automatique**, sans qu'il ait à y penser. | **Dès que l'hébergement est choisi** (point 3 de `docs/A-FAIRE.md`) | bloqué |

**(a) est livré.** Un ZIP contenant les vingt-trois tables de l'entreprise, ses
photos, ses enregistrements et ses PDF, plus un mode d'emploi qui dit ce que le
fichier contient de sensible. Les choix et ce qu'ils écartent sont dans
`ARCHITECTURE.md` §26 ; le code dans `src/server/repositories/export-entreprise.ts`,
`src/app/api/mes-donnees/route.ts` et `src/lib/archive-zip.ts`.

**Ce qui le garde honnête, et qu'il ne faut pas défaire :**
`test-export-entreprise.ts` interroge `information_schema` et **échoue si une
table portant un `entreprise_id` n'est pas exportée**. Une table ajoutée demain
et oubliée disparaîtrait sinon des sauvegardes sans un bruit. En ajouter une
sans l'exporter fera rougir la batterie — c'est voulu.

**Pourquoi (b) ne peut pas se faire maintenant, et il faut le redire à chaque
fois que la question revient :** une sauvegarde automatique doit déposer son
fichier quelque part.

- **Pas dans le dépôt** : il est public. Y écrire une base contenant les noms et
  adresses des clients serait une fuite, pas une sauvegarde.
- **Pas sur le disque de l'espace de travail** : c'est précisément ce dont on
  cherche à se protéger, puisqu'il disparaît avec l'espace.
- **Il faut donc une destination extérieure** — celle de l'hébergeur, ou un
  stockage objet que le patron n'a pas encore.

**Ce que (a) débloque :** il pourra nourrir la mémoire de l'agent sans craindre
de tout perdre au passage en ligne. C'est la condition qu'il a posée lui-même
pour commencer — voir `docs/A-FAIRE.md` §1 bis.

**Ne pas confondre avec l'export RGPD existant.**
`src/server/repositories/donnees-client.ts` exporte les données **d'un client**,
pour répondre à une demande d'accès. Ce qu'il faut ici est l'inverse : **toutes
les données de l'entreprise**, pour les emporter ailleurs.

### 0 ter. L'agent demande ce qui coûte de l'argent — ~~à faire~~ **fait le 6 août 2026**

**Choisi par le patron en QCM le 6 août 2026**, devant la mémoire des
corrections et l'entretien de départ : *« Les questions qui coûtent de
l'argent. »* Et la règle, confirmée le même jour : *« il demande si ça change le
prix, il signale sinon »* (`docs/EXEMPLE-DICTEE.md` §7).

L'agent s'arrête désormais **avant de chiffrer** quand il manque ce qui fait le
prix. Sur la dictée du chêne mort : la technique et le diamètre, absents de la
note, et qui font passer l'abattage de 600 à 1 400 €.

| Où | Quoi |
|---|---|
| `src/lib/questions-chiffrage.ts` | Les règles du métier, pures — ce qu'on demande **et ce qu'on tait** |
| `drizzle/0022_precisions_chantier.sql` | Ses réponses, qui survivent à une relecture de la dictée |
| `src/server/services/devis-depuis-dictee.ts` | L'arrêt, et la reprise **sans rappeler le modèle** |

**Ce que ça ne fait PAS — à ne pas croire acquis.** La réponse est enregistrée
et s'écrit sur la prestation ; **elle ne change pas encore le montant**. C'est la
règle du patron lui-même (`EXEMPLE-DICTEE.md` §9c) : tant qu'aucun rapport n'a
été observé entre les techniques et les prix, l'agent demande le prix plutôt que
d'en fabriquer un. Il manque la mémoire, pas la question.

**Ce qui le débloquerait**, dans l'ordre : (a) puis (c) ci-dessous. Dès qu'il
existe deux devis d'abattage avec leur technique, le rapport se calcule et le
montant peut se proposer — arrondi à la dizaine d'euros HT (`§9b`), et présenté
comme un **rappel** de la dernière fois, jamais comme un calcul non sourcé.

### 0 quater. La mémoire des corrections — ~~à faire~~ **faite le 6 août 2026**

**Choisi par le patron le 6 août 2026**, devant l'entretien de départ et les
photos. Ce qu'il chiffre sur un devis est désormais retenu, et lui revient sur
le chantier comparable suivant.

**Ce que ça a révélé :** `historique_prix` existait, était lue par le chiffrage
— et **n'était jamais écrite par l'application**. Seuls les tests l'alimentaient.
Une mémoire que personne ne remplit n'est pas une mémoire.

| Où | Quoi |
|---|---|
| `src/lib/lecons-prix.ts` | Ce qui se rapproche, ce qui ne se rapproche **pas**, et le rappel |
| `src/lib/arrondi-prix.ts` | « En HT on fait des prix ronds » (§9b), enfin appliqué |
| `drizzle/0023_lecons_prix.sql` | Une leçon par ligne de devis, jamais une de plus |
| `devis-complet` | Le rappel sous la ligne, et « Reprendre ce prix » |

**Pourquoi une table de plus plutôt qu'`historique_prix`.** Celle-ci s'appuie
sur `catalogue_prestations`, catalogue **partagé** repéré par nom canonique :
elle ne sait pas distinguer un abattage au pied d'un démontage avec rétention —
les deux seules choses qui font passer le même chêne de 600 à 1 400 €. Une
mémoire aveugle à cette distinction rappellerait un prix faux de 800 € avec
l'autorité de l'expérience.

**Trois garde-fous à ne pas défaire :**

- **Un rappel, jamais un calcul** (`EXEMPLE-DICTEE.md` §9c). La phrase dit d'où
  vient le chiffre et de quel chantier. Rien ne s'applique tout seul.
- **Le rapprochement se trompe dans le bon sens.** Les diamètres sont groupés
  par tranche de dix centimètres, au plus proche ; une frontière subsiste, et
  elle fait **manquer** un rappel, jamais en fabriquer un faux. Élargir le
  rapprochement échangerait un manque contre une erreur.
- **L'apprentissage ne gêne jamais le travail.** Une ligne dont on ne sait rien
  tirer s'enregistre quand même.

**Ce qui reste ouvert :** le rapport entre techniques (×1,67, ×2,33 — §9a),
qui demande plusieurs devis comparables. La mémoire l'accumule désormais ; la
règle se calculera quand il y aura de quoi.

### 0 quinquies. Lignes vendables et grille de fendage — ~~à faire~~ **fait le 8 août 2026**

Ce qui est en place, et qu'il ne faut pas refaire :

- le découpage en lignes vendables (`src/lib/lignes-vendables.ts`), avec le
  billonnage compris dans l'abattage ;
- la grille de fendage hauteur × diamètre, 8 × 6 cases, née vide, remplie à la
  main **et** par ses devis (`src/lib/grille-prix.ts`).

Détail des choix : `ARCHITECTURE.md` §29.

**Ce qui reste ouvert, et qu'il faut lui demander plutôt que de trancher seul :**

| | Question | Pourquoi ça presse un peu |
|---|---|---|
| a | **Les tranches lui conviennent-elles ?** 8 diamètres × 6 hauteurs, bornes hautes incluses. | Changer les bornes plus tard rend introuvables les prix déjà rangés. C'est facile aujourd'hui, coûteux après trente devis. |
| b | **L'abattage mérite-t-il la même grille ?** Il se chiffre déjà à la technique et au diamètre, mais sans liste que le patron puisse voir et compléter. | Question posée le 8 août, restée sans réponse. |
| c | **La taille de haie devrait-elle avoir sa propre ligne ?** Son devis de référence du 5 août en compte trois — haie 350 €, abattage 600 €, fendage 300 € — quand l'application en produit deux. | Séparer la haie du chêne demanderait de répartir un tarif global entre eux, c'est-à-dire d'inventer deux prix. La fente a le droit à sa ligne parce qu'elle a une grille ; la haie n'en a pas encore. |
| d | **Autre chose que la fente se détache-t-il ?** Le dessouchage, l'évacuation seule, l'enlèvement des grumes. | Aujourd'hui la fente est le seul cas connu — parce que c'est le seul qu'il ait décrit. |

**Et une limite à connaître avant de promettre quoi que ce soit :** seuls les
devis **nés d'une dictée** nourrissent `corrections_dictee`. Un devis écrit
entièrement à la main n'apprend rien sur la façon de LIRE une dictée — c'est
délibéré (il n'y a pas d'écart à mesurer), mais cela veut dire que sa phrase
*« je fais plein de devis et dans un mois tu sauras les remplir tout seul »* ne
vaut que pour les devis dictés. La grille de fendage, elle, se remplit dans les
deux cas.

### 0 sexies. Le PDF d'une liste de prix — à trancher avec le patron

L'import d'une liste de prix accepte **Excel et CSV** (`ARCHITECTURE.md` §31).
Le **PDF est refusé**, avec un message qui donne la sortie : « Ouvrez la liste
dans Excel puis Enregistrer sous → CSV ».

**Pourquoi refusé plutôt que deviné.** Un PDF est une image de tableau : plus de
colonnes, seulement des morceaux de texte à des coordonnées, souvent dans un
encodage propre au document. Un prix lu de travers arrive sur le devis d'un
client — c'est précisément ce que `docs/AGENT.md` §3 interdit.

**Question posée le 8 août, et tranchée : « le tableur suffit ».** Le sujet est
donc clos, et ce point ne se rouvre que s'il change d'avis. Les deux pistes sont
gardées ci-dessous pour qu'on n'ait pas à les réinventer ce jour-là.

| | Piste | Ce que ça vaut |
|---|---|---|
| a | Faire lire le PDF par le modèle déjà branché, et lui faire valider l'aperçu comme aujourd'hui | Marche sur les PDF scannés comme sur les autres. Coûte des jetons, et demande d'envoyer le fichier chez un sous-traitant — donc l'accord du patron (`docs/A-FAIRE.md` point 2) |
| b | Extraire la couche texte à la main (flux `Tj`/`TJ`, positions `Td`/`Tm`) | Sans dépendance ni réseau, mais muet sur un PDF scanné, et fragile sur les encodages de sous-ensembles de polices |

### 0 nonies. Le calendrier, des deux côtés — ~~à faire~~ **fait le 9 août 2026**

Le client ne peut plus choisir un jour déjà pris : il est barré et ne répond
pas. Le patron a le même calendrier, jusqu'à dix-huit mois. `ARCHITECTURE.md`
§36.

**À savoir avant d'y toucher** : le composant ne décide de rien, tout vient de
`src/lib/calendrier.ts`. Et l'ordre des raisons dans `etatDuJour` n'est pas
indifférent — un jour hors fenêtre ne doit JAMAIS se dire « déjà pris » chez le
client, sinon la page laisse filtrer le planning du patron.

**~~Ce qui restait ouvert~~ — tranché le 9 août 2026 : « tu peux aller jusqu'à
douze mois d'occupation ».** Son calendrier barre donc ses journées complètes sur
365 jours. Au-delà, c'est toujours le serveur qui refuse après coup, et un
contrôle tient cette borne pour qu'on ne l'élargisse pas sans le décider.

**Ce que voit le client n'a pas bougé** — deux nombres, deux personnes. Ne jamais
les réunir « pour simplifier » : `HORIZON_OCCUPATION_PATRON_JOURS` est à lui,
`FENETRE_PROPOSITION_JOURS` est à son client.

### 0 octies. Ce qui se détache d'un chantier — ~~à trancher~~ **tranché le 8 août 2026**

Question posée : « autre chose se détache-t-il — dessouchage, évacuation seule,
enlèvement des grumes ? » Sa réponse : **« le dessouchage oui, et les grumes
aussi »**. L'évacuation seule reste donc avec l'abattage et le broyage.

Fait : cinq natures de grille, trois formes, 82 cases (`ARCHITECTURE.md` §35).

**~~Ce qui restait ouvert~~ — tranché le 9 août 2026 : « à la tonne ».** La case
porte un prix unitaire, multiplié par le tonnage lu dans la dictée. L'ancien
forfait a été **effacé** et non converti (migration 0029) : on ne sait pas
combien pesait le chantier qui l'avait produit.

La réserve, écrite à l'écran plutôt que dans un commentaire, aura tenu moins de
vingt-quatre heures. À imiter : une question posée là où le patron la lit se
répond ; enfouie dans le code, elle attend qu'un devis sorte faux.

### 0 septies. Du planning à la facture — ~~à faire~~ **fait le 8 août 2026**

Le patron ne pouvait pas atteindre le devis d'un chantier planifié : toucher sa
carte n'ouvrait qu'un sélecteur de date. La chaîne facture → TVA existait
pourtant en entier — elle était seulement injoignable depuis son écran.

Fait : la carte mène au chantier, porte « Fin de chantier », et garde le
changement de date sur un lien à part. Plus deux défauts de rangement corrigés à
la racine, et un libellé de facture qui n'était plus coupé.

**Ce qu'il faut savoir avant d'y toucher** — `ARCHITECTURE.md` §33 :

- La règle de rangement vit dans `src/lib/onglet-chantier.ts` et **nulle part
  ailleurs**. Trois portes selon la donnée disponible ; **ne jamais la recopier
  dans un écran**, c'est exactement ce qui a produit les deux défauts.
- Aucune barrière de date sur « Fin de chantier », et c'est délibéré depuis le
  3 août : c'est le patron qui sait quand un chantier est fait.

**Ce qui reste ouvert, et qu'il faudra lui demander** : un chantier passé au
planning n'affiche rien tant qu'il n'est pas clôturé. Faut-il un rappel — « ce
chantier était prévu hier » — sur l'écran d'accueil ? Aujourd'hui il bascule
silencieusement dans « Terminés », ce qui est correct mais discret.

### 0 decies. La nouvelle direction graphique — en attente de son choix

Le 9 août au soir, le patron a trouvé l'écran refait « trop application créée
en 2013 » et demandé quelque chose de **minimaliste et luxueux**, en s'appuyant
sur `aman.com`. Huit maquettes ont suivi ; il a retenu la mise en page **« la
colonne »** — la date à gauche, le chantier à droite — et gardé **trois** de ses
déclinaisons : le repère, en plages, l'action au pouce.

**Rien n'est codé.** L'application porte toujours la reproduction de sa première
capture (`ARCHITECTURE.md` §46). Il n'a pas encore désigné laquelle des trois.

Tout est dans `docs/maquettes/`, et d'un coup dans
`docs/maquettes/toutes-les-maquettes.html` — engendrée, jamais éditée à la
main : `node scripts/fusionner-maquettes.mjs`, puis
`node scripts/verifier-maquettes-page-unique.mjs`.

Ce que la bascule coûtera, quand il aura choisi : la charte de
`src/lib/design-tokens.ts` change de fond en comble (ivoire au lieu du gris-vert,
encre au lieu du vert pin pour l'action, bronze au lieu de l'or), et **tous** les
écrans suivent — pas seulement Chantiers. À ne pas entamer écran par écran.

### 0 duodecies. `test-devis-papier-e2e` échoue sur le banc local

`TypeError: Cannot read properties of undefined (reading 'id')` — la suite
cherche une ligne dans `devis` pour son chantier et n'en trouve aucune.

**Ce n'est PAS la refonte** : vérifié en remisant les modifications et en
rejouant la suite sur le code d'avant — même échec, à la même ligne. Le défaut
lui est antérieur. Reste à savoir s'il tient au harnais (`run-e2e-tests` monte
son propre serveur et son propre jeu de données) ou à la suite elle-même. À
reproduire d'abord par `npm run test:e2e` complet avant de conclure.

### 0 bis. L'agent qui apprend — le vrai sujet

Le tapis roulant (dictée → devis, d'un seul geste) est en place, et l'arrêt
d'avant-chiffrage aussi (§0 ter). La suite, dans l'ordre décidé avec le patron
le 5 août 2026 :

| | Quoi | Pourquoi maintenant |
|---|---|---|
| a | ~~**Mémoire des corrections.**~~ **Fait le 6 août 2026** — voir §0 quater. | |
| a bis | ~~**Le découpage des lignes, et la grille de fendage.**~~ **Fait le 8 août 2026** — voir §0 quinquies. | |
| b | **Entretien de départ.** Il n'a aucun ancien devis à donner en référence — c'est donc l'agent qui l'interroge une fois et écrit ses règles. | Sans ça, l'agent démarre en ne sachant rien et apprend aux frais du patron. |
| c | **Écart devis / facture.** Les données existent déjà des deux côtés. | La meilleure leçon qui soit : ce qui avait été mal estimé s'y voit tout seul. |
| d | **Photos ↔ prix.** Conserver le lien entre les photos d'un chantier et le devis qui a suivi. | Objectif du patron : « à force de comparer les photos des arbres et les devis, il devra proposer un prix juste ». Impossible aujourd'hui — mais **l'accumulation doit commencer maintenant**, sinon dans six mois il n'y aura toujours rien à apprendre. |

**Réserve levée le 5 août 2026.** Un prix déduit d'une photo est une estimation,
ce que `docs/AGENT.md` §3 interdisait. Le patron a tranché : *« rien ne sera
jamais envoyé sans vérification du patron, ça restera qu'une proposition. »* La
règle est assouplie — l'estimation est permise **à condition d'être signalée
comme telle**, et c'est l'arrêt 1 qui porte la garantie. Voir `AGENT.md` §3.

**Et une contrainte de fond, soulevée par le patron le même jour :** *« si
l'appli n'a aucune mémoire, comment l'IA va enregistrer et se souvenir ? »* Il a
raison, et ça conditionne (a) à (d). L'application a bien une mémoire — une base
PostgreSQL sur volume persistant — mais **celle du banc d'essai meurt avec
l'espace de travail**, qui est jetable par construction. Tout ce qui s'apprend
ne sera durable qu'une fois l'hébergement choisi (point 3 de `A-FAIRE.md`).
Construire l'apprentissage sur le banc reste utile pour l'éprouver ; ce qui s'y
accumule ne doit pas être présenté comme conservé.


### 1. Agenda Google — au choix de chaque artisan

> **Fait le 9 août 2026, sauf les identifiants.** L'écran « Mon agenda », le
> stockage chiffré, la fusion dans la disponibilité et les deux chemins du
> client sont écrits et éprouvés (`ARCHITECTURE.md` §39). **Ce qui reste tient
> en une chose, et elle n'est pas codable** : les identifiants OAuth, que seul
> le patron peut créer (`docs/A-FAIRE.md` §7). Tant qu'ils manquent, l'écran
> l'annonce et ne propose aucun bouton.
>
> **Et ce qui n'a pas pu être éprouvé ici** : l'aller-retour réel avec Google —
> autorisation, échange du code, renouvellement du jeton. Trois appels HTTP, pas
> davantage : tout ce qui décide en a été sorti exprès. À vérifier chez lui, le
> jour où les identifiants existent.

**Partiellement bloqué.** La connexion du compte demande des identifiants OAuth
que le patron doit créer ; le reste est codable. Le point bloquant est détaillé
dans `docs/A-FAIRE.md` §7.

Aujourd'hui, les jours libres se déduisent des seuls chantiers planifiés dans
Atlas (`src/server/disponibilites.ts`). Un patron qui tient son agenda ailleurs
verra donc proposer des jours où il est déjà pris — et c'est le client qui
choisira ce jour-là.

**Décision du patron, le 9 août 2026** — *« ce qui serait bien, c'est que
l'utilisateur puisse, s'il le souhaite ou non, connecter son planning à son
agenda Google »* — et elle contraint la conception :

- **C'est un choix par artisan, pas un réglage de l'application.** Chacun relie
  son agenda ou ne le relie pas. Celui qui ne relie rien garde exactement
  l'Atlas d'aujourd'hui : pas d'écran en plus, pas de compte à créer, aucun
  chemin de code nouveau à traverser.
- **Le jeton de raccordement appartient à l'entreprise**, donc il vit en base
  sous RLS, comme tout le reste — jamais dans une variable d'environnement
  partagée, qui vaudrait pour tout le monde à la fois.
- **Atlas ne lit que les créneaux occupés.** Jamais l'intitulé, jamais les
  participants. Un agenda personnel porte les rendez-vous médicaux et les
  vacances de la famille ; Atlas n'en a pas besoin pour savoir qu'une journée
  est prise. Même règle qu'à la page du client, qui reçoit des dates et rien
  d'autre (`docs/AGENT.md` §2.2 bis).
- **Une seule fonction de disponibilité**, jamais deux. La fusion des créneaux
  Google et des chantiers Atlas se fait *dans* `src/server/disponibilites.ts`.
  Un second calcul à côté finirait par diverger du premier — c'est exactement le
  défaut qui a produit, le 9 août, un chantier rangé dans deux onglets à la fois
  (`ARCHITECTURE.md` §33).

À faire une fois les identifiants disponibles : le bouton « Relier mon agenda »
dans les réglages, le raccordement du compte, la lecture des créneaux sur la
fenêtre de proposition, la fusion ci-dessus, et l'écriture de l'intervention
après acceptation.

**Ce qui ne pourra pas être éprouvé ici :** sans compte Google raccordé, aucun
contrôle local ne parcourt le vrai chemin. La partie fusion, elle, est une
fonction pure et s'éprouve entièrement (`CLAUDE.md` §5).

### 2. Code SMS en renfort de l'acceptation

L'acceptation conserve déjà l'empreinte du PDF, l'horodatage, l'adresse IP et le
canal (`docs/AGENT.md` §5, ligne « Acceptation tracée »). Ce qui manque est un
code à usage unique envoyé au client au moment où il accepte.

**Sans objet en l'état** : le patron a écarté tout fournisseur d'envoi
(`ARCHITECTURE.md` §13), et un code qu'il devrait transmettre lui-même
n'apporterait rien. À rouvrir seulement si un fournisseur est un jour souscrit.

### 3. Relance automatique d'un devis sans réponse

L'état « à relancer » existe, s'affiche, et le lien reste proposé pour un renvoi
manuel. **Sans objet en l'état**, pour la même raison qu'au point 2 : la relance
part de la messagerie du patron, comme l'envoi.

### 4. L'assistant répond en JSON brut

Interrogé « Comment a été envoyé le devis ? », il a répondu :
`D'après LireDevis, voici ce que j'ai trouvé : {"existe":true,"numeroCommercial":"2026-0003",…}`.
Le patron n'a pas à lire du JSON. L'assistant doit répondre en français, ou dire
qu'il ne sait pas — et jamais recracher la sortie d'un outil telle quelle.

### 5. ~~Les équipes nommées~~ — fait le 10 août 2026

**Demandé par le patron le 10 août** : *« il faut que dans le fichier réglages
on puisse mettre le nom des équipes — soit équipe A équipe B, soit des noms et
prénoms. Mais s'il n'a pas d'équipe et qu'il ne met rien, il ne faut pas qu'il y
ait quand même écrit équipe A équipe B. »*

Table `equipes` (`nom` **nullable**), colonne `chantiers.equipe_id`, et une
seule fonction pure qui décide du libellé (`src/lib/equipes.ts`). Le planning se
lit désormais au mois, avec une ligne par équipe sous chaque demi-journée.
Détail et pièges dans `ARCHITECTURE.md` §51 et §52.

**Ce qui n'a PAS bougé, et qu'il ne faut pas « corriger » :**

- **`entreprises.nombre_equipes` fait toujours autorité sur le NOMBRE.** La
  table ne porte que des noms. Un `COUNT(*)` ferait dépendre le calcul des
  disponibilités de lignes qu'aucun écran n'oblige à créer.
- **Aucun nom n'est écrit en base au moment de l'insertion.** Le repli
  « Équipe A » est un affichage — l'écrire en donnée le rendrait indiscernable
  d'un nom choisi, et un retour à une seule équipe le ferait parler.

Écarté aussi, et volontairement : les **heures réelles** (« la demi-journée
suffit ») et la **capacité en hommes** — `taille_equipe` est du texte libre, il
faudrait le fiabiliser avant d'en faire une contrainte. Voir `ARCHITECTURE.md`
§22 pour les arbitrages.

### 5 bis. ~~« Terminés » et le parcours de facturation~~ — fait le 10 août 2026

Le §6 quinquies de `docs/INTEGRER-ORIGINE.md` : l'écran devient un **fil par
mois**, l'encart « à facturer » se pose **dans le mois** plutôt qu'à côté, et le
relevé de TVA cesse d'être un pavé pour devenir une ligne au pied.
`ARCHITECTURE.md` §53.

**Trois décisions du patron, prises le 10 août et à ne pas rouvrir :**

1. **« Fin de chantier » devient « Créer la facture »**, sur les trois écrans
   qui portaient le mot (fiche, planning, écran de facture). Le nom dit
   désormais ce que la touche fabrique.
2. **Une facture à 0,00 € s'affiche telle quelle**, sans mention ni
   avertissement. Il en a une dans ses données réelles (F2026-0001) : un
   montant nul se lit, il ne se commente pas.
3. **La bulle de l'assistant s'écarte du bandeau** — elle venait toucher la
   dernière ligne de l'écran.

**Ce qui a été vérifié et qui n'était PAS un défaut :** `listerChantiersTermines`
compte bien un chantier du 20 comme terminé **le 21**, jamais le 20 à minuit
(`ongletDepuisJalons` : `datePlanifiee < aujourdHui`). La journée entière reste
au planning — c'est de là que le patron clôture en rentrant.

### 7 bis. ~~Le retrait, partout~~ — fait le 10 août 2026

Le cinquième choix du patron sur les maquettes : « le tiroir des retirés »,
appliqué aux **huit** endroits qui suppriment (le recensement de
`docs/INTEGRER-ORIGINE.md` §4 bis en annonçait sept — le planning manquait).
Détail et pièges dans `ARCHITECTURE.md` §48.

**Ce qui reste de la fiche `docs/INTEGRER-ORIGINE.md` :** son §6, l'ouverture
de « Nouveau chantier » — et il porte un point de PRODUIT non tranché, à poser
au patron avant de coder : cet écran est aujourd'hui une page avec sa flèche de
retour, quand l'ouverture retenue raconte une feuille modale.

**Deux choses laissées telles quelles, et dites plutôt que tues :**

- **Les maquettes `/design/prix`** montrent encore l'ancienne croix nue et le
  bandeau flottant (`AnimatedRow`, `UndoToast`, qui ne servent plus qu'à
  elles). Elles sont découplées du produit depuis le 1er août ; les reprendre
  ou les retirer reste à décider, mais elles contredisent l'application.
- **Le geste en diagonale n'a pas pu être éprouvé ici** : le glissement
  horizontal du texte et l'accroche verticale du fil ne portent pas sur le même
  axe, mais un pouce, lui, bouge en biais. Un navigateur piloté ne le
  reproduit pas — à essayer sur un vrai téléphone.

### 7 ter. ~~L'anneau muet et la pellicule~~ — fait le 10 août 2026, au soir

Le §6 bis de `docs/INTEGRER-ORIGINE.md` : sur la fiche chantier, un **anneau
muet** remplace la ligne « Note vocale » comme accès direct — on le touche, la
note se lit ; on le pousse vers le haut, « Retirer » se découvre. Les photos
deviennent une **pellicule** dans le tiroir du bas, case « + » en tête, et la
ligne « Photos · 6 photos » disparaît. Détail et pièges dans
`ARCHITECTURE.md` §49.

**L'en-tête de la fiche ne bouge pas — ~~à trancher~~ TRANCHÉ le 10 août 2026.**

La maquette `atlas-note-vocale.html` raconte en plus de l'anneau une **scène**
entière : grand titre serif, phrase de situation (« Intervention prévue vendredi
15 août »), à la place de l'en-tête commun. La question lui a été posée en
image ; sa réponse : **« N'y touche pas. »**

**Ne pas la rouvrir en découvrant l'écart avec la maquette.** L'écart est connu
et voulu. `EnTeteEcran` est **une seule pièce partagée** par la fiche, le
planning, les terminés, les réglages et les six écrans d'étape : la refaire
pour la seule fiche désaccorderait cet écran de tous les autres, et la refaire
partout serait un lot en soi, touchant l'accueil — que le patron a arrêté et
qu'il ne veut pas revoir.

Si le sujet revient, c'est **lui** qui le rouvre, et alors c'est « partout »
ou rien.

### 7. Finir la refonte — l'ordre, les pièges, les valeurs

**Ce point existe pour qu'une conversation neuve puisse reprendre le travail
sans rien redemander.** Le CSS n'est pas recopié ici : il est dans la maquette
publiée, `docs/maquettes/13-le-fil-quatre-couleurs.html`, qui est du HTML pur —
ouvrez-la, lisez la feuille de style, elle fait foi pour le dessin.

#### L'ordre, et où l'on en est

| | Écran | État |
|---|---|---|
| — | Accueil, Planning, Terminés, Réglages, relevé de TVA | **fait** le 10 août 2026 |
| — | Fiche chantier, entièrement | **fait** |
| — | En-tête + boutons des six écrans d'étape | **fait**, par remplacement de motif |
| — | Corps de Photos | **fait** |
| ~~1~~ | ~~Corps de **Note vocale**~~ | **fait** le 10 août 2026 |
| ~~2~~ | ~~Corps d'**Informations** puis de **Prix**~~ | **fait** le 10 août 2026 |
| — | Fiche chantier : **l'anneau muet** et **la pellicule** | **fait** le 10 août 2026, au soir |
| **3** | Corps de **Devis**, **Export**, **Facture** | à faire |

**Ce que l'étape 2 a appris, et qui sert à l'étape 3.**

- **Les deux voix sont désormais des jetons** : `libelleCaps` et
  `texteSituation` dans `src/lib/design-tokens.ts`. Ne plus les retaper à la
  main. `smallCaps`, l'ancienne voix, ne sert plus qu'aux maquettes
  `/design/*` — un écran qui l'importe encore n'est pas refait.
- **L'écran Informations n'était pas dans « les six »** : son en-tête avait été
  oublié le 10 août au matin, et il est passé à `EnTeteEcran` avec son corps.
  Vérifier que **Transcription** ne dort pas dans le même angle mort.
- **Une action en capitales prend deux fois la place.** « Voir la
  transcription » à droite du titre repliait le nom du chantier sur deux
  lignes ; une flèche de plus faisait passer « Aller jusqu'au devis d'un seul
  geste » à deux lignes, la flèche seule sur la seconde. Mesurer avant, ou
  déplacer l'action.
- **Une plage occupe la largeur ; une action en toutes lettres s'aligne à
  gauche.** Sans `self-start`, un bouton texte s'étire et se centre tout seul.
- **`innerText` rend le texte TEL QU'IL S'AFFICHE.** Trois contrôles cherchaient
  « Prix Calculé » ou « Déjà au détail » ; les capitales les ont cassés sans
  qu'aucun défaut n'existe. Le réflexe utile : avant de corriger le produit,
  regarder si le contrôle lit du rendu ou de la donnée.
- **Prendre la capture d'abord, et à deux endroits** :
  `npx tsx scripts/capture-etape.mts <dossier> <chantierId> <étape…>` écrit le
  haut ET le bas de chaque écran. Les deux défauts réels de l'étape 2 — une
  croix hors de l'écran, la bulle sur le bouton — n'étaient visibles que là.
- **Le jeu de démonstration ne pose ni brouillon ni dictée analysable ici** :
  pour regarder un écran plein, insérer soi-même une ligne dans
  `brouillons_informations`. Sans cela on juge un écran vide.

Il n'y a plus de motif commun à remplacer : chacun a sa structure, donc plus de
codemod possible. C'est du cas par cas, **et chaque écran se regarde en capture
avant d'être déclaré fait** — trois défauts réels de cette refonte n'ont été
trouvés que là (`CLAUDE.md` §5).

#### Les valeurs de la grammaire

Elles ne s'inventent pas écran par écran : elles viennent des trois pièces
partagées — `EnTeteEcran`, `PrimaryButton`, `src/lib/design-tokens.ts`.

| Quoi | Valeur |
|---|---|
| Marge horizontale | **26 px** partout (`px-[26px]`), jamais 24 |
| Rayon | **4 px** pour une plage, **5 px** pour une action. Rien au-delà |
| Ombre | **aucune** (`cardShadow` vaut `"none"`) |
| Titre d'écran | serif, **36 px**, `letter-spacing: -0.018em` |
| Nom d'un chantier, intitulé d'étape | serif, **19 px** |
| Libellé, état, action secondaire | capitales, **9,5 px**, `letter-spacing: 0.28em` |
| Texte de situation (adresse, meta) | **11,5 px**, en `colors.muted` |
| Séparateur | un cheveu d'1 px, `colors.line` |
| Couleur d'attente | l'or, **et uniquement sur ce qui réclame un geste du patron** |

#### Les pièges, tous rencontrés une fois

1. **`npm run banc` ne rebâtit que si le commit a changé.** Tant que le travail
   n'est pas commité, il ressert la version d'avant : on mesure du code qui
   n'est pas sur le disque. `rm .next/atlas-version-batie.txt` force le rebâti.
2. **`npm test` abîme le jeu de démonstration.** Après la batterie, la connexion
   `demo@atlas.local` échoue jusqu'à un nouveau
   `DATABASE_URL="$DATABASE_ADMIN_URL" npm run db:seed`.
3. **Un bandeau posé dans l'en-tête écrase la liste.** Tout ce qui peut
   apparaître (notifications, annonces) va DANS la zone qui défile.
4. **`CarteGlissante` repeint ce qui est dessous** : sa couche porte le fond de
   la page. Un trait dessiné sous une liste glissante disparaît — le dessiner
   ligne par ligne.
5. **`position: sticky` est borné par le PARENT**, pas par le conteneur qui
   défile. Un élément collant enfermé dans un `div` d'une ligne ne colle que sur
   cette ligne : utiliser un fragment.
6. **Une feuille en `absolute` passe SOUS le bandeau et la bulle**, tous deux
   fixés. Une feuille modale se pose en `fixed`, au-dessus de `z-40`.
7. **Le navigateur d'essai** : `chromium.launch({ executablePath:
   "/opt/pw-browsers/chromium" })`, sinon Playwright réclame une installation
   qui est pourtant là (voir §0).

#### Les deux réserves — ce qui ne doit PAS suivre

- **Les maquettes `/design/*`** : découplées du produit depuis le 1er août,
  elles ne sont pas des écrans du patron.
- **Les pages que le CLIENT reçoit** — `devis/[jeton]`, `factures/[jeton]`, et
  le PDF. Un devis n'est pas un écran : c'est la pièce que le client garde,
  imprime et signe, et le patron a choisi sa terre cuite le 3 août **en
  connaissance de cause**, puis l'a maintenue.

**~~Question ouverte~~ — tranchée par le patron le 10 août 2026 :** *« il faut
que toutes les écritures de l'appli changent de police, on harmonise le tout. »*
Le devis et la facture suivent donc l'écran, et il n'y a plus d'exception de
typographie nulle part.

**Et la couleur suit aussi**, tranchée dans la foulée : *« oui, harmonise aussi
le devis »*. La terre cuite disparaît, l'accent des documents devient l'or.
`couleursDocument` reste néanmoins un jeton à part — papier et encre d'une
pièce imprimée ne suivront pas forcément un futur écran sombre.

Le **PDF**, lui, n'a jamais chargé Playfair ni Inter : il embarque Times et
Helvetica, les polices standard du format — il était déjà d'accord avec ce que
l'écran est devenu.

### 6. Rien ne mène le patron d'un écran au suivant

**Le tronçon principal est réglé** (2026-08-04) : depuis la transcription, un
seul appui va jusqu'au devis chiffré. Restent les marches d'à côté — après une
photo, après un tarif enregistré, après une facture émise, rien n'indique où
l'on va. Un écran qui ne dit pas la suite se lit comme une application en panne,
et c'est déjà arrivé.

---

## Terminé

- ~~Reprendre l'application Arborea sans le site vitrine, et la publier~~ — 2026-07-31
- ~~Vérifier le site publié à son adresse publique~~ — 2026-07-31
- ~~Cadrer l'agent (`docs/AGENT.md`) et la conformité (`docs/RGPD.md`)~~ — 2026-08-01
- ~~Acceptation des documents légaux avec empreinte~~ — 2026-08-01
- ~~Page publique de réponse du client, jeton, expiration, contre-proposition~~ — 2026-08-01
- ~~Purge de l'audio, export et effacement d'un client~~ — 2026-08-01
- ~~Envoi du devis au client, canal recueilli à la création~~ — 2026-08-01
- ~~Onglet « Terminés », fin de chantier, facture, relevé de TVA~~ — 2026-08-01
- ~~Suivi du devis parti : cinq états, notification, reprise~~ — 2026-08-01
- ~~Mémoire permanente du dépôt (ces fichiers)~~ — 2026-08-01
- ~~Caducité distincte du refus, et remontée à l'accueil~~ — 2026-08-01
- ~~Compteur d'accueil : ne plus compter les chantiers facturés~~ — 2026-08-01
- ~~Découpler les maquettes `/design/*` du type de statut vivant~~ — 2026-08-01
- ~~Le devis PDF reprend le modèle d'Arborea, et se pagine~~ — 2026-08-03
- ~~`test-reglages-e2e.ts` : attendre l'enregistrement, pas un délai fixe~~ — 2026-08-03
- ~~Document PDF pour la facture, sur le moteur partagé avec le devis~~ — 2026-08-03
- ~~Le devis à 0 € : bouton grisé, marche à suivre, et refus côté serveur~~ — 2026-08-03
- ~~Navigation : la barre du bas reste (décidé) ; l'action principale prend la carte d'Arborea~~ — 2026-08-03
- ~~La dictée arrivait amputée à l'écran : découpage, durée, vocabulaire, déchets~~ — 2026-08-03
- ~~Écrire le devis soi-même depuis l'écran Informations~~ — 2026-08-03
- ~~Le devis doublait au retour arrière du navigateur (4 017,60 € au lieu de 2 008,80 €)~~ — 2026-08-03
- ~~« Fin de chantier » injoignable sur un chantier planifié~~ — 2026-08-03
- ~~Planifier en demi-journées, et compter les équipes (le client ne voit que la date)~~ — 2026-08-03
- ~~Le client peut demander une correction, et son message parvient au patron~~ — 2026-08-03
- ~~La durée du chantier se choisit à la molette (½ journée à 100 jours)~~ — 2026-08-03
- ~~La durée dictée n'entrait pas dans la planification : un chantier de 2 jours n'en bloquait qu'un~~ — 2026-08-03
- ~~Le SMS s'ouvrait sans destinataire ; le canal se change désormais, et la coordonnée manquante se saisit sur place~~ — 2026-08-04
- ~~De la dictée au devis en un seul geste, et plus aucun écran mort quand le fournisseur répond à côté~~ — 2026-08-04
- ~~L'espace d'essai récupère le code neuf à chaque allumage, et l'application annonce sa version~~ — 2026-08-04
- ~~La date des documents s'écrit jour/mois/année~~ — 2026-08-04
- ~~La bande des durées est aussi sur l'écran Informations, là où il la cherchait~~ — 2026-08-04
- ~~Rédiger le devis entièrement à la main, depuis la fiche du chantier~~ — 2026-08-04
- ~~Retirer la case « Nom du chantier » : plus rien n'est obligatoire à la création~~ — 2026-08-05
- ~~« Rédiger à la main » ouvre le devis ENTIER, à l'image du modèle, et il reste dans Atlas~~ — 2026-08-05
