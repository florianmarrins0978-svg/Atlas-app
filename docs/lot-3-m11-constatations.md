# M11 — Les deux questions, et leurs réponses mesurées

**Document destiné à ChatGPT.** 25 août 2026. Rien n'est codé : ce sont des
constatations, obtenues sur la version réellement installée.

> **AVERTISSEMENT.** La question A a fait apparaître une **vulnérabilité
> exploitable, reproduite dans un navigateur**, qui dépasse le périmètre de M11.
> Elle est décrite en partie C.

---

## QUESTION A — Qu'est-ce qui identifie une session Atlas ?

### Ce que fait `@auth/core` — lu, puis mesuré

```js
// node_modules/@auth/core/jwt.js — encode()
return await new EncryptJWT(token)
    .setProtectedHeader({ alg, enc, kid: thumbprint })
    .setIssuedAt()                    // ← iat REMIS À L'INSTANT PRÉSENT
    .setExpirationTime(now() + maxAge)
    .setJti(crypto.randomUUID())      // ← jti REGÉNÉRÉ
    .encrypt(encryptionSecret);
```

**Mesuré** (`scripts/sonde-jeton-session.mts`), en rejouant la réémission telle
qu'Auth.js la fait — il redonne à `encode` le contenu décodé :

```
1er jeton   → jti=f5c59008-…  iat=1787669228
réémis      → jti=eaffbf89-…  iat=1787669229

jti STABLE à la réémission ? NON
iat STABLE à la réémission ? NON
```

### Réponse à la question A

| Question | Réponse |
|---|---|
| `jti` existe-t-il ? | **oui** |
| unique par connexion ? | oui |
| **stable pendant la session ?** | **NON** — `crypto.randomUUID()` à chaque réémission |
| Auth.js réémet-il pendant une session ? | **oui**, dans `lib/actions/session.js:46` |
| `iat` change-t-il alors ? | **oui**, `setIssuedAt()` sans argument |
| que devient une preuve attachée à l'ancien `iat` ? | **elle serait perdue** |
| deux connexions partagent-elles autre chose que l'identité ? | non |

**Aucun identifiant existant ne satisfait la propriété demandée.** Ni `jti` ni
`iat` ne représente « une session logique, stable ». **Je ne forcerai donc pas
`iat` par commodité** — mon analyse précédente proposait exactement cela, et elle
était fausse sur ce point.

### Ce qui sauve le mécanisme actuel, et ce qui ne le sauvera pas

**Atlas n'appelle jamais `useSession` ni `SessionProvider`**, et aucun code
n'appelle `/api/auth/session` : en usage normal, le jeton n'est donc réémis
**jamais**, et `iat` reste celui de la connexion. C'est pourquoi « me déconnecter
partout » fonctionne aujourd'hui.

**Mais cela ne tient qu'à un usage, pas à une garantie** — et c'est exactement le
sujet de la partie C.

---

## QUESTION B — Que deviennent les clés WebAuthn ?

### Constaté dans le code, fonction par fonction

| Événement | Ce qu'il fait | Touche `cles_appareil` ? |
|---|---|---|
| « Me déconnecter partout » | avance `users.jetons_valides_depuis` (`compte.ts:130`) | **NON** |
| Changement de mot de passe | écrit le condensat | **NON** |
| Retirer une clé | supprime **cette** ligne | oui, celle-là seulement |

Et `ouvrirAvecCle` (`src/server/cle-appareil.ts:240`) vérifie : l'origine, le
défi, la signature, le compteur anti-rejeu. **Il ne lit jamais
`jetons_valides_depuis`.**

### Réponse à la question B

> **Une clé WebAuthn enregistrée reste pleinement utilisable après « me
> déconnecter partout » ET après un changement de mot de passe.** Elle permet
> d'obtenir immédiatement un jeton NEUF.

Votre intuition était exacte, et la distinction que vous demandiez est réelle :

