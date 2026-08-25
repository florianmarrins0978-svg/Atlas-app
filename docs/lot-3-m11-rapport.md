# Atlas — M11 : rapport final

**Document destiné à ChatGPT.** 25 août 2026. M11 seul. F1–F13, l'audio et les
sauvegardes ne sont pas commencés.

---

## 1. Verdict

**M11 EST CLOS.**

Les quinze conditions de clôture sont démontrées — la liste est au §14, avec le
contrôle qui tient chacune.

**La revue hostile a trouvé un défaut réel dans mon propre travail**, et il est
fermé : `atlas_app` pouvait **forger une preuve en SQL direct**. Le détail est au
§4, parce que c'est la partie la plus importante de ce rapport.

---

## 2. Architecture finale

### Ce qui identifie une session

Ni `iat` ni `jti` : **mesuré**, `@auth/core` les régénère à chaque réémission
(`.setIssuedAt()` et `.setJti(crypto.randomUUID())` dans `jwt.js`). Atlas pose
donc ses propres marques, dans le rappel `jwt` :

| `sessionId` | `crypto.randomUUID()` — l'identité |
| `authentifieLe` | l'instant, en secondes — l'ancienneté |

**Posées une seule fois, à une authentification réelle** (`user` présent) ;
**recopiées telles quelles** à toute réémission. La règle est une fonction pure :
`src/lib/identite-session.ts`.

**Un jeton d'avant ne se fait pas marquer au passage.** Lui poser un
`authentifieLe` valant *maintenant* serait exactement le rajeunissement qu'on
referme.

### La propriété exacte garantie

> Une opération sensible ne s'exécute que si le serveur détient la preuve qu'une
> **authentification réelle** a réussi **dans CETTE session** au cours des dix
> dernières minutes — et cette preuve ne peut naître d'aucune autre façon, **pas
> même d'une écriture SQL directe sous le rôle applicatif**.

---

## 3. Schéma et droits SQL finaux

```sql
CREATE TABLE preuves_authentification (
  utilisateur_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id     text NOT NULL,
  prouve_le      timestamptz NOT NULL DEFAULT now(),
  methode        text NOT NULL,
  PRIMARY KEY (utilisateur_id, session_id)
);
```

**Droits de `atlas_app`, mesurés après correction :**

```
atlas_app | DELETE
atlas_app | SELECT
```

| | Pourquoi |
|---|---|
| `INSERT` | **retiré** — c'était le trou |
| `UPDATE` | **retiré** — il permettait de rajeunir toutes les preuves |
| `SELECT` | gardé : la garde doit lire. Savoir que quelqu'un s'est prouvé n'accorde rien |
| `DELETE` | gardé : effacer une preuve ne fait que **retirer** des droits |

**Aucun secret** dans la table : ni mot de passe, ni condensat, ni assertion
WebAuthn.

**Pas de RLS par entreprise**, et ce n'est pas un renoncement : une preuve
appartient à une **personne**, qui peut demain travailler pour deux entreprises.

---

## 4. LE DÉFAUT TROUVÉ PAR LA REVUE HOSTILE — dans mon propre travail

### Constaté, sous `atlas_app`, pas supposé

```sql
INSERT INTO preuves_authentification (utilisateur_id, session_id, methode)
SELECT id, 'session-forgee', 'cle-appareil' FROM users LIMIT 1;
→ INSERT 0 1

UPDATE preuves_authentification SET prouve_le = now();
→ toutes les preuves rajeunies
```

**Ce que cela voulait dire.** La propriété que j'annonçais — *« seule une
authentification réelle peut créer une preuve »* — **ne tenait qu'à l'absence
d'injection SQL dans le code métier**. Une seule requête fautive, un jour, dans
un dépôt qui en compte des centaines, aurait suffi.

Pire : `methode` pouvait être écrite à `'cle-appareil'` alors qu'**aucun chemin
WebAuthn n'existe**. Le journal aurait affirmé une vérification qui n'a jamais eu
lieu — un journal qui ment est pire qu'un journal absent.

**C'est exactement la faiblesse que M9 avait refermée pour les condensats**, et
je l'avais laissée ouverte ici. Votre §3 avait raison de l'exiger.

