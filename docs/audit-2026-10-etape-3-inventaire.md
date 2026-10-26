# Audit de sécurité d'octobre 2026, étape 3 : l'inventaire

*25 octobre 2026. Quatre relevés en lecture seule (routes, actions serveur, base, flux extérieurs et CI). Chaque point classé « confirmé » a été relu dans le code par moi, pas seulement rapporté.*

## Le verdict

**Le cloisonnement ENTRE artisans tient.** 86 tables sous RLS forcée, le contexte posé de façon transactionnelle, aucune action ne prend l'entreprise dans la requête, aucun jeton public n'ouvre plus que son document. Aucune fuite d'une entreprise vers une autre n'a été trouvée.

**Les failles sont DANS une même entreprise** (quel rôle peut faire quoi, quels champs une action accepte), **et sur ton espace lui-même**.

## Ce qui est à corriger, par gravité

| # | Faille | Gravité | État |
|---|---|---|---|
| **E1** | La clé qui signe les sessions de ton espace (`AUTH_SECRET`) est écrite dans le dépôt public (`.devcontainer/docker-compose.yml`). Avec elle, on fabrique un cookie de connexion ; elle chiffre aussi les mots de passe d'agenda Apple et les codes de double vérification. Il faut en plus l'identifiant interne d'un compte, impossible à deviner, et l'adresse de ton espace, qui figure dans chaque lien de devis envoyé | **élevée** | **corrigé le 25 octobre** : une clé propre à ton espace, tes secrets re-chiffrés. Une déconnexion au prochain allumage |
| **E2** | Un commercial ou la facturation réécrit l'identité de l'entreprise et son **IBAN** depuis l'écran du devis : l'action accepte n'importe quel champ, et la preuve d'identité se fait avec SON propre mot de passe | **élevée** | **corrigé le 25 octobre** |
| **E3** | N'importe quel rôle, salarié compris, pose une **remise** sur le devis de n'importe quel chantier : la branche « réduction » des retouches n'a aucune garde | **élevée** | **corrigé le 25 octobre** |
| **E4** | « Durée et équipe » d'un chantier accepte n'importe quelle colonne du chantier (date planifiée, autoliquidation, dates de facture…) | **élevée** | **reproduit, corrigé le 25 octobre** |
| **E5** | La feuille de chantier en PDF s'ouvre pour tout rôle, sur tout chantier de l'entreprise, sans contrôle de portée | moyenne | **corrigé le 25 octobre** |
| **E6** | Un salarié peut effacer une photo d'un chantier qui n'est pas le sien, par la fiche de sécurité | moyenne | **reproduit, corrigé le 25 octobre** |
| **E7** | Deux autres écritures acceptent des champs en trop (client du devis, lignes de prix : déplacer une ligne vers un autre chantier) | moyenne | **corrigé le 25 octobre** |
| **E8** | La garde des rôles des PAGES vit dans le gabarit racine, que Next.js ne rejoue pas à la navigation interne : un commercial pourrait recevoir les données d'une page qui lui est fermée | **élevée** (reproduit : un commercial lisait Ma TVA en passant par Chantiers) | **corrigé le 25 octobre** : chaque écran pose sa garde lui-même |
| **E9** | Droits de la base plus larges que le besoin : l'application peut écrire le registre des migrations, les conditions générales, supprimer une entreprise entière | moyenne (défense en profondeur) | **corrigé le 25 octobre** (migration 0147) |
| **E10** | Liens entre tables non composites (paiement et facture, acompte et devis…) : la base n'empêche pas de rattacher un élément à une autre entreprise | moyenne (défense en profondeur) | **corrigé le 26 octobre** pour les lignes neuves (migration 0149) |
| **E11** | Donner un accès, changer un rôle (jusqu'à créer un second patron), résilier : sans redemander le mot de passe | moyenne | **corrigé le 26 octobre** pour les accès ; la résiliation **gardée telle quelle, délibérément** |
| **E12** | Liens clients en clair en base, certains sans expiration (contrat, passages) ; lien du comptable valable un an | moyenne | **gardé tel quel, délibérément** : voir plus bas |
| **E13** | Les libellés des lignes de devis entrent dans la consigne système de l'IA (retouches) ; aucun plafond de dépense d'IA par mois | moyenne | **corrigé le 26 octobre** : consigne, et plafond mensuel de crédits IA selon tes montants |
| **E14** | Sans `ATLAS_PROXY_SAUTS`, les seuils par source deviennent communs à tous : un inconnu peut bloquer les inscriptions ou le mot de passe oublié de tout le monde, ou verrouiller un compte dont il connaît l'adresse | moyenne | dépend du déploiement |
| **E15** | Chaîne logicielle : actions GitHub épinglées par étiquette, `pages.yml` donne ses droits de publication à l'étape qui installe les paquets, aucun délai avant d'installer une version neuve, `demarrer.sh` retombe sur `npm install` | moyenne | **corrigé le 26 octobre** (versions figées, droits réduits) ; le délai et le repli gardés, voir `ARCHITECTURE.md` §511 |
| **E16** | `/api/health/diagnostic` et `/api/health/banc` répondent sans compte (en-têtes reçus, version servie) | faible | **gardé tel quel, délibérément** : la page sert quand on ne peut pas se connecter, et ne porte aucun secret |
| **E17** | Petits défauts : `choisirLeMotDePasse` sans cadence, une adresse e-mail se devine par le mot de passe oublié, un GET qui écrit, un 500 au lieu d'un refus | faible | **mot de passe oublié borné le 25 octobre** ; le reste en vague 3 |

## Ce qui a été vérifié et qui tient

| | |
|---|---|
| Isolation par la base | 86 tables cloisonnées et forcées, contexte transactionnel, rôles sans `BYPASSRLS` |
| Fonctions privilégiées | 5 fonctions de mot de passe, chemin de recherche épinglé, aucune ne rend le condensat |
| Jetons publics | 256 bits, chacun borné à son document |
| Crochet de paiement | signature vérifiée en temps constant, rejeu refusé |
| Requêtes vers l'extérieur | une seule destination venue d'une donnée (agenda Apple), filtrée et revérifiée à chaque redirection |
| Rendu des réponses d'IA | ni HTML, ni lien, ni image chargée |
| En-têtes | CSP, HSTS, anti-cadre, `nosniff` |

## Ce qui n'a pas été vérifié

- les cookies de session réels (valeurs par défaut d'Auth.js supposées) ;
- les droits par défaut des workflows GitHub du dépôt (réglage du site GitHub) ;
- la protection de la branche `main` sur GitHub ;
- tout ce qui dépend de l'hébergeur de production, qui n'existe pas encore.

## E10 et E12, le 26 octobre

**E10, corrigé.** La base refuse désormais qu'un paiement, un acompte, une photo ou un retour d'intervention d'une entreprise vise une ligne d'une autre entreprise. Vingt-six liens sont concernés. Aucun code ne le faisait : c'est une protection pour la porte que personne n'a encore écrite. Les anciennes lignes ne sont pas revérifiées tout de suite, pour qu'une donnée ancienne imprévue ne bloque pas la mise à jour de ton espace ; c'est noté pour plus tard.

**E12, gardé tel quel.** Les liens envoyés à tes clients (devis, factures, contrats, rapports de passage) restent comme ils sont. Les faire expirer ferait perdre à ton client le contrat qu'il a reçu ; les stocker autrement t'empêcherait de recopier le lien d'un devis déjà envoyé. Chaque lien est impossible à deviner, et n'ouvre que son propre document. Le lien du comptable était déjà protégé autrement, et il dure un exercice.

## Les crédits IA du mois, faits le 26 octobre

Tes plafonds : essai 5 €, Artisan 10 €, Entreprise 20 €, Illimité 60 €, sans abonnement 10 €. Chaque appel à l'IA payante se compte (une estimation, toujours un peu au-dessus de la vraie facture) ; au plafond, il ne part plus, et la saisie à la main continue. Sur Abonnement, la barre de ta planche, en rouge une fois épuisée. Une dictée refusée le dit : « Crédits IA épuisés. Atlas IA reprend le 1er novembre. D'ici là, tout s'écrit à la main. »

**Pour ton entreprise, sans plafond**, une fois sur ton espace : `npm run ia:sans-plafond -- ton@adresse`, puis rallumer l'espace.

Pas vérifiable ICI : la phrase dans l'écran de dictée avec une vraie transcription (pas de clé sur ce poste). La barre, elle, a été regardée à l'écran dans ses trois états.

## E13, fait le 26 octobre (moitié)

Quand tu dictes une correction sur un devis, l'IA reçoit les lignes du devis. Elles arrivaient au milieu de nos propres règles, avec la même autorité. Or une ligne peut venir d'un devis fournisseur importé : une phrase rédigée comme un ordre y aurait été obéie. Le devis passe désormais à part, comme une donnée, et une ligne ne peut plus en fabriquer une fausse. C'était déjà fait ainsi pour la lecture des dictées de chantier.

Pas vérifiable ICI avec la vraie IA (pas de clé sur ce poste) ; sur ton espace : `npm run verifier:dictee`.

**Le plafond de dépense d'IA par mois attend ta décision** : combien par artisan, et ce qui se passe quand il est atteint (l'IA se coupe jusqu'au mois suivant, ou seulement un avertissement). Sans plafond, un compte volé ou un abus peut faire monter ta facture chez le fournisseur.

## E11, fait le 26 octobre

Donner un accès, changer un rôle et retirer un accès redemandent désormais le mot de passe, avec la même fenêtre que pour l'IBAN. La raison : quelqu'un qui volerait ta session pourrait se créer son propre compte, ou se nommer patron, et garder la porte même après que tu as changé ton mot de passe. Reproduit rouge (les trois gestes passaient sans rien demander), vert après, et joué dans un vrai navigateur.

Une saisie fausse (confirmation qui diffère) se corrige d'abord, sans te demander ton mot de passe pour rien.

**La résiliation n'est pas protégée, et c'est voulu.** Ta décision d'avant était qu'elle reste facile. Elle ne coupe rien avant la date payée, et « Ne pas arrêter » l'annule. Un mot de passe de plus ne protégerait presque rien et gênerait le vrai cas.

**Ce qui n'est pas protégé non plus** : régler ce qu'une personne voit du planning, et relier un compte à son nom de salarié. Ces deux gestes n'ouvrent ni les prix ni l'entreprise.

## E8, fait le 25 octobre

La garde des rôles vivait dans le gabarit commun à tous les écrans. Next.js ne le rejoue pas quand on passe d'un écran à l'autre par un clic : un commercial connecté, parti de Chantiers, recevait l'écran Ma TVA avec la TVA collectée et déductible. L'adresse tapée à la main, elle, était bien refusée ; c'est pourquoi rien ne l'avait montré.

Chaque écran pose désormais sa garde en première ligne (90 écrans). `scripts/test-garde-des-pages-e2e.ts` refait le geste dans un vrai navigateur (commercial vers Ma TVA, salarié vers Clients, et le patron qui y arrive toujours), rouge avant, vert après. `scripts/test-pages-gardees.ts` refuse tout écran neuf qui oublierait la garde ou la poserait après une lecture.

Même faiblesse, moins grave, pour la vérification de l'adresse et l'acceptation des conditions : ces deux gardes restent dans le gabarit, notées dans `TODO.md`.

## La vague 2, faite le 25 octobre

E2 à E7 sont corrigés. Chaque faille a été reproduite sous le vrai rôle (commercial, salarié réglé sur son équipe), avec la requête qu'un attaquant écrirait, vue rouge, corrigée là où la donnée s'écrit, puis vue verte : `scripts/test-roles-dans-l-entreprise-db.ts`, onze cas. Sur l'écran du devis, un commercial lit l'en-tête de l'entreprise sans pouvoir l'écrire (vérifié à l'écran). Le contrôle des gardes refuse désormais une garde qui vit dans une seule branche.

