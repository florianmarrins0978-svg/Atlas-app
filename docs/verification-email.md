# L'adresse d'un compte se prouve par un code — ce qui a été fait

*Lot du 14 septembre 2026. Écrit pour être transmis tel quel.*

## Ce que vous avez constaté

Vous avez créé un compte avec une adresse e-mail qui n'existe pas, et vous êtes
entré. Rien ne vérifiait l'adresse.

## Comment font les applications

Elles laissent créer le compte, mais **rien ne s'ouvre tant que l'adresse n'a
pas répondu** : un code envoyé à l'adresse, à recopier dans l'application. C'est
exactement ce que vous avez proposé. Il n'y avait rien à inventer.

## Ce qui est fait

| | |
|---|---|
| Après « Créer mon compte » | une question de plus, dans le même style que les seize autres : **« Le code reçu à votre@adresse »** — six chiffres, et un « Renvoyer le code » dessous |
| Tant que le code n'est pas entré | **rien ne s'ouvre** : ni l'accueil, ni les conditions générales, ni une nouvelle connexion. Un compte qui ferme l'application à mi-chemin revient sur la case du code |
| Le code | vaut un quart d'heure ; cinq essais, puis il est mort et il faut le renvoyer ; trois renvois par quart d'heure au plus, trente secondes entre deux |
| Sur l'iPhone | le code reçu dans Mail est proposé au-dessus du clavier : rien à recopier |
| Vos comptes actuels | **ne changent pas.** Seul un compte créé par la porte attend un code. Vos salariés, et les comptes venus de Google ou d'Apple, n'en ont pas besoin |
| Sécurité | le code n'est jamais gardé en clair — seule une empreinte l'est, avec le secret du serveur. Une base lue par-dessus l'épaule ne donne aucun code |
| Les conditions générales | « Entrer dans Atlas » y mène désormais **avant** l'accueil — elles ne vous parvenaient qu'en rechargeant la page |

## Ce qui reste à vous : le compte Brevo

Atlas n'envoyait aucun e-mail jusqu'ici. Vous avez choisi **Brevo** (français,
serveurs en France, gratuit jusqu'à 300 e-mails par jour). Trois gestes, une
seule fois :

1. Créer le compte sur brevo.com.
2. Dans **Expéditeurs**, ajouter l'adresse qui enverra les codes (la vôtre
   suffit pour commencer) et la **vérifier** — Brevo vous envoie un e-mail.
3. Dans **Clés API**, créer une clé, puis la coller dans le fichier
   `.env.local` de votre espace, aux deux lignes qui l'attendent :

```
BREVO_API_KEY=xkeysib-…
COURRIEL_EXPEDITEUR=votre@adresse.fr
```

Puis rallumer l'espace. Tant que ces deux lignes sont vides, aucun e-mail ne
part : le code s'écrit dans le journal du serveur, et un compte neuf ne peut
pas entrer. **Dès qu'elles sont remplies, tout fonctionne sans autre geste.**

Ce qui n'est pas demandé : un nom de domaine. Brevo envoie depuis une adresse
vérifiée. Un domaine à vous améliorera plus tard la délivrabilité — il en faudra
un de toute façon (voir *À faire*).

## Ce qui a été refusé, et pourquoi

- **Bloquer les comptes existants** dont l'adresse n'a jamais été vérifiée :
  ce sont les vôtres et ceux de vos salariés, tapés par vous. Les faire passer
  par un code n'aurait rien prouvé et vous aurait enfermé dehors.
- **Un lien à cliquer** plutôt qu'un code : le lien ouvre un navigateur qui
  n'est pas forcément celui où l'on crée le compte ; le code se recopie
  n'importe où, et l'iPhone le propose tout seul.

## Ce qui a été vérifié

- Les règles du code (durée, essais, renvois), sans base : 11 contrôles.
- La base (la ligne naît, compte les essais, disparaît sur le bon code,
  invisible hors de son compte) : 8 contrôles.
- Le parcours entier dans un navigateur : créer le compte, refuser un mauvais
  code, entrer le bon, arriver aux conditions générales ; et un compte à
  mi-chemin renvoyé sur le code depuis l'accueil.
- Le démarrage refuse une production sans Brevo, et une clé sans expéditeur.
- La batterie complète, sur ce PC : base 368/380, navigateur 131/153, connexion
  derrière un proxy verte au rejeu. Les rouges sont ceux que la batterie de la
  veille rendait déjà sur le code sans ce lot (outillage du banc sous Windows,
  suites IA coupées, mesures de fiche) ; quatre suites tombées dans la batterie
  ont été rejouées seules et sont vertes. Aucun rouge nouveau.