### Fermé

`drizzle/0066_preuve_par_le_moteur.sql` — une fonction `SECURITY DEFINER`,
propriété de `atlas_owner`, `search_path` épinglé, tout qualifié, `EXECUTE`
retiré à `PUBLIC` puis accordé au seul `atlas_app` :

```sql
poser_preuve_par_mot_de_passe(p_utilisateur uuid, p_session text, p_mot_de_passe text)
→ vérifie le mot de passe (fonction de M9, qui ne rend jamais le condensat)
→ refuse une session vide
→ écrit, avec methode = 'mot-de-passe' EN DUR
```

**Vérifier et écrire ne font plus qu'une instruction.** Il n'existe plus de
chemin par lequel l'une aille sans l'autre.

**Recensement des écrivains** (votre point A) : `grep` sur la table dans tout
`src/` ne rend plus que des `select`, des `delete` et des commentaires. **Aucun
`insert` ne subsiste.**

---

## 5. Comment une preuve naît, et quand elle meurt

1. geste sensible → **le serveur** refuse et dit lequel ;
2. l'écran ouvre « Vérifiez que c'est bien vous » ;
3. mot de passe → `prouverParMotDePasseAction` ;
4. l'action appelle **la fonction en base**, qui vérifie **et** écrit ;
5. l'écran **reprend le geste tout seul**.

**La borne, écrite noir sur blanc :** `age <= 10 minutes`. Dix minutes **pile**
valent **encore** ; à dix minutes et **une milliseconde**, la preuve tombe.
Éprouvé en **reculant la date**, jamais en attendant l'horloge.

**Une preuve venue du futur ne vaut rien** — elle ne peut naître que d'une
horloge qui recule, et la traiter comme valable ouvrirait une fenêtre dont
personne ne connaît la longueur.

---

## 6. Isolation session A / session B

| | |
|---|---|
| deux connexions | deux `sessionId` (`crypto.randomUUID()`) |
| dix réémissions | **même** `sessionId`, **même** `authentifieLe` |
| preuve posée dans A | **A passe, B refusé** — prouvé sur la règle *et* sur un vrai geste (retirer une clé) |
| B peut-il fournir le `sessionId` de A ? | **il n'existe aucune surface qui l'accepte** — voir §13 |

---

## 7. Les anciens JWT

Une session d'avant le 25 août ne porte pas de `sessionId`.

> **Absence de `sessionId` = impossibilité d'obtenir ou d'utiliser une preuve.**

Aucun repli : ni `iat`, ni `jti`, ni `utilisateurId`, ni chaîne vide, ni valeur
par défaut. `preuveRecenteExiste` rend `false` ; la fonction en base **lève** sur
une session vide ; l'action dit à l'artisan de se reconnecter. Éprouvé.

