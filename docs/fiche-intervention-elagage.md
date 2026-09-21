# La fiche d'intervention d'élagage — ce qu'il faut savoir avant d'écrire une ligne

**À qui ce document s'adresse :** une session qui reprend ce sujet à froid, sans
rien de la conversation du 21 septembre 2026 où il est né.

**D'où il vient.** Le patron : *« j'ai entendu parler qu'en élagage il y avait
besoin de faire des fiches avant l'intervention, apparemment c'est devenu
obligatoire — renseigne-toi »*. C'est vrai, et ce n'est pas nouveau.

**Rien n'est codé.** Ce document porte la recherche et le cadre ; la suite passe
par une maquette (`CLAUDE.md` §3 bis), et par sa réponse.

---

## Sommaire

1. [En une minute](#1-en-une-minute)
2. [Ce qui est vérifié, et ce qui ne l'est pas](#2-ce-qui-est-vérifié-et-ce-qui-ne-lest-pas)
3. [Le piège : Atlas a DÉJÀ une « fiche de chantier »](#3-le-piège-à-ne-pas-tomber-dedans--atlas-a-déjà-une--fiche-de-chantier-)
4. [Le contenu exact du formulaire officiel](#4-le-contenu-exact-du-formulaire-officiel)
5. [Ce que le dépôt a déjà, et ce qui manque](#5-ce-que-le-dépôt-a-déjà-et-ce-qui-manque)
6. [Ce qu'il faut lui demander avant de dessiner](#6-ce-quil-faut-lui-demander-avant-de-dessiner)
7. [Comment ce lot doit se faire](#7-comment-ce-lot-doit-se-faire)
8. [Sources](#8-sources)

---

## 1. En une minute

| | |
|---|---|
| **Le texte** | décret n° 2021-1833 du 24 décembre 2021 |
| **En vigueur** | 1er mars 2022 (la formation secourisme : 28 avril 2023) |
| **Ce qu'il crée** | une **fiche d'intervention** à établir **avant** le début des travaux |
| **Quels travaux** | abattage, élagage, démontage, ébranchage, éhouppage, billonnage, broyage — parcs, jardins, arbres d'alignement. **Pas** la tonte, pas la haie |
| **Qui** | chaque chef d'entreprise intervenante, **y compris l'artisan seul** qui grimpe lui-même |
| **Où** | disponible en permanence sur le chantier — **la dématérialisation est explicitement admise** |
| **Combien de temps** | conservée **2 ans** à compter de la date de signature |
| **Pour qui** | les travailleurs et les contrôles (MSA, inspection du travail). **Ce n'est pas un document client** |

**La phrase qui ouvre la porte à Atlas**, citée mot pour mot du formulaire
officiel (page 4) :

> La fiche d'intervention est :
> • communiquée et présentée aux travailleurs avant le début des travaux.
> • disponible en permanence sur le chantier (**possiblement dématérialisée**).
> • communiquée au chef de l'entreprise utilisatrice lorsque le chantier est
>   réalisé dans le cadre des dispositions prises en application de l'article
>   L. 4511-1 du code du travail (plan de prévention).
> • conservée pendant deux ans à compter de sa date de signature.

---

## 2. Ce qui est vérifié, et ce qui ne l'est pas

**La distinction compte** : une partie vient du formulaire officiel lui-même —
le patron l'a transmis, il a été lu page à page —, l'autre de résumés de
recherche web. Légifrance, `preventionbtp.fr`, `inrs.fr`, `msa.fr` et
`agriculture.gouv.fr` sont **bloqués par le mandataire réseau** de
l'environnement d'agent : le texte du décret n'a pas pu être lu à la source
depuis ce poste.

| Affirmation | Fondement | Confiance |
|---|---|---|
| Le décret est le n° 2021-1833 du 24 décembre 2021 | **écrit en tête du formulaire officiel** | acquis |
| Les quatre règles de diffusion (travailleurs, sur place, entreprise utilisatrice, 2 ans) | **page 4 du formulaire officiel**, citée ci-dessus | acquis |
| Le contenu de la fiche (§4 de ce document) | **le formulaire officiel**, réf. `12350_A_10/2023` | acquis |
| Entrée en vigueur au 1er mars 2022 | recherche web, sources concordantes (MSA, DREETS, ministère) | élevée |
| L'article est le R. 717-85-16 du code rural | recherche web, **une seule source** | moyenne — **à vérifier avant de l'écrire où que ce soit** |
| Le décret vise aussi les travailleurs indépendants et les employeurs qui grimpent eux-mêmes | recherche web, sources concordantes | élevée |
| Les sanctions en cas d'absence de fiche | **rien d'établi** | **ne rien affirmer** |

**Ce qui reste à faire pour lever le doute** : lire le décret et l'article du
code rural à la source. Ce n'est pas faisable depuis un environnement d'agent
dont le mandataire refuse Légifrance ; ça l'est depuis l'espace du patron, ou
depuis une session qui a le réseau. **Tant que ce n'est pas fait, le numéro
d'article ne s'écrit pas dans l'application** (`CLAUDE.md` §4 : on n'invente pas).

---

## 3. Le piège à ne pas tomber dedans : Atlas a DÉJÀ une « fiche de chantier »

**Ce sont deux documents différents, et les confondre casserait les deux.**

| | `src/server/pdf/fiche-chantier-pdf.ts` — **existant** | La fiche d'**intervention** — **à faire** |
|---|---|---|
| Quand | **après** le chantier | **avant** le chantier |
| Ce qu'elle dit | ce qui a été fait, avec quoi, ce qu'on a observé | les risques du site et les mesures de sécurité |
| Pour qui | le **client** — transmissible à un locataire, un syndic, une assurance | les **travailleurs** et les contrôles |
| Prix | aucun, délibérément (`sansChiffrage`) | sans objet |
| Signature | aucune | **obligatoire**, chef d'entreprise ou son représentant |
| Origine | sa demande du 20 août 2026 | décret 2021-1833 |

**Ce qui se réutilise quand même**, et c'est ce qui rend le lot abordable :
`src/server/pdf/document-commun.ts` compose déjà l'en-tête, le bloc
émetteur/client et le pied des trois documents existants. Une quatrième pièce
doit ressembler aux trois autres — c'est le même artisan qui la sort.

**Ce qui ne se réutilise PAS** : le type `FicheChantierPdfData` et sa mention de
pied (« Ce document rend compte des travaux réalisés »), qui dit exactement
l'inverse de ce qu'une fiche d'intervention affirme.

---

## 4. Le contenu exact du formulaire officiel

Restitution fidèle du formulaire MSA réf. **12350_A_10/2023** (4 pages), tel
qu'il a été lu. **C'est la référence** : les libellés se recopient, ils ne se
reformulent pas (même logique que `CLAUDE.md` §4 bis pour le catalogue
d'arrosage — un libellé retouché ne se retrouve plus).

### Page 1 — Identification

**Identification du chantier**

- Nom du chantier
- N° de devis et/ou de commande afférent
- Entreprise réalisant le chantier : raison sociale
- Donneur d'ordre : nom, prénom, téléphone
- Lieu : adresse, coordonnées GPS
- Dates d'exécution : début (jour, heures) / fin (jour, heures) ; horaires, délais
- Responsable de l'entreprise sur le chantier
- Nombre de travailleurs de l'entreprise
- Téléphone en cas d'incident ou d'accident

**Travaux à réaliser** — cases à cocher, dans l'ordre du formulaire :

> Billonnage · Broyage · Évacuation des rémanents · Rognage / essouchage ·
> Démontage sans rétention · Abattage directionnel · Abattage non directionnel ·
> Ébranchage · Éhouppage · Élagage de formation · Élagage d'entretien ·
> Haubanage · Démontage avec rétention · Autres (à préciser)

**Main d'œuvre** — niveau de formation, ancienneté, habilitation, autorisation
de conduite.

**Activités** — moyens de prévention mis en œuvre, EPI appropriés à l'activité
et aux travailleurs.

**Matériels** — approprié à l'activité, conforme, vérifié (VGP), état
(maintenance) :

| Famille | Choix |
|---|---|
| Moyens d'élévation *(privilégier la protection collective)* | Nacelle (PEMP) · PIRL · EPI de grimper · Échelle *(= moyen d'accès)* · Autres |
| Matériels de coupe | Tronçonneuse élagueuse · Tronçonneuse abatteuse · Lamier d'élagage · Scie sur perche · Sécateur · Autres |
| Matériels autres | Broyeur · Essoucheuse / Rogneuse · Treuil / Câble · Mini chargeur · Souffleur · Autres |

*Point de vigilance du formulaire : distance de sécurité à respecter vis-à-vis
des matériels.*

**Matières** — état sanitaire et physiologique des arbres, fragilisation des
points d'ancrage et de la structure :

- Repérer la présence de bois morts ou dépérissants sur les sujets à traiter (ou à proximité)
- Évaluer l'état d'ancrage des arbres (enracinement)
- Identifier les affections dangereuses pour la santé et la sécurité des travailleurs (suie, chancre, capricorne, champignon lignivore…)
- Autres (à préciser)

### Page 2 — Le croquis, et les risques biologiques

**« Carte / croquis / photo du chantier indiquant les accès, voies de
circulation et les végétaux à traiter. »**

**Le mot « photo » est dans le formulaire.** Aucune lecture d'image n'est
nécessaire pour être en règle : une photo du terrain prise sur place suffit.
*(Le dépôt sait déjà lire un croquis — `src/server/ai/services/lire-croquis.ts`
— mais c'est pour l'arrosage, et l'y employer ici serait hors périmètre.)*

Légende du formulaire, à reproduire si l'on dessine :

> Arbre à abattre · Arbre à tailler · Arbre · Zone de stockage et broyage ·
> Limite de parcelle · Accès au chantier (compatible au gabarit des engins) ·
> Ruisseau · Ligne électrique aérienne · Point avec couverture téléphonique ·
> **PRS (Point de Rencontre Secours)** · Zone de danger ou d'attention

Schéma des zones, en quatre couches :

| Zone | Ce que le formulaire en dit |
|---|---|
| Zone extérieure | — |
| Zone de chantier | **délimitation matérielle obligatoire** |
| Zone de danger | — |
| Zone de sécurité | délimitation organisationnelle, matérialisation optionnelle |

**Risque biologique** (cases) : chenilles processionnaires · frelons sp et
autres hyménoptères · berce du Caucase, ambroisie sp… · tiques sp · suie de
l'érable · chancre du platane · autres.

**Mesures** : EPI appropriés (masque, combinaison, gants…) · appel à un
spécialiste pour circonscrire le danger · Certibiocide (si produits biocides) ·
autres.

**Risques spécifiques au chantier → mesures de prévention** : balisage externe
avec panneaux d'interdiction d'accès et de signalisation du danger · balisage
interne pour limiter la chute d'objet/branche sur l'homme de pied · mode de
communication entre travailleurs (ex. casques communicants) · surveillance de
l'accès au chantier (intrusion du public) · autres.

### Page 3 — Réseaux, environnement, météo

**Risques liés aux réseaux** (aériens et souterrains) : électrique — HTB
(U > 50 000 V), HTA (U ≤ 50 000 V), BT (U ≤ 1 000 V) — eau, vapeur · gaz ·
télécom · autres.

**Mesures**, et ce sont des obligations distinctes :

- **DT-DICT** — déclaration de travaux à proximité des réseaux (chantier distant
  < 50 m de conducteurs électriques nus, ou lors d'arrachage d'arbre, de
  creusement de tranchées…)
- **AIPR** (formulaire)
- Formulaire de découverte fortuite de réseau

**Distances de sécurité vis-à-vis des conducteurs électriques nus**, telles que
le formulaire les écrit :

| | |
|---|---|
| HTB (U > 50 000 V) | **5 m** |
| HTA (U ≤ 50 000 V) | **3 m** |
| BT (U ≤ 1 000 V) | **3 m** |

**Risques liés à l'environnement** : routier · facteurs météo ambiants · bruit ·
état des sols · conditions de vie sur le chantier · éclairage · vapeurs ·
poussières · noyade · autres.

**Mesures** : balisage du chantier sur voie publique (`jebalise.fr`) ·
adaptation des heures de travail · eau en quantité suffisante · cabinet
d'aisance · équipements ou vêtements de travail spécifiques · signal d'alarme
(sifflet) · équipement individuel de flottaison / barque / bouée · **plan de
prévention (entreprise utilisatrice)** · autres.

**Co-activité dans la zone de sécurité** · entraînement par les éléments mobiles
des équipements (rogneuse, broyeur…) · projection.

**Règles organisationnelles** : répartition des tâches dans le temps et l'espace
· respect des consignes de sécurité des machines · manuel d'utilisation du
matériel · mode de communication entre travailleurs · autres.

**Conduite à tenir en cas de phénomènes météorologiques imprévus** : bulletins
d'alerte météorologiques · sécuriser les travaux en cours puis arrêter les
travaux · protéger les zones dangereuses ou potentiellement dangereuses ·
prévenir le responsable du chantier ou le chef d'entreprise · autres.

### Page 4 — Secours, signature

**Ressources** : trousse de secours (contenu approprié à l'activité) · kit
d'urgence portatif (élagueur) · **lieu où se trouve la trousse** · **Point de
Rencontre des Secours** · tous les travailleurs sont SST (Sauveteurs Secouristes
du Travail) · travailleurs disposant des compétences (type **Grimpeur Sauveteur
dans l'Arbre**) et des moyens pour porter secours à une victime dans l'arbre, en
nombre suffisant · moyen de communication fonctionnel.

**Consignes — 1. Protéger**

1. Sécuriser les travaux en cours puis arrêter les travaux
2. Protéger les zones dangereuses ou potentiellement dangereuses
3. Prévenir le responsable du chantier ou le chef d'entreprise

**2. Alerter**

1. S'identifier (nom, prénom, entreprise)
2. Donner sa localisation et préciser les moyens d'accès
3. Décrire la nature de l'accident
4. Préciser le nombre et l'état du (des) blessé(s)
5. Décrire les gestes de premiers secours en cours (le cas échéant)
6. Fixer un rendez-vous au point de rencontre des secours (PRS)
7. Ne jamais raccrocher le premier : attendre les instructions des services de secours

**3. Secourir**

1. Intervenir sans s'exposer (suivant référentiel SST et/ou GSA)
2. Préparer l'arrivée et l'accès des secours (dégagement des rémanents et du matériel)
3. Prévenir le siège des entreprises (du donneur d'ordre et de celle réalisant le chantier)

Plus deux consignes permanentes : dès le début du chantier, stationner les
véhicules dans le sens du départ et laisser la voie d'accès libre ; obtenir
l'accord des services d'urgence avant de déplacer une victime.

**Numéros d'urgence** : 17 police · 18 pompiers · 15 SAMU · 112 partout en
Europe · 114 sourd / malentendant / mal communicant.

**Enregistrement** : observations / consignes particulières, puis **nom et
prénom du chef d'entreprise (ou de son représentant), date, signature**.

---

## 5. Ce que le dépôt a déjà, et ce qui manque

**Ce qui suit est une lecture de code, pas un constat d'écran.** Aucun écran n'a
été ouvert (`.claude/rules/regarder-l-ecran.md`) : une session qui reprend doit
REGARDER avant d'affirmer quoi que ce soit sur ce que le patron voit —
`npm run voir -- /planning`, `npm run voir -- <l'écran de la fiche>`.

| Ce que la fiche demande | Ce que le dépôt paraît porter | À vérifier |
|---|---|---|
| Nom du chantier, lieu, n° de devis | oui — `chargerFicheChantierPourPdf` les charge déjà pour la fiche de chantier | l'adresse exacte, les coordonnées GPS |
| Donneur d'ordre (nom, prénom, téléphone) | le client du chantier | est-ce toujours le donneur d'ordre ? *(question au patron, §6)* |
| Dates d'exécution début/fin + heures | le planning tient le jour et le créneau (« matin » / « apres-midi »), **pas des heures** | les heures n'existent nulle part — elles ne s'inventent pas |
| Travaux à réaliser | vocabulaire présent : abattage, élagage, haie, dessouchage, fendage, grumes, broyage, évacuation, billonnage (`TODO.md`) | la liste du décret est plus fine (éhouppage, haubanage, démontage avec/sans rétention, rognage) |
| Matériels | `FicheChantierPdfData.materiel` existe | d'où il vient, et s'il couvre les trois familles du formulaire |
| Croquis / photo | des photos de chantier existent | comment elles sont rangées, et si une peut porter le rôle « croquis » |
| Signature | **rien trouvé** | c'est du travail neuf |
| Conservation 2 ans | `src/server/repositories/retention.ts` existe | ce qu'il tient, et si 2 ans s'y accordent |
| PDF | `document-commun.ts` compose déjà trois documents | la quatrième pièce s'y greffe |

**Ce qui manque à coup sûr** : la signature, les cases à cocher de risques, le
PRS, les consignes de secours, et la conservation obligatoire.

---

## 6. Ce qu'il faut lui demander avant de dessiner

**Ne pas coder avant ses réponses.** Chacune change ce qu'il y a à faire.

1. **Travaille-t-il seul, ou avec des salariés ?** « Communiquée et présentée aux
   travailleurs » n'a pas le même poids s'il est seul dans l'arbre. La fiche
   reste due dans les deux cas — c'est l'écran qui change.
2. **Le donneur d'ordre est-il toujours le client du devis ?** Sur un chantier
   de sous-traitance ou de copropriété, non. Le formulaire distingue les deux.
3. **Veut-il la fiche sur TOUS les chantiers d'élagage/abattage, ou seulement
   quand il la juge utile ?** Le décret ne laisse pas le choix ; l'application,
   si — elle peut la proposer ou l'imposer.
4. **La signature : au doigt sur le téléphone, ou une signature enregistrée une
   fois pour toutes ?** Le formulaire demande nom, prénom, date, signature.
5. **Veut-il que la fiche parte au donneur d'ordre** quand il y a un plan de
   prévention (art. L. 4511-1) ?
6. **Combien de fois par an ?** S'il fait trois chantiers d'élagage par an, un
   PDF pré-rempli à compléter à la main vaut peut-être mieux qu'un écran.

---

## 7. Comment ce lot doit se faire

**Les règles du dépôt qui s'appliquent ici**, et qui ne se rediscutent pas :

| | |
|---|---|
| `CLAUDE.md` §3 bis | **la maquette d'abord.** Elle vit dans `appli/`, un lien l'ajoute à `appli/essais.html`, et **on ne lui donne l'adresse qu'une fois qu'elle répond** (200) |
| `CLAUDE.md` §3 bis, 2 ter | **on ne lui envoie jamais une capture de la maquette** — l'adresse entière, jamais tronquée |
| `CLAUDE.md` §3 | le français partout · **le moins de mots possible à l'écran** · aucune flèche décorative · aucune couleur écrite en clair |
| `CLAUDE.md` §4 | **rien ne s'invente** : une mention sans source reste vide et le dit. Ni heures, ni distances, ni numéro d'article inventés |
| `CLAUDE.md` §4 quater | pas de pansement — la racine, ou `pansement assumé : <raison>` plus une entrée `TODO.md` |
| `CLAUDE.md` §4 sexies | les couches : la règle pure dans `src/lib/`, le PDF et la base dans `src/server/`, l'écran ne décide de rien |
| `.claude/rules/testing.md` | **le niveau se calcule** : `npm run niveau`. Ce document seul est niveau 1 ; du code dans `src/` ne l'est pas |
| `CLAUDE.md` §6 | une tâche = **un lot isolé**, parti de `origin/main` propre |

**Et un avertissement de fond.** Une fiche de sécurité qui affirme à tort qu'un
risque est couvert est pire qu'une fiche absente : c'est le raisonnement du
§4 ter sur l'arrosage, et il vaut ici davantage encore. Une case pré-cochée par
l'application, un « Point de Rencontre Secours » deviné, une distance de
sécurité posée par défaut — chacun est un mensonge qu'on signe. **Ce que
l'application ne sait pas reste vide, et l'écran le dit.**

---

## 8. Sources

Le formulaire officiel et sa notice — **c'est la source à recopier** :

- Fiche d'intervention, MSA réf. 12350 :
  `https://ssa.msa.fr/wp-content/uploads/2023/12/12350_A-_FICHE-DINTERVENTION_WEB.pdf`
- Notice « Comment la remplir ? » :
  `https://ssa.msa.fr/wp-content/uploads/2023/12/12350_Notice_fiche_intervention_WEB.pdf`

Le texte, à lire à la source (non vérifié depuis un environnement d'agent) :

- Décret n° 2021-1833 du 24 décembre 2021 :
  `https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000044572758`
- Code rural, section « travaux forestiers et sylvicoles », art. R. 717-77 et suivants
- FAQ du ministère de l'Agriculture sur le décret 2021-1833
- DREETS Centre-Val de Loire, « Nouvelles règles de sécurité applicables à
  certains chantiers d'abattage et d'élagage »

Textes voisins, **qui ne sont pas remplacés par la fiche** :

- Arrêté du 4 août 2005, prévention des chutes lors des travaux réalisés dans
  les arbres au moyen de cordes
- Code du travail, art. R. 4323-89 (travaux sur cordes) et R. 4511-1 et suivants
  (plan de prévention)
- Le document unique d'évaluation des risques (DUERP), qui reste dû par ailleurs
