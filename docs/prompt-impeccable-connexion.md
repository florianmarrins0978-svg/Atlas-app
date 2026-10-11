# Le prompt `/impeccable` pour la porte d'Atlas

À coller après `/impeccable` dans une session neuve. Il tient seul.

Écrit le 7 septembre 2026. C'est **le premier écran que voit un artisan**, et le
seul du produit qui ne montre aucune donnée — donc le plus libre.

Sa demande, mot pour mot : *« je veux une page de connexion comme les plus
grandes applis qui existent, avec la reconnaissance faciale, jolie, épurée et
design »*, puis : *« avec la possibilité de se connecter avec son compte Google
ou Apple, comme ce que proposent toutes les applis aujourd'hui. »*

**Deux choses que ce prompt corrige avant tout :** la reconnaissance faciale
**existe déjà** (il l'a choisie le 24 août), et elle porte **un trou de sécurité
ouvert depuis ce jour-là**, vérifié encore aujourd'hui.

---

```
Rends impeccable LA PORTE D'ATLAS — l'écran /login, le premier qu'un artisan
voit. Sa demande : « comme les plus grandes applis qui existent, avec la
reconnaissance faciale, jolie, épurée et design ».

  src/app/login/page.tsx (181 l.), LigneFaceId.tsx (149), actions.ts (277)
  src/server/cle-appareil.ts, src/lib/origine-webauthn.ts, src/auth.ts
  src/server/accueil-apres-connexion.ts

CE QUI EXISTE DÉJÀ — NE LE RÉINVENTE PAS

- **La reconnaissance faciale est CODÉE.** WebAuthn, clés d'appareil, table
  `cles_appareil` (migration 0063). « Ouvrir avec Face ID » est une LIGNE
  au-dessus de la porte : **sa réponse B du 24 août 2026**, sur la planche
  `appli/face-id.html` — *« ta porte d'aujourd'hui, plus une ligne au-dessus.
  Rien ne change de place. »*
- Elle ne s'affiche **que si l'appareil sait le faire**
  (`platformAuthenticatorIsAvailable`) : un bouton qui ne peut pas aboutir est
  pire qu'un bouton absent.
- **L'écran tient déjà dans une page** — 658 px mesurés pour 664 de hauteur
  utile, après sa demande (« qu'elle tienne sur une seule page »).
- Les **cinq phrases grises** ont été retirées à sa demande, et un contrôle
  vérifie qu'elles ne reviennent pas. La promesse « votre visage ne quitte
  jamais votre téléphone » vit dans le mode d'emploi, pas à l'écran.

LA PRIORITÉ 1, ET CE N'EST PAS L'APPARENCE

**Une clé Face ID survit à « déconnecter partout » et au changement de mot de
passe.** Constaté le 24 août 2026, consigné, JAMAIS corrigé — revérifié le
7 septembre :

  · `deconnecterPartout` (repositories/compte.ts:143) efface les preuves et pose
    `jetonsValidesDepuis`, mais **ne touche pas** `cles_appareil` ;
  · `cle-appareil.ts` ne lit **jamais** la coupure : zéro occurrence de
    `jetonsValidesDepuis` ni de `coupureDesJetons` dans tout le fichier.

Conséquence : une clé enregistrée depuis une session volée ouvre encore l'app
**après** que le patron a tout coupé et changé son mot de passe. Refaire la porte
sans réparer la serrure n'aurait aucun sens. Corrige cela d'abord, avec une suite
qui sait rougir contre la version d'aujourd'hui.

SE CONNECTER AVEC GOOGLE OU AVEC APPLE — sa demande du 7 septembre

  « avec la possibilité de se connecter avec son compte Google ou Apple, comme
    ce que proposent toutes les applis aujourd'hui »

**Le terrain est prêt, et c'est vérifiable :** l'application tourne sur
next-auth 5 (`src/auth.ts`), qui n'a aujourd'hui que des fournisseurs
`Credentials` — le mot de passe, et Face ID. Ajouter Google et Apple, c'est
ajouter des fournisseurs à cette même liste, pas refaire la couche de session.

**MAIS TROIS CHOSES NE SE CODENT PAS, et se demandent à LUI :**

  Google    des identifiants OAuth à créer dans une console Google, et une
            adresse de retour déclarée. Gratuit
  Apple     « Sign in with Apple » exige un compte développeur Apple PAYANT
            (99 $/an) et une clé signée. Ce n'est pas un détail de
            configuration : sans ce compte, le bouton ne peut pas exister
  l'adresse le retour OAuth doit être déclaré pour CHAQUE origine où il se
            connecte — et il passe par un proxy dont l'origine diffère de
            l'hôte. C'est exactement ce qui a déjà cassé ses actions serveur

Dis-lui ce qu'il doit faire, avec les étapes, plutôt que de livrer un bouton qui
ne peut pas aboutir. Et **s'il ne veut pas payer le compte Apple, dis-le-lui
franchement** : une porte qui montre « Continuer avec Apple » et rend une erreur
est pire que pas de bouton du tout.

**LE PIÈGE QUI COMPTE, ET IL EST DE SÉCURITÉ :** que se passe-t-il quand
quelqu'un arrive avec un compte Google portant la MÊME adresse qu'un compte
Atlas existant ? Rattacher automatiquement, c'est offrir un compte à qui sait
créer une adresse chez un fournisseur ; refuser sans rien dire, c'est enfermer
dehors un patron légitime. Le rattachement ne se fait que sur une adresse
**vérifiée par le fournisseur**, et la règle choisie s'écrit noir sur blanc.

Et n'oublie pas ce que ce dépôt sait déjà : `atlas_app` ne peut plus lire le
condensat du mot de passe (migration 0064), et un utilisateur n'appartient à une
entreprise qu'APRÈS s'être identifié — il n'y a donc pas de RLS par entreprise
sur `users`, et un nouveau chemin d'entrée ne doit pas en réclamer une.

CE QUE « COMME LES PLUS GRANDES APPLIS » VEUT DIRE ICI — ET CE QUE ÇA NE VEUT PAS

Ce qu'il admire dans ces applis, ce n'est pas un style : c'est qu'on entre **sans
réfléchir**. Un logo, un geste, on est dedans.

  ce qu'on prend      la porte s'ouvre d'UN geste ; le mot de passe est le
                      recours, pas le chemin ; rien à lire avant d'entrer ;
                      l'écran est calme, large, et respire
  ce qu'on ne prend   PAS le style générique d'une application américaine.
  PAS                 Atlas a son monde — crème, encre, vert pin, or #B98B47 sur
                      les huit chartes, serif de titre. Une porte qui pourrait
                      être celle de n'importe quelle application n'est pas
                      « design », elle est interchangeable

**C'est l'écran le plus libre du produit** : aucune donnée, aucune liste, aucun
tableau. C'est donc là que la marque a le plus de place — et le seul endroit où
une vraie ambition visuelle ne coûte rien à la lisibilité. Ose.

ET LA CONTRAINTE QUI PRIME SUR L'AMBITION — sa consigne du 5 septembre 2026

« La plupart des patrons qui vont utiliser l'app sont des vieux qui ont du mal à
se servir de leur téléphone ; il faut que ce soit hyper intuitif et simple. »
(PRODUCT.md, « Accessibility & Inclusion ».)

Sur une porte, cela veut dire :

  · aucun geste à deviner — rien de caché, pas de glissement, pas d'appui long ;
  · des cibles grandes : on tape mal, avec les doigts froids, au soleil ;
  · si Face ID échoue, le mot de passe est LÀ, visible, sans avoir à revenir ;
  · un refus dit ce qui ne va pas ET quoi faire — jamais « une erreur est
    survenue » ;
  · rien qui presse, rien qui expire sous les doigts.

Le test qui tranche : un homme de soixante-cinq ans qui n'a jamais rien installé
sur son téléphone entre-t-il sans qu'on le lui explique ?

DÉJÀ TRANCHÉ — ne pas rouvrir

- Face ID en LIGNE au-dessus de la porte, pas en écran séparé (24 août, sa B).
- L'écran tient en une page, sans défilement, à 390 × 664.
- Aucune phrase grise sous les champs. « Au moins 12 caractères » ne se dit que
  **quand elle mord**, jamais d'avance.
- L'or vaut `#B98B47` sur les huit chartes, y compris ici.
- Aucune flèche décorative (scripts/test-aucune-fleche.ts).

CE QUI EST DÉJÀ CONNU COMME BANCAL

- **« Invalid Server Actions request. »** — le défaut qui lui a coûté vingt
  essais : il passe par un proxy où l'origine diffère de l'hôte, et Next refuse
  alors toute action serveur, à commencer par la connexion. Le contrôle existe
  (`verifier-connexion-avec-serveur.mts`) et il est la DERNIÈRE étape de la
  batterie : ne le contourne jamais, c'est le seul qui voit ce qu'il voit, lui.
- L'écran de connexion a déjà affiché « un service d'Atlas ne répond pas » pour
  un simple mot de passe de base mal configuré : un message qui accuse le produit
  à la place de la machine coûte une soirée.

LES INVARIANTS — zone sensible

- L'authentification est une **zone à prudence extrême** : on n'y simplifie
  jamais un refus en le supprimant.
- `atlas_app` ne peut ni lire ni écrire le condensat du mot de passe (migration
  0064) : la base vérifie, elle ne rend rien. Ne défais pas cela pour simplifier.
- La base ne porte **aucune donnée biométrique** — le visage ne quitte pas le
  téléphone. C'est un fait, et une suite l'interroge : garde-le vrai.
- Français partout ; les règles pures dans src/lib/.

LA MÉTHODE

1. Lis PRODUCT.md, CLAUDE.md, `appli/face-id.html`, puis git log -20.
2. Dis-moi ce que tu as trouvé AVANT d'écrire une ligne, et dans quel ordre tu
   prends les deux moitiés : la serrure d'abord, la porte ensuite.
3. **L'apparence se DESSINE d'abord** : une planche dans appli/, un lien dans
   appli/essais.html, l'adresse ENTIÈRE une fois qu'elle répond 200 — jamais une
   capture de la maquette. Propose-lui **trois portes**, pas une : c'est un
   écran de goût, et il tranche mieux devant un choix. Les trois montrent les
   quatre entrées ensemble — Face ID, Google, Apple, mot de passe — car c'est
   leur cohabitation qui fait la difficulté : quatre chemins sur un écran qui
   doit rester calme.
4. Regarde l'écran en capture, à 390 × 664, sur les huit chartes — et dans les
   états qui comptent : Face ID absent, Face ID refusé, mot de passe faux,
   compte inconnu, service en panne.
5. La dernière étape de la batterie (connexion derrière un proxy) est
   OBLIGATOIRE sur ce lot.

LA BATTERIE, SUR SON POSTE WINDOWS

- **Préviens-le AVANT de la lancer** ; son accord vaut ensuite pour toute la
  séquence, sans le relancer à chaque étape.
- Sa base vit dans Docker : `docker start atlas-postgres atlas-redis`.

  ```bash
  export ATLAS_BASE_SUPER="postgresql://postgres:postgres_dev_pw@localhost:5432/atlas_test"
  npm run verifier:avant-livraison
  ```

LE RENDU

Un document dans docs/, commité avec le code, plus sa page :
node scripts/md-en-page.mjs docs/<nom>.md
Il porte : un verdict par point, le fichier qui le fonde, ce qui a été fait
autrement et pourquoi, ce qui a été refusé et ce que ça aurait coûté, les
chiffres exacts de la batterie, et ce qui reste ouvert.
```

---

## Pourquoi ce lot vaut plus que son écran

| | |
|---|---|
| **la serrure** | une clé Face ID qui survit à un vol de session, c'est l'accès à ses chantiers, ses clients et ses prix. C'est le seul défaut de sécurité connu et non corrigé du produit |
| **la porte** | c'est le premier écran, celui qui dit si l'application est sérieuse — et le seul sans données, donc le seul où le dessin est entièrement libre |
