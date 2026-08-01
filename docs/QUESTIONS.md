# Mes questions

Les questions posées en cours de route, avec leur réponse. Écrit en langage
courant, pas en jargon — c'est fait pour être relu dans six mois sans avoir à
tout redécouvrir.

**Document modifiable.** Corrigez, complétez, supprimez ce qui ne sert plus.
Une réponse qui a vieilli vaut moins que pas de réponse du tout : si un prix ou
une règle change, rayez l'ancienne plutôt que de la laisser traîner.

Chaque nouvelle question est ajoutée après validation explicite — elle n'y entre
jamais toute seule.

---

## Sommaire

1. [Le compte développeur Apple : qui paie, et combien de temps ?](#1-le-compte-développeur-apple--qui-paie-et-combien-de-temps-)
2. [Faut-il une clé API pour que l'e-mail du client se remplisse ?](#2-faut-il-une-clé-api-pour-que-le-mail-du-client-se-remplisse-)
3. [Pourquoi l'adresse du client ne se met pas toute seule dans le mail ?](#3-pourquoi-ladresse-du-client-ne-se-met-pas-toute-seule-dans-le-mail-)
4. [Si l'application se fait pirater, qu'est-ce que je risque ?](#4-si-lapplication-se-fait-pirater-quest-ce-que-je-risque-)
5. [Comment faire signer un contrat à tous les utilisateurs ?](#5-comment-faire-signer-un-contrat-à-tous-les-utilisateurs-)

---

## 1. Le compte développeur Apple : qui paie, et combien de temps ?

### Qui a besoin du compte ?

**Vous seul.** Une seule fois, pour votre entreprise.

Vos artisans ne paient rien et n'ont aucun compte à créer. Ils vont sur l'App
Store, ils téléchargent Atlas, ils s'en servent — exactement comme ils
téléchargent WhatsApp.

Le compte développeur, c'est **le droit de déposer une application sur l'App
Store**. Rien d'autre. Il ne concerne que celui qui publie.

### Une fois, ou tout le temps ?

**Tout le temps — 99 $ par an.**

Ce n'est pas un achat, c'est un abonnement. Tant que vous le payez, votre
application reste sur l'App Store et vous pouvez la mettre à jour. **Si vous
arrêtez de payer, elle est retirée du magasin.** Ceux qui l'ont déjà installée
la gardent, mais plus personne ne peut la télécharger.

Pour Android, c'est plus simple : **25 $ une seule fois**, à vie.

### Et l'automatisation du mail, elle coûte quoi ?

**Rien de plus.** Elle utilise l'application Mail déjà présente sur l'iPhone de
l'artisan.

Le web n'a pas le droit d'y toucher ; une vraie application, si. Le problème
disparaît parce qu'on n'est plus dans un navigateur, pas parce qu'on paie
quelque chose.

### En résumé

| | Qui paie | Combien | Quand |
|---|---|---|---|
| Compte Apple | Vous | 99 $ | Chaque année |
| Compte Google | Vous | 25 $ | Une seule fois |
| Vos artisans | Personne | 0 | — |
| Le mail pré-rempli | Personne | 0 | — |

**À prévoir en plus : un Mac.** Apple n'autorise la publication iOS que depuis
un Mac, et personne ne peut le faire à votre place — c'est votre compte et votre
identité qui engagent l'application.

---

## 2. Faut-il une clé API pour que l'e-mail du client se remplisse ?

**Non**, pas pour ce problème-là. Une clé ne peut pas remplir un champ qui
n'existe pas dans la fonction employée.

Il y a trois niveaux, et deux règlent la question sans rien payer :

**Aujourd'hui, sur le web — gratuit.** Le PDF est joint automatiquement, et
l'adresse du client est copiée dans le presse-papier : il ne reste qu'à la
coller dans « À : ».

**Dans l'application iOS/Android — gratuit aussi.** Le composeur de mail natif
accepte destinataire, objet *et* pièce jointe. Tout serait rempli d'un coup.
Aucune clé, aucun serveur : juste un module natif à ajouter au moment du vrai
build (voir question 1 pour le compte développeur).

**L'envoi vraiment automatique — là, oui.** Si le devis doit partir sans que
personne ne touche à rien, il faut un service d'envoi (Brevo, Postmark,
Resend…), donc une clé API, un compte, et un serveur pour garder cette clé au
secret. Une clé placée dans une page publique est une clé perdue.

---

## 3. Pourquoi l'adresse du client ne se met pas toute seule dans le mail ?

Parce que **le partage d'iOS n'a pas de champ destinataire**. Ce n'est pas une
erreur de programmation : ce partage peut envoyer vers Mail, WhatsApp ou
Messages, où « À : » n'aurait aucun sens. C'est aussi pour ça que l'objet reste
vide.

Sur ordinateur, l'adresse *est* remplie automatiquement — parce qu'on y emprunte
une autre voie.

### Le choix qu'il a fallu faire

Les deux voies s'excluent, et aucune ne fait les deux :

| | Destinataire rempli | PDF joint |
|---|---|---|
| Partage natif | non | **oui** |
| Lien `mailto:` | **oui** | non |

**Version retenue : le partage natif**, donc le PDF joint d'office, avec
l'adresse copiée dans le presse-papier pour n'avoir qu'à la coller.

> Une version « mail pré-rempli » a été essayée puis abandonnée : elle obligeait
> à joindre le devis à la main, ce qui est plus pénible sur un téléphone que de
> coller une adresse.

Ce compromis disparaît dans l'application native (question 2).

---

## 4. Si l'application se fait pirater, qu'est-ce que je risque ?

> Ce qui suit n'est pas un avis juridique. Le détail est dans
> [`RGPD.md`](RGPD.md), et le contrat doit être écrit par un juriste.

### D'abord : détenir ces données est légal

Ce n'est pas interdit, c'est **encadré**. Le problème n'est jamais de détenir —
c'est de détenir sans le cadre.

### Votre position exacte

- Pour **vos abonnés artisans** → vous êtes responsable de traitement.
- Pour **les clients de vos artisans** → vous êtes **sous-traitant**, et
  l'artisan est le responsable.

Cette seconde relation impose un **contrat** (article 28 du RGPD). Sans lui,
vous êtes en tort *avant même* tout piratage.

### Ce que vous encourez en cas de fuite

- **Amende administrative (CNIL)** : jusqu'à 10 M€ ou 2 % du chiffre d'affaires
  mondial. En pratique, la CNIL commence souvent par une mise en demeure — mais
  l'absence totale de documentation fait basculer vers la sanction.
- **Pénal** : l'article 226-17 du Code pénal punit le défaut de sécurité de
  5 ans de prison et 300 000 € d'amende. Pour une société, le montant est
  quintuplé (1,5 M€). C'est le point que la plupart des gens ignorent.
- **Civil** : les personnes concernées peuvent réclamer des dommages.
- **Contractuel** : vos artisans peuvent se retourner contre vous.
- **Obligation immédiate** : vous devez alerter l'artisan **sans délai**. C'est
  *lui* qui a ensuite 72 heures pour prévenir la CNIL. Réagir en trois jours lui
  fait manquer son délai.

### Ce qui réduit vraiment le risque

| Levier | Effet |
|---|---|
| **Créer une société** plutôt qu'exercer en nom propre | Sépare votre patrimoine personnel. Le plus gros levier, et le moins cher |
| **Assurance cyber / RC pro** | Absorbe l'essentiel du coût d'une fuite |
| **Contrat de sous-traitance** | Obligatoire, et répartit les responsabilités |
| **Hébergement en Europe, chiffrement** | Réduit la faute retenue contre vous |
| **Ne pas garder ce qui ne sert plus** | Ce qu'on ne détient pas ne peut pas fuir |

---

## 5. Comment faire signer un contrat à tous les utilisateurs ?

**Les conditions générales suffisent.** L'article 28.9 accepte l'écrit « y
compris sous forme électronique » : pas de signature manuscrite, pas de papier.
Une case cochée en ligne est valable — c'est ce que font tous les services de ce
type.

Trois conditions pour que ça tienne :

1. **Un document distinct**, annexé aux conditions générales et non dilué
   dedans. Noyé dans vingt pages, un contrôleur peut estimer que l'artisan n'en
   a jamais eu vraiment connaissance.
2. **Une case non pré-cochée**, distincte de celle des conditions générales,
   avec le texte accessible **avant** de cocher.
3. **Une preuve conservée** : qui, quand, quelle version. C'est le point qu'on
   oublie — sans cette trace, l'acceptation est invérifiable le jour exact où
   elle compte.

> **Déjà construit.** Le mécanisme existe dans l'application : documents
> versionnés, cases jamais pré-cochées, et preuve conservée jusqu'à l'empreinte
> du texte exact accepté. **Les textes juridiques, eux, restent à écrire par un
> juriste** — ce sont des canevas sans valeur en l'état.

Dernier point : quand vous changerez de fournisseur d'IA, vous devrez **prévenir
les artisans à l'avance** et leur laisser la possibilité de s'y opposer.
