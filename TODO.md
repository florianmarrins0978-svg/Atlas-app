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

**Ce qui reste ouvert, et qui n'est pas un détail** : à quoi se chiffrent les
grumes ? Au mètre cube, à la tonne, au voyage de camion ? Il n'a rien dit, la
grille n'a donc qu'une case au forfait, et l'écran l'invite à trancher. Le jour
où il répond, une migration ajoute l'axe sans rien perdre — c'est le même chemin
que la haie.

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


### 1. Agenda Google — lecture des disponibilités

**Partiellement bloqué.** La connexion du compte demande des identifiants OAuth
que le patron doit créer ; le reste est codable.

Aujourd'hui, les jours libres se déduisent des seuls chantiers planifiés dans
Atlas (`src/server/disponibilites.ts`). Un patron qui tient son agenda ailleurs
verra donc proposer des jours où il est déjà pris — et c'est le client qui
choisira ce jour-là.

À faire une fois les identifiants disponibles : lecture des événements sur la
fenêtre de proposition, fusion avec les chantiers Atlas dans la **même** fonction
de disponibilité (jamais un second calcul), et écriture de l'intervention après
acceptation.

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

### 5. Les équipes nommées, si l'entreprise grandit

Le patron a retenu un **compteur** d'équipes (Réglages), pas des équipes
nommées : il sait combien de chantiers il mène de front, pas encore qui va où.
Le jour où il aura deux vraies équipes distinctes, la suite est une table
`equipes` + `chantiers.equipe_id`, et un planning qui se lit par colonne.

Écarté aussi, et volontairement : les **heures réelles** (« la demi-journée
suffit ») et la **capacité en hommes** — `taille_equipe` est du texte libre, il
faudrait le fiabiliser avant d'en faire une contrainte. Voir `ARCHITECTURE.md`
§22 pour les arbitrages.

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
