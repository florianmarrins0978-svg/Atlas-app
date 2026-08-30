# « J'ai vu » sur toutes les notifications

*30 août 2026 — ce qui a été fait, et ce que ça change pour vous.*

## Ce que vous avez demandé

> « Pour chaque notification je dois pouvoir cliquer sur vu pour les faire
> disparaître. Pourquoi certaines n'ont pas cette fonction ? Mets la fonction
> pour toutes. »

Vous aviez raison : sur les six sortes de cartes de l'accueil, **trois
n'offraient aucun geste**.

| La carte | Avant | Maintenant |
|---|---|---|
| Réponse d'un client | J'ai vu | J'ai vu |
| Devis caduc | J'ai vu | J'ai vu |
| Chantier sans devis | *rien* | **J'ai vu** |
| Devis sans réponse | *rien* | **J'ai vu** |
| À facturer | *rien* | **J'ai vu** |
| Facture impayée | « Plus tard » | **J'ai vu** |

## Ce que « J'ai vu » fait exactement

**Sur une réponse de client** — la carte part pour de bon. Rien ne change.

**Sur un rappel** — la carte part, et le rappel **se tait le temps de son
délai** : sept jours pour un devis sans réponse, quatre pour un chantier sans
devis, trois pour un chantier fini non facturé, une semaine pour une facture
impayée. Si rien n'a bougé passé ce délai, il revient.

**Pourquoi il revient.** Un rappel effacé pour toujours ferait exactement ce
qu'il sert à éviter : un devis qui dort, et plus personne pour le dire. Le
délai est celui que vous avez réglé vous-même — c'est vous qui décidez à quel
rythme on vous reprend.

**Pour ne plus jamais voir un rappel :** l'interrupteur est dans
**Réglages › Notifications**. Éteint, il ne revient pas.

## Ce qui a changé d'un mot

« Plus tard », sur la facture impayée, s'appelle maintenant « J'ai vu » comme
les autres. **Rien d'autre n'a changé sur cette carte** : elle se tait le temps
du rythme que vous avez choisi, la facture reste dans « Terminés › TVA › En
attente de paiement », et elle revient tant qu'elle n'est pas payée. Deux mots
pour le même geste sur deux cartes voisines, c'était une différence à chercher
là où il n'y en avait pas.

## Ce qui a été refusé, et pourquoi

**Effacer un rappel définitivement.** C'était la lecture littérale de « faire
disparaître », et elle coûte cher : un chantier rangé d'un doigt un soir de
fatigue ne réapparaît jamais. Un devis oublié, c'est un chantier perdu ; une
facture oubliée, c'est de l'argent qui ne rentre pas. La carte disparaît bien —
elle revient seulement si la situation dure encore. Si vous voulez malgré tout
l'effacement définitif, dites-le : c'est une ligne à changer.

## Ce qui a été vérifié

| | Résultat |
|---|---|
| Types, lint | 0 erreur |
| Règles pures | 6 contrôles neufs — le silence, son délai, les genres acceptés |
| Suites base de données | **286/286**, dont 6 contrôles neufs : l'acquit survit au rechargement, revient au bon jour, ne déborde pas sur une autre entreprise |
| Suites navigateur | **118/118** — dont le bouton sur un rappel, et la carte qui ne revient pas après rechargement |
| Connexion derrière un proxy | verte |

**Une précision sur les suites navigateur, et elle est honnête** : elles n'ont
pas pu être jouées d'une traite sur cette machine — le serveur de
développement s'y fait tuer par manque de mémoire au bout de quelques suites,
un défaut d'outillage connu et consigné le matin même, sans rapport avec ce
lot. Elles ont donc été rejouées par tranches, puis une par une pour les
vingt-sept qu'une tranche n'avait pas pu finir : **toutes vertes**, et les
trois rouges de la première passe le sont redevenues telles quelles, sans
qu'une ligne de code change.

**Une garde a été écrite puis retirée avant livraison** : elle devait faire
reparler un devis renvoyé après un « J'ai vu ». En la mettant à l'épreuve, elle
ne pouvait jamais servir — le renvoi met de toute façon plus de temps à devenir
rappelable que le silence à s'achever. Un contrôle qu'on ne peut pas voir
échouer ne prouve rien : il est parti, et un vrai essai le montre à sa place.
