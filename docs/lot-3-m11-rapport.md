# Atlas — M11 : la ré-authentification récente

**Document destiné à ChatGPT.** 25 août 2026. M11 seul — F1–F13, l'audio et les
sauvegardes ne sont pas commencés, comme demandé.

---

## 1. La propriété obtenue

> Une opération sensible ne s'exécute que si le serveur détient la preuve qu'une
> authentification réelle a réussi **dans CETTE session Atlas** au cours des dix
> dernières minutes.

| Exigence | Comment elle est tenue |
|---|---|
| créée après une vraie vérification | seule `prouverParMotDePasseAction` en pose une, après `verifier_mot_de_passe_de` **en base** (M9) |
| liée à l'utilisateur **et** à la session | clé primaire `(utilisateur_id, session_id)` |
| datée côté serveur | `prouve_le timestamptz NOT NULL DEFAULT now()` |
| jamais fournie par le navigateur | le `sessionId` vit dans le **JWT chiffré** — aucune surface ne l'accepte |
| vérifiée juste avant l'effet | garde appelée **avant** toute écriture, et les tests le prouvent |
| expire | dix minutes |
| ne profite pas à une autre session | prouvé, deux fois : sur la règle et sur un vrai geste |
| inutilisable quand la session ne l'est plus | la coupure efface les preuves |
| invalidée si les moyens changent | le changement de mot de passe les efface |

---

## 2. Architecture retenue

### Ce sur quoi la preuve s'accroche

Ni `iat` ni `jti` : **mesuré**, `@auth/core` les régénère à chaque réémission
(`.setIssuedAt()`, `.setJti(crypto.randomUUID())`). Atlas pose donc ses propres
marques dans le jeton :

| `sessionId` | l'identité — la preuve s'y accroche |
| `authentifieLe` | l'ancienneté — la coupure globale la compare |

Posées **une seule fois**, à une authentification réelle ; recopiées à
l'identique aux réémissions. La règle est une fonction pure
(`src/lib/identite-session.ts`), éprouvée sans base ni navigateur.

### Le stockage

`preuves_authentification` — `drizzle/0065_preuve_recente.sql` :

```
utilisateur_id uuid  → users(id) ON DELETE CASCADE
session_id     text
prouve_le      timestamptz DEFAULT now()
methode        text          -- « mot-de-passe » ou « cle-appareil »
PRIMARY KEY (utilisateur_id, session_id)
```

**Aucun secret** : ni mot de passe, ni condensat, ni assertion WebAuthn. Volée,
une ligne n'ouvre rien.

**Une seule ligne par session** : se ré-authentifier **rafraîchit** la sienne au
lieu d'empiler des lignes que rien ne nettoierait. `purgerPreuvesPerimees()`
existe pour le ménage — et **rien ne dépend d'elle pour la sécurité** :
`preuveEstRecente` refuse déjà une ligne trop vieille.

**Pas de politique d'isolation par entreprise**, même raison que
`cles_appareil` : une preuve appartient à une personne, qui peut demain
travailler pour deux entreprises. L'isolation tient à ce que chaque requête porte
`utilisateur_id`.

### La garde unique

`exigerPreuveRecente(ctx, geste)` — `src/server/preuve-recente.ts`. Elle lève ;
les actions qui rendent un résultat à l'écran l'enveloppent pour **rendre le
refus en valeur**, jamais en exception : le message d'une exception levée par une
action serveur n'atteint jamais l'artisan.

---

## 3. Comment une preuve naît, exactement

1. l'artisan fait un geste sensible ;
2. le **serveur** refuse, et dit lequel geste — le message vient de la liste
   fermée `GESTES_SENSIBLES`, pas d'une phrase générique ;
3. l'écran ouvre la feuille « Vérifiez que c'est bien vous » ;
4. il tape son mot de passe → `prouverParMotDePasseAction` ;
5. l'action **confronte le mot de passe en base** (fonction `SECURITY DEFINER` de
   M9 : le condensat ne sort jamais de PostgreSQL) ;
6. si c'est juste, **le serveur** écrit la ligne avec le `sessionId` du jeton ;
7. l'écran **reprend le geste tout seul**.

**Le point 7 n'est pas du confort** : sans lui, il taperait son mot de passe puis
devrait réappuyer — et sur un chantier, un geste qu'on refait est un geste qu'on
abandonne.

**La cadence est bornée** (`LIMITES.preuveRecente`, 5 essais / 15 min, par
utilisateur). Sans cela, cette action serait un banc d'essai à mots de passe plus
commode que la page de connexion, pour qui détient déjà un cookie volé.

---

## 4. Les quatre gestes protégés

| Geste | Où | Nuance |
|---|---|---|
| **Coordonnées bancaires** | `reglages/identite/actions.ts` | **seulement si elles changent vraiment**, comparé à la base |
| **Enregistrer une clé Face ID** | `reglages/connexion/actions.ts` | le seul geste d'Atlas qui rend un accès **permanent** |
| **Retirer une clé Face ID** | idem | priver quelqu'un de sa porte est aussi hostile qu'un ajout |
| **Export complet** | `api/mes-donnees/route.ts` | toute l'entreprise dans un fichier |

**Pourquoi l'IBAN seulement s'il change.** L'écran de l'identité renvoie tous ses
champs à chaque enregistrement. Exiger la preuve sur simple présence du champ
réclamerait un mot de passe pour une correction de numéro de téléphone — et
**une garde qui parle à tort s'apprend à être ignorée** (`CLAUDE.md` §4 ter).

