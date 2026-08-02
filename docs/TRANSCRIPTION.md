# Choisir qui écoute vos dictées

Ce document sert une seule décision : **à qui confier l'audio de vos notes
vocales**. C'est le point 1 de [`A-FAIRE.md`](A-FAIRE.md), et le dernier verrou
entre vous et une dictée qui fonctionne pour de bon.

---

## Sommaire

1. [Ce que je n'ai pas pu vérifier](#ce-que-je-nai-pas-pu-vérifier)
2. [Ce qui marche déjà, sans rien acheter](#ce-qui-marche-déjà-sans-rien-acheter)
3. [Ce que ça change de brancher un prestataire](#ce-que-ça-change-de-brancher-un-prestataire)
4. [Les cinq questions à poser, et pourquoi](#les-cinq-questions-à-poser-et-pourquoi)
5. [Les candidats, et où ils en sont dans le code](#les-candidats-et-où-ils-en-sont-dans-le-code)
6. [La grille à remplir](#la-grille-à-remplir)
7. [Combien ça coûte, en ordre de grandeur](#combien-ça-coûte-en-ordre-de-grandeur)
8. [Ce que je fais le jour où vous tranchez](#ce-que-je-fais-le-jour-où-vous-tranchez)

---

## Ce que je n'ai pas pu vérifier

**Aucun tarif de ce document n'a été lu à la source.** L'environnement où
Atlas est développé passe par un mandataire réseau qui refuse les pages
tarifaires de tous les prestataires interrogés — Deepgram, OpenAI, Google,
Gladia, Scaleway, Mistral ont tous répondu `403 Forbidden`.

Je ne vous donne donc **aucun chiffre**. Ce document est une grille de décision :
les bonnes questions, les bons candidats, et un tableau à remplir avec ce que
vous lirez chez eux. Un tarif inventé vous ferait choisir de travers, et vous ne
le découvririez qu'à la première facture.

Les tarifs de ce métier changent plusieurs fois par an. Même vérifiés
aujourd'hui, ils seraient à revérifier avant de signer.

---

## Ce qui marche déjà, sans rien acheter

**Le micro de votre clavier.** Sur l'écran Transcription, touchez le cadre puis :

| | |
|---|---|
| **iPhone** | l'icône **microphone** en bas du clavier |
| **Windows** | les touches **`Win` + `H`** |

Vous parlez, le texte s'écrit, et tout le parcours s'enchaîne — brouillon,
prestations, prix, devis. C'est votre appareil qui transcrit : rien ne part chez
personne, et il n'y a aucun contrat à signer.

**Ce que ça ne fait pas** : transcrire une note vocale *enregistrée*. Il faut
être devant l'écran au moment où vous parlez. Dicter sur le chantier puis
retrouver le texte le soir, ça demande un prestataire.

> **Pourquoi je n'ai pas mis ce micro dans l'application.** Le navigateur sait
> le faire (l'API de reconnaissance vocale du Web), mais sur Chrome cette
> fonction **envoie l'audio chez Google**. Ce serait exactement l'écart décrit au
> point 1 : un sous-traitant qui ne figure dans aucun contrat, avec le nom et
> l'adresse de vos clients dedans. Le micro du clavier, lui, est un choix que
> vous faites sur votre appareil — ce n'est pas la même chose.

---

## Ce que ça change de brancher un prestataire

| | Micro du clavier | Prestataire branché |
|---|---|---|
| Dicter devant l'écran | ✅ | ✅ |
| Dicter sur le chantier, relire plus tard | ❌ | ✅ |
| Note vocale conservée comme preuve | ❌ | ✅ |
| Coût | zéro | à l'usage |
| Contrat de sous-traitance | aucun | **obligatoire** |

Le vrai gain n'est pas le confort : c'est de pouvoir **parler pendant que vous
travaillez**, sans écran, et retrouver un devis prêt.

---

## Les cinq questions à poser, et pourquoi

Les trois premières viennent de [`A-FAIRE.md`](A-FAIRE.md) §1. Les deux
dernières sont apparues en construisant l'application.

### 1. Où sont vos serveurs ?

Hors d'Europe, il faut un encadrement contractuel supplémentaire — et c'est
l'avocat du point 2 qui le rédige, donc du temps et de l'argent en plus. En
Europe, la question ne se pose pas.

**Piège** : « nous sommes conformes au RGPD » ne veut pas dire « nos serveurs
sont en Europe ». Demandez la localisation, pas la conformité.

### 2. Combien de temps gardez-vous ce que je vous envoie ?

Certains conservent 30 jours « pour la sécurité ». C'est autant de temps où la
voix de votre client, son nom et son adresse vivent ailleurs que chez vous.

**Ce qu'il faut viser** : zéro conservation, ou quelques heures au maximum.
Beaucoup le proposent, mais **il faut le demander** — ce n'est jamais le réglage
par défaut.

### 3. Vous en servez-vous pour entraîner vos modèles ?

Le point le plus important, et celui qu'on oublie. Cela se refuse
contractuellement — mais il faut l'écrire noir sur blanc. Sans clause explicite,
la réponse par défaut de plusieurs prestataires est « oui ».

### 4. Reconnaissez-vous le vocabulaire de métier ?

« Rabattre », « abattage par démontage », « rétention », « broyage sur place »,
« haubanage ». Un moteur généraliste écrira « rabattre » en « rabattu » et
« haubanage » en « aubaine ». C'est la différence entre un devis à relire et un
devis à réécrire.

**À demander** : un lexique personnalisable. Plusieurs le proposent sous le nom
de *keywords*, *boost* ou *custom vocabulary*.

### 5. Que se passe-t-il quand ça échoue ?

Réseau coupé sur un chantier, service en panne, audio inaudible. Atlas ne perd
jamais l'enregistrement et vous pouvez toujours écrire le texte à la main — mais
un prestataire qui échoue en silence, sans message, vous laisserait croire que
vous n'avez rien dicté.

---

## Les candidats, et où ils en sont dans le code

**Trois sont déjà écrits et prêts à être activés.** Le jour où vous tranchez,
c'est une variable d'environnement — pas du développement.

| Prestataire | Dans le code | Remarque |
|---|---|---|
| **OpenAI** (Whisper) | ✅ `providers/transcription/openai.ts` | Le plus connu ; serveurs hors d'Europe sauf offre spécifique |
| **Deepgram** | ✅ `providers/transcription/deepgram.ts` | Réputé rapide ; lexique personnalisable |
| **Google** (Speech-to-Text) | ✅ `providers/transcription/google.ts` | Offre des régions européennes |

**Deux méritent d'être regardés, et ne sont pas encore écrits** — compter une
demi-journée pour en ajouter un :

| Prestataire | Pourquoi le regarder |
|---|---|
| **Gladia** | Entreprise française, orientée transcription |
| **Mistral** | Entreprise française ; modèle audio récent |

> Je cite ces deux-là parce qu'ils sont **français**, ce qui simplifie le point 2
> (le contrat) et le point 1 (la localisation). **Je n'ai vérifié ni leurs
> tarifs, ni leurs conditions, ni même que leur offre existe toujours** — le
> réseau me refuse leurs pages. À confirmer chez eux avant toute décision.

---

## La grille à remplir

Posez les cinq questions à deux ou trois candidats, et remplissez :

| | Candidat A | Candidat B | Candidat C |
|---|---|---|---|
| Nom | | | |
| Serveurs en Europe ? | | | |
| Durée de conservation | | | |
| Entraînement refusé par écrit ? | | | |
| Lexique métier possible ? | | | |
| Prix pour 60 min d'audio | | | |
| Prix pour 10 h d'audio | | | |
| Contrat de sous-traitance fourni ? | | | |

**Les deux lignes de prix comptent ensemble.** Certains sont bon marché en
petite quantité et chers ensuite, d'autres l'inverse. Estimez votre volume
réel : *nombre de chantiers par semaine × durée moyenne d'une dictée*.

Pour dix chantiers par semaine et deux minutes de dictée chacun, cela fait
**environ 1 h 30 d'audio par mois** — un volume faible, où le prix au menu
compte moins que les conditions.

---

## Combien ça coûte, en ordre de grandeur

**Je ne peux pas vous le dire honnêtement.** Aucune page tarifaire n'a été
accessible.

Ce que je peux dire sans risque : à ce volume-là — une heure et demie d'audio
par mois — **le coût de la transcription ne sera pas ce qui décide**. Ce qui
décide, ce sont les questions 1 à 3 : où vivent les données de vos clients,
combien de temps, et si quelqu'un s'en sert.

Ne choisissez pas au prix. Choisissez à la réponse écrite sur ces trois points.

---

## Ce que je fais le jour où vous tranchez

1. **Activer le prestataire retenu** — une variable, quelques minutes.
2. **Verrouiller les autres**, pour qu'aucun ne puisse être activé par
   inadvertance.
3. **L'inscrire dans [`RGPD.md`](RGPD.md) §3** comme sous-traitant ultérieur,
   avec sa localisation et sa durée de conservation.
4. **Éprouver la vraie chaîne** : dicter, transcrire, extraire, chiffrer, et
   regarder ce que ça donne sur votre vocabulaire d'élagueur. C'est là que les
   surprises apparaissent, pas dans la documentation du prestataire.
5. **Vérifier que l'échec est visible** : couper le réseau, envoyer un audio
   vide, et s'assurer que l'écran le dit clairement.

---

**Dernière chose, et elle compte.** Rien de tout cela ne vous empêche d'utiliser
Atlas dès aujourd'hui : le micro de votre clavier fait le travail devant l'écran,
et tout le reste du parcours — devis, envoi, réponse du client, planification,
facture, TVA — fonctionne sans aucun prestataire.