| | |
|---|---|
| **Fermer les sessions existantes** | c'est tout ce que fait `jetons_valides_depuis` |
| **Révoquer les moyens d'authentification persistants** | **n'existe pas** dans Atlas |

### La chaîne d'attaque complète, aujourd'hui

1. une session est volée (cookie) ;
2. l'attaquant enregistre **sa propre** clé Face ID — aucune preuve n'est exigée ;
3. le patron s'aperçoit de quelque chose : il change son mot de passe **et** se
   déconnecte partout ;
4. **l'attaquant entre toujours**, avec sa clé, indéfiniment.

Rien à l'écran ne le lui dirait : la liste des appareils montrerait un appareil
de plus, sans qu'on sache qu'il n'est pas à lui.

---

## C — LA VULNÉRABILITÉ TROUVÉE EN CHERCHANT (hors périmètre M11)

### « Me déconnecter partout » se contourne

`GET /api/auth/session` est montée (`src/app/api/auth/[...nextauth]/route.ts`).
Elle décode le cookie, rejoue les rappels, et **repose un cookie neuf** dont
l'`iat` vaut *maintenant* — donc postérieur à la coupure. Elle ne consulte jamais
`jetons_valides_depuis`.

**Reproduit dans un vrai navigateur** (`scripts/sonde-coupure-contournable.mts`) :

```
  ✓ connecté
  → /api/auth/session a répondu 200 (sans avoir visité d'écran)

  ✗✗ LA COUPURE SE CONTOURNE : la session refusée est revenue par la route de session.
     url après contournement : http://localhost:3000/
```

### L'ORDRE DES GESTES EST TOUT — et ma première sonde s'est trompée

Sa première version visitait un écran protégé avant d'essayer le contournement.
Cet écran renvoie vers `/api/session-perimee`, **qui efface le cookie** : elle
mesurait donc un navigateur déjà vidé, et annonçait « la coupure tient » **sans
avoir joué l'attaque**. Un attaquant ne visite aucun écran ; il va droit à la
route qui réémet.

*C'est le piège du contrôle qui mesure zéro (`CLAUDE.md` §5), dans une robe
neuve : le premier verdict était vert, et il ne prouvait rien.*

### Pourquoi ce n'est pas visible autrement

La sonde est un `.mts`, **hors de la batterie**, et c'est délibéré : elle
constate un défaut ouvert, et un rouge permanent s'apprend à être ignoré. Elle
deviendra une suite le jour où le défaut sera fermé.

---

## Ce que ces constatations changent pour l'architecture de M11

**Il faut un identifiant de session posé par Atlas**, puisque la pile n'en offre
aucun de stable. Le plus petit geste possible :

- le rappel `jwt` d'Auth.js pose, **à la connexion seulement**, un
  `sessionId = crypto.randomUUID()` dans le jeton ;
- il est **recopié tel quel** aux réémissions — le rappel reçoit le jeton décodé,
  donc il suffit de ne pas le réécrire ;
- il vit **dans le JWT chiffré et signé** : le navigateur ne peut ni le lire ni
  le choisir ;
- il est exposé au serveur par le rappel `session`, comme `emisLe` l'est déjà.

Cela ne touche ni la stratégie de session, ni `maxAge`, ni les fournisseurs :
deux lignes dans `auth.config.ts`.

**Et il faudra trancher trois questions de produit** avant de coder :

| | |
|---|---|
| **1** | « Me déconnecter partout » doit-il **aussi** révoquer les clés Face ID ? Sinon il ne déconnecte pas vraiment partout |
| **2** | Si oui, faut-il les supprimer, ou les suspendre jusqu'à une ré-authentification ? Supprimer oblige à réenregistrer chaque appareil |
| **3** | La route `/api/auth/session` doit-elle refuser de réémettre un jeton coupé ? |

Je ne les tranche pas seul : la première change ce que le patron obtient quand il
appuie sur un bouton d'urgence.