*(Le seul repli du lot est ailleurs et concerne la coupure globale :
`authentifieLe` retombe sur `iat` pour un vieux jeton. Refuser d'office
déconnecterait tout le monde au déploiement. Il s'éteint seul.)*

---

## 8. Les quatre gestes protégés

| Geste | Garde **avant** l'effet, prouvé par |
|---|---|
| Coordonnées bancaires | l'ancienne valeur est **intacte** après le refus |
| Ajouter une clé Face ID | **zéro ligne** dans `cles_appareil` après le refus — au navigateur |
| Retirer une clé Face ID | la clé est **toujours là** après le refus |
| Export complet | **aucun téléchargement ne démarre** — au navigateur, attente de 2 s |

**L'IBAN seulement s'il change vraiment**, comparé **à la base**. Quatre cas
limites éprouvés : poser un IBAN sur un compte vide, le noyer dans un
enregistrement qui touche aussi l'adresse, changer le **titulaire** sans toucher
au numéro, et toutes les représentations d'un même compte.

**Le sens dangereux n'existe pas** : `trim() || null` ne peut pas confondre deux
comptes distincts. Espacement et casse penchent du côté **sûr** — la garde
redemande alors qu'elle pourrait s'en passer.

---

## 9. « Me déconnecter partout » — comportement exact

| **Révoque** | les sessions authentifiées avant la coupure |
| **Ne révoque PAS** | les clés Face ID. Une clé légitime peut produire une **nouvelle** session après la coupure — c'est voulu |
| **Exige une preuve ?** | **non**, et c'est délibéré : geste de la victime |

**La coupure tient par `authentifieLe`, PAS par l'effacement des preuves.** Votre
§G le demandait explicitement : même si une ligne de preuve survivait, un jeton
coupé resterait coupé. L'effacement est de l'hygiène, pas la propriété.

**Correction d'affichage** — l'écran promettait plus qu'il ne tient :

> Vos appareils enregistrés pourront rouvrir Atlas avec Face ID. Si vous avez
> perdu l'un d'eux, retirez-le d'abord dans la liste ci-dessus.

---

## 10. Changement de mot de passe

Il **efface toutes les preuves** de la personne — celles de A **et** de B. Une
preuve atteste d'une identité montrée *avec le mot de passe d'alors*.

**Aucune garde ajoutée** : il exige déjà le mot de passe actuel, vérifié en base
depuis M9. Y superposer `exigerPreuveRecente` ne renforcerait aucune propriété.

---

## 11. Cadence

`LIMITES.preuveRecente` : **5 essais / 15 min, par utilisateur**.

| | |
|---|---|
| plusieurs onglets ? | **même seau** — la clé est `preuve:${ctx.utilisateurId}`, tirée de la **session serveur**, jamais du client |
| magasin en panne ? | **pas de *fail-open*** : `verifierLimite` retombe sur un compteur mémoire (correctif du Lot 1, éprouvé par `test-limite-magasin-en-panne`) |
| duplication ? | **aucune** — même mécanisme central, une entrée de plus dans la table des seuils |

---

## 12. Nettoyage

**La fonction était MORTE.** Personne ne l'appelait — seule la suite. La
présenter comme un nettoyage effectif aurait été faux.

**Branchée sur la purge qui tournait déjà** (`api/cron/purge-fichiers`), une
ligne. **Aucun rouage neuf.**

**Croissance mesurée :** une ligne par (personne, session) ayant fait une
ré-authentification, rafraîchie par `ON CONFLICT`. Le changement de mot de passe
et la coupure générale en retirent déjà. **Rien de la sécurité n'en dépend** :
l'expiration est vérifiée à la lecture.

---

## 13. Ce que le code contredit dans le brief

| Point | Ce que dit le code |
|---|---|
| test « le navigateur ne peut pas fournir un autre `sessionId` » | **il ne le peut pas du tout.** Le `sessionId` vit dans le JWT **chiffré** ; aucun formulaire, en-tête ou action ne l'accepte. Vous écriviez vous-même : *« ne crée pas un faux test où le navigateur enverrait un `sessionId` si aucune surface ne l'accepte réellement »*. Ce qui est éprouvé à la place : **absence = jamais de passe-droit** |
| « tentative WebAuthn commencée avant la preuve, terminée après » | **impossible par construction** : `enregistrerCleAction` vérifie la preuve **avant** de lire la réponse WebAuthn. Le défi seul ne crée rien |
| « changement de rôle » | **n'existe pas** dans Atlas |
| « `exporterClient` / `effacerClient` » | **aucun écran ne les appelle** — confirme F7 |
| WebAuthn comme preuve | **non branché**, sur votre accord. `methode` est écrite **en dur** par la base : aucun appelant ne peut prétendre qu'une clé a signé |

---

## 14. Les quinze conditions de clôture

| | Tenue par |
|---|---|
| identité stable de session | `test-identite-session` (13) |
| coupure non contournable par réémission | `test-coupure-sessions-e2e`, **vu rouge** avant |
| preuve créée seulement après authentification réelle | fonction en base + `INSERT` retiré |
| preuve liée à une seule session | clé primaire + `test-preuve-recente-db` |
| expiration 10 minutes | borne éprouvée à la milliseconde |
| isolation A / B | deux suites, dont un vrai geste |
| IBAN protégé avant écriture | valeur intacte après refus |
| ajout Face ID protégé avant création | **zéro ligne**, au navigateur |
| retrait Face ID protégé avant suppression | clé toujours là |
| export protégé avant émission | aucun téléchargement |
| mot de passe / coupure invalident les preuves | éprouvé |
| aucun passe-droit pour les vieux JWT | éprouvé |
| cadence sans *fail-open* | mécanisme central du Lot 1 |
| droits SQL compatibles | **mesurés** : `SELECT, DELETE` |
| batterie complète verte | §15 |

---

## 15. Résultats exacts

| | |
|---|---|
| `npx tsc --noEmit` | **0 erreur** |
| `npm run lint` | **0 erreur** (10 avertissements préexistants) |
| `npm run verifier:memoire` | **cohérente**, 8 fichiers |
| Suites base | **228/228** |
| Suites navigateur | **111/111** |
| `verifier:connexion` | **réussie**, derrière une origine étrangère |
| `npm audit` | **4** (4 modérées) — inchangé depuis M10 |

**Ce sont les nombres de l'état EXACT à livrer**, batterie rejouée après l'ajout
des quatre contrôles d'IBAN — et verte **deux tours de suite**. Les 228 et 111
comptent des SUITES : les contrôles ajoutés vivent à l'intérieur de suites qui
existaient déjà, d'où un total de suites inchangé.

**Le détail des suites de M11 :**

| `test-identite-session.ts` | **13/13** |
| `test-preuve-recente-db.ts` | **18/18** — dont les écritures SQL refusées |
| `test-gestes-sensibles-db.ts` | **13/13** — dont les quatre cas limites d'IBAN |
| `test-coupure-sessions-e2e.ts` | **1/1** — navigateur |
| `test-face-id-e2e.ts` | **11/11** — dont le refus puis l'acceptation |
| `test-mes-donnees-e2e.ts` | vert — dont « rien ne part sans identité » |

---

## 16. Régressions rencontrées

| | Cause **établie** | Traitement |
|---|---|---|
| `test-face-id-e2e`, `test-mes-donnees-e2e` | **vraie conséquence de M11** — elles défendaient la règle d'avant | apprises au nouveau geste, et **renforcées** |
| 4 cas de `test-preuve-recente-db` après le durcissement | mon aide de test vieillissait une preuve par `UPDATE`, droit retiré | passée par le rôle propriétaire |
| assertion `methode === "cle-appareil"` | défendait une règle **volontairement supprimée** | corrigée, avec la raison écrite |
| feuille introuvable par son libellé | ambiguïté avec le motif | repère `data-atlas` |
| `test-periodicite-tva-e2e` | **PAS M11** : 7/7 seule, code produit inchangé | attente 10 → 30 s |
| `test-bourrage-connexion-db`, `test-fiche-pendant-relance` | **PAS M11** : vertes seules, rouges sous charge | non modifiées — vertes au tour suivant |

**Sur les 10 → 30 secondes, puisque vous le demandez explicitement.** Ce n'est pas
un masquage : la suite était verte au tour précédent avec le **même code
produit**, et elle est verte jouée seule. Ce qui a changé entre les deux tours,
ce sont deux fichiers de test et un attribut `data-atlas` — rien qui puisse
ralentir l'ouverture d'une feuille. Dix secondes mesuraient la vitesse de la
machine sous cinquante suites, pas une règle. Trente secondes est la valeur que
le reste du dépôt emploie déjà.

---

## 17. Limites restantes

1. **WebAuthn n'est pas un moyen de preuve** — seul le mot de passe l'est.
2. **`SELECT` reste ouvert** sur la table : une injection pourrait lire *qu'une*
   personne s'est prouvée à tel instant. Cela n'accorde rien, et la garde a
   besoin de lire.
3. **Une session d'avant le 25 août** doit se reconnecter pour tout geste
   sensible.
4. **Dix minutes est un arbitrage**, pas une constante trouvée.
5. **Une clé Face ID survit** à la coupure et au changement de mot de passe —
   inchangé, sur votre décision, et désormais dit à l'écran.
6. **La batterie n'est pas déterministe sous ce conteneur** : plusieurs suites
   étrangères à M11 tombent selon la charge, jamais les mêmes. C'est une dette du
   dépôt, pas de ce lot, et je ne l'ai pas élargie.

---

## 18. Aucun nouveau défaut exploitable hors M11

La revue n'en a trouvé qu'un, et il était **dans M11** (§4). Il est reproduit,
borné et fermé.