**Non protégés, délibérément :** « me déconnecter partout » (geste de la victime
— le protéger gênerait elle, pas le voleur) et le changement de mot de passe, qui
**exige déjà le mot de passe actuel**, vérifié en base depuis M9 : y ajouter une
couche ne renforcerait aucune propriété.

---

## 5. « Me déconnecter partout » — et une correction d'affichage

**Le comportement n'a pas changé** : il ferme les sessions, il ne révoque aucune
clé. C'est votre décision, et je l'ai tenue.

**Mais l'écran laissait croire l'inverse.** Quelqu'un qui vient de perdre son
téléphone appuyait en pensant l'avoir mis dehors — alors qu'un appareil
enregistré rouvre Atlas dans la seconde. L'écran le dit maintenant, là où il
décide :

> Vos appareils enregistrés pourront rouvrir Atlas avec Face ID. Si vous avez
> perdu l'un d'eux, retirez-le d'abord dans la liste ci-dessus.

Ce n'est pas une nuance : c'est la différence entre « fermé » et « ouvert ».

---

## 6. Tests ajoutés

| Suite | Cas | Nature |
|---|---|---|
| `test-identite-session.ts` | **13** | règle pure — deux connexions, dix réémissions, la coupure |
| `test-preuve-recente-db.ts` | **13** | sous `atlas_app` — isolation, expiration, effacement, purge |
| `test-gestes-sensibles-db.ts` | **9** | **les vraies actions**, et l'**ordre** des gardes |
| `test-coupure-sessions-e2e.ts` | 1 | navigateur — la vulnérabilité fermée |
| `test-face-id-e2e.ts` | +1 | navigateur — refus **et aucune clé créée**, puis acceptation |
| `test-mes-donnees-e2e.ts` | +1 | navigateur — **rien ne part** sans identité |

### Vus ROUGES sur l'ancien comportement

| | |
|---|---|
| `test-coupure-sessions-e2e` | `✗✗ LA COUPURE SE CONTOURNE : la session refusée est revenue.` |
| `test-face-id-e2e`, `test-mes-donnees-e2e` | rouges dès la garde posée — les deux écrans que M11 touche |

### L'ORDRE des gardes, prouvé et pas supposé

Une garde qui lèverait **après** l'écriture ne prouverait rien. Chaque refus est
donc suivi d'une lecture en base :

- IBAN refusé → **l'ancienne valeur est intacte** ;
- clé refusée → **la ligne est toujours là** ;
- enregistrement refusé au navigateur → **zéro ligne dans `cles_appareil`**.

---

## 7. Ce qui contredit le brief — et que je n'ai pas forcé

| Point du brief | Ce que dit le code |
|---|---|
| test 8 : « le navigateur ne peut pas fournir un autre `sessionId` » | **il ne peut pas du tout.** Le `sessionId` vit dans le JWT chiffré ; aucun formulaire, aucun en-tête, aucune action ne l'accepte. Un test qui « essaierait » devrait inventer un chemin qui n'existe pas — une mise en scène, pas une preuve. Ce qui est éprouvé à la place : `sessionId` absent → **jamais de passe-droit** |
| test 12 : « export sans preuve → aucune donnée retournée » | éprouvé au **navigateur** : la feuille s'ouvre, et une attente de deux secondes vérifie qu'**aucun téléchargement ne démarre** |
| « changement de rôle » | **n'existe pas** dans Atlas — rien n'a été créé pour lui |
| « `exporterClient` / `effacerClient` » | **aucun écran ne les appelle** — confirme F7 |
| WebAuthn comme preuve | **pas fait, et c'est délibéré.** Le brief l'autorise à condition de ne pas dupliquer le mécanisme existant. Le mot de passe suffit à établir l'architecture ; brancher WebAuthn demanderait un second chemin de défi, et le risque dépasse le gain à ce stade. `methode` est déjà prévue pour l'accueillir |

---

## 8. Régressions rencontrées

| | Cause établie | Traitement |
|---|---|---|
| `test-face-id-e2e`, `test-mes-donnees-e2e` | **vraie conséquence de M11** : elles défendaient la règle d'avant | apprises au nouveau geste, et **renforcées** — elles prouvent le refus avant l'acceptation |
| feuille introuvable par son libellé | ambiguïté : le motif reprend les mêmes mots | repère `data-atlas` stable |
| `retirerCleAction` attend l'identifiant interne, pas celui de WebAuthn | ma suite se trompait | corrigée |
| `test-periodicite-tva-e2e` | **PAS M11** : 7/7 jouée seule, code produit inchangé depuis le tour vert | attente portée de 10 à 30 s |

---

## 9. Résultats

| | |
|---|---|
| `tsc --noEmit` | 0 erreur |
| `lint` | 0 erreur |
| Suites base | **228/228** |
| Suites navigateur | *(dernier tour en cours au moment d'écrire — le tour précédent : 110/111, le seul rouge étant la période de TVA, depuis réparée)* |

---

## 10. Limites restantes

1. **WebAuthn n'est pas encore un moyen de preuve** — seul le mot de passe l'est.
2. **Une session d'avant le 25 août** ne porte pas de `sessionId` : elle ne peut
   obtenir aucune preuve, et l'écran lui dit de se reconnecter. C'est volontaire
   — l'inverse aurait été un passe-droit pour toutes les sessions d'avant.
3. **La fenêtre de dix minutes est un arbitrage**, pas une constante trouvée.
4. **Une clé Face ID survit toujours** à la coupure et au changement de mot de
   passe. **Inchangé, sur votre décision** — désormais dit à l'écran.
5. `session.maxAge` n'a pas bougé ; `next-auth` non plus.
