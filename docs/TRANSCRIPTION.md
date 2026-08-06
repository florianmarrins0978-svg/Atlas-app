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

**Deux tarifs sur six ont été lus à la source ; les quatre autres, non.**
L'environnement où Atlas est développé passe par un mandataire réseau qui refuse
la plupart des pages tarifaires — OpenAI, Deepgram, Mistral et Gladia répondent
`403 Forbidden`.

Ce qui a changé : ces pages se lisent désormais **depuis une machine de GitHub**,
qui a le réseau que l'environnement de développement n'a pas. Le relevé se
relance à la demande, et §7 porte ce qu'il a rapporté.

**Aucun chiffre de ce document n'est supposé.** Ce qui n'a pas été lu est marqué
« non lu » plutôt qu'estimé : un tarif inventé vous ferait choisir de travers, et
vous ne le découvririez qu'à la première facture.

Les tarifs de ce métier changent plusieurs fois par an. Même relevés
aujourd'hui, ils sont à relancer avant de signer — c'est une commande, pas une
enquête.

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

**Un seul est réellement écrit.** Le jour où vous le retenez, c'est une variable
d'environnement — pas du développement. Pour les autres, il reste du travail.

| Prestataire | Dans le code | Remarque |
|---|---|---|
| **OpenAI** (Whisper) | ✅ écrit et complet — `providers/transcription/openai.ts` | Le plus connu ; serveurs hors d'Europe sauf offre spécifique |
| **Deepgram** | ⚠️ **coquille vide** — `providers/transcription/deepgram.ts` | L'activer aujourd'hui renvoie « fournisseur non implémenté » sur chaque dictée. Réputé rapide ; lexique personnalisable |
| **Google** (Speech-to-Text) | ⚠️ **coquille vide** — `providers/transcription/google.ts` | Même chose. Offre des régions européennes |

> **Pourquoi cette ligne a changé.** Ce tableau annonçait trois prestataires
> « prêts à être activés ». C'était faux : deux d'entre eux ne contiennent qu'un
> refus poli, et la dictée serait tombée en panne au premier essai. Vous auriez
> pu ouvrir un compte et signer un contrat pour rien. Compter une demi-journée
> par prestataire pour les finir — le jour où vous en retenez un.

**Deux autres méritent d'être regardés, et ne sont pas écrits non plus** — même
demi-journée :

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

| | **OpenAI** *(retenu pour les essais)* | Candidat B | Candidat C |
|---|---|---|---|
| Nom | OpenAI (Whisper) | | |
| Serveurs en Europe ? | **Non** — encadrement contractuel requis | | |
| Durée de conservation | Journalisation coupée côté organisation. Côté fournisseur, ~30 jours pour la surveillance des abus — **à confirmer** | | |
| Entraînement refusé par écrit ? | **Oui** — les trois réglages *Data controls → Sharing* sur `Disabled`, le 3 août 2026 | | |
| Lexique métier possible ? | *non vérifié* | | |
| Prix pour 60 min d'audio | *non lu — page refusée à l'agent* | | |
| Prix pour 10 h d'audio | *non lu* | | |
| Contrat de sous-traitance fourni ? | *à demander* | | |

> **Première colonne remplie le 3 août 2026**, en ouvrant le compte pour les
> essais du patron. Ce n'est pas un choix définitif : c'est un candidat éprouvé,
> avec ce qu'on sait et ce qu'on ne sait pas encore. Les cases *non vérifié* et
> *à confirmer* sont laissées telles quelles plutôt que remplies au jugé.

**Les deux lignes de prix comptent ensemble.** Certains sont bon marché en
petite quantité et chers ensuite, d'autres l'inverse. Estimez votre volume
réel : *nombre de chantiers par semaine × durée moyenne d'une dictée*.

Pour dix chantiers par semaine et deux minutes de dictée chacun, cela fait
**environ 1 h 30 d'audio par mois** — un volume faible, où le prix au menu
compte moins que les conditions.

---

## Combien ça coûte, en ordre de grandeur

Ce document a longtemps répondu « je ne peux pas vous le dire » : aucune page
tarifaire n'était accessible depuis l'environnement de développement. Deux le
sont maintenant, et **le relevé se refait à la demande** :

> Onglet **Actions** du dépôt → **Relever les tarifs d'IA à leur source** →
> *Run workflow*. Le rapport s'affiche dans l'exécution.

C'est une machine de GitHub qui va lire les pages, parce qu'elle a le réseau que
l'environnement de développement n'a pas. Elle ne devine rien : une page qu'elle
n'a pas pu lire est signalée comme telle, avec son adresse à consulter à la
main.

### Ce qui a été lu le 3 août 2026

| Poste | Tarif relevé | Source |
|---|---|---|
| **Raisonnement — Claude Haiku 4.5** | 1 $ / million de jetons en entrée, 5 $ en sortie | lu à la source |
| **Raisonnement — Claude Sonnet 5** | 2 $ / 10 $ (tarif de lancement jusqu'au 31 août 2026, puis 3 $ / 15 $) | lu à la source |
| **Raisonnement — Claude Opus 5** | 5 $ / 25 $ | lu à la source |
| **Transcription — Google** | 0,016 $ la minute, **les 60 premières minutes par mois gratuites** | lu à la source |
| **Transcription — OpenAI, Deepgram, Mistral, Gladia** | *non lu* — pages refusées à l'environnement de développement | à relever depuis GitHub |

### Ce que ça ferait par mois, chez vous

Au volume estimé plus haut — 43 chantiers, 1 h 30 d'audio :

| | Par mois |
|---|---|
| Transcription (Google, 60 min gratuites + 30 min payantes) | **≈ 0,50 $** |
| Raisonnement, au moins cher (Haiku 4.5) | **≈ 1,50 $** |
| Raisonnement, au plus cher (Opus 5) | **≈ 7,50 $** |
| **Total** | **entre 2 et 8 $, soit environ 2 à 7 €** |

> **D'où sortent ces jetons.** Le calcul part de la taille réelle des textes
> qu'Atlas envoie — ses consignes, votre dictée, les allers-retours de
> l'assistant — mesurée dans le code, puis arrondie largement vers le haut.
> Le vrai chiffre sera plus bas que celui-ci, pas plus haut.

**Ce que ça veut dire.** Le prix ne décide pas. Un abonnement téléphonique coûte
dix fois ça. Ce qui décide, ce sont les questions 1 à 3 : où vivent les données
de vos clients, combien de temps, et si quelqu'un s'en sert.

Ne choisissez pas au prix. Choisissez à la réponse écrite sur ces trois points.

### Et si ça ne coûtait rien du tout ?

Trois façons de ne rien payer, et ce que chacune coûte ailleurs :

| Façon | Ce que ça coûte vraiment |
|---|---|
| **Le micro de votre clavier** | Rien. Fonctionne déjà, aucun contrat, aucune donnée qui part. Mais pas de note vocale enregistrée : il faut être devant l'écran |
| **Les 60 minutes gratuites de Google** | Rien jusqu'aux deux tiers de votre volume. Mais Google reste un sous-traitant à inscrire au contrat : gratuit ne veut pas dire sans obligation |
| **Les offres gratuites d'autres prestataires** | **Vos données.** Le gratuit s'y paie en autorisation d'entraîner leurs modèles sur ce que vous envoyez — exactement ce que la question 3 vous dit de refuser |

La troisième est la seule vraie fausse bonne affaire, et c'est la plus tentante.

---

## Ce que je fais le jour où vous tranchez

1. **Écrire le raccordement**, si ce n'est pas OpenAI — une demi-journée. Si
   c'est OpenAI, il est déjà écrit et l'étape saute.
2. **Activer le prestataire retenu** — une variable, quelques minutes.
3. **Verrouiller les autres**, pour qu'aucun ne puisse être activé par
   inadvertance.
4. **L'inscrire dans [`RGPD.md`](RGPD.md) §3** comme sous-traitant ultérieur,
   avec sa localisation et sa durée de conservation.
5. **Éprouver la vraie chaîne** : dicter, transcrire, extraire, chiffrer, et
   regarder ce que ça donne sur votre vocabulaire d'élagueur. C'est là que les
   surprises apparaissent, pas dans la documentation du prestataire.
6. **Vérifier que l'échec est visible** : couper le réseau, envoyer un audio
   vide, et s'assurer que l'écran le dit clairement.

---

**Dernière chose, et elle compte.** Rien de tout cela ne vous empêche d'utiliser
Atlas dès aujourd'hui : le micro de votre clavier fait le travail devant l'écran,
et tout le reste du parcours — devis, envoi, réponse du client, planification,
facture, TVA — fonctionne sans aucun prestataire.
