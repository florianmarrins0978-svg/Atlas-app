# Atlas — Fusion du Lot 3 sur `main`

*26 août 2026 · branche d'essai `fusion-essai` · **RIEN N'EST POUSSÉ SUR `main`***

---

## A — État avant fusion

| | |
|---|---|
| Branche de travail | `claude/atlas-securite-lot3` — HEAD `38e2c2c` |
| `main` distant | `8e77628` |
| `main` local | `8642d8b` — **périmé**, et c'est pourquoi on ne s'y fie pas |
| Arbre de travail | **propre**, aucune modification non commitée |
| Point de divergence | `8642d8b` |
| Commits à nous, absents de `main` | **39** |
| Commits arrivés sur `main` depuis | **185** |

**Le `main` du rapport précédent n'était déjà plus le `main` actuel** : il a
bougé une fois de plus pendant la rédaction. C'est la raison du `fetch` avant
toute conclusion.

### Ce qui est arrivé sur `main`, et qui touche notre périmètre

Deux lots, et les deux comptent :

| Lot arrivé | Ce qu'il apporte |
|---|---|
| **Rôles et accès** | trois rôles — Patron, Commercial, Salarié. `src/lib/acces-roles.ts`, une garde centrale `GardeAcces` dans la mise en page racine, et une garde de route `exigerOuverture` sur les API |
| **Transcription → devis** | outils de lecture de devis et de transcription pour l'assistant |

Plus : conditions sur le devis, format de numéro, propositions sans chantier.

---

## B — Conflits

**Onze fichiers en conflit** : un de production, cinq de tests, cinq de mémoire.

### 1. `src/lib/rubriques-reglages.ts` — production

| | |
|---|---|
| **`main`** | ajoute `reservéAuPatron(role)`, pour les pages qui ne sont pas des rubriques du sommaire |
| **Lot 3** | corrige le commentaire de `adressesAutorisees`, qui promettait une garde centrale inexistante — c'est ce mensonge qui expliquait le trou F8 |
| **Décision** | **les deux conservés** |
| **Vérifié** | `adressesAutorisees` n'a toujours aucun appelant hors des contrôles : mon commentaire corrigé reste vrai après fusion |

**Et le commentaire a été mis à jour**, parce que la réalité fusionnée l'a
dépassé : la frontière existe désormais, elle s'appelle `cheminAutorise`, et
elle sait lire les sous-chemins — ce que cette liste-ci ne saura jamais faire.
Laisser la prose en l'état aurait recréé le mensonge que le lot 3 venait de
corriger.

### 2. `scripts/test-auth-autorisation.ts` — **le piège sémantique du lot**

| | |
|---|---|
| **`main`** | `.returning()` nu, et le rôle `"salarie"` |
| **Lot 3** | `.returning({ id: users.id })`, et le rôle `"membre"` |
| **Décision** | **une moitié de chacun** |

**Chaque côté avait raison sur sa moitié, et tort sur l'autre.** Le rôle
`membre` n'existe plus — la migration 0065 de `main` l'a renommé et pose une
contrainte qui le refuse. Mais `.returning()` nu est précisément ce que M9
interdit : depuis la migration 0064, `atlas_app` n'a plus le SELECT sur toutes
les colonnes de `users`, et un `RETURNING *` demande à lire le condensat du mot
de passe.

**Prendre l'une ou l'autre version entière aurait cassé quelque chose.**

### 3. Le calendrier — **deux sessions, le même défaut, le même jour**

| | `main` | Lot 3 |
|---|---|---|
| nom | `joursRetenables` | `joursAProposer` |
| portée | **une seule suite** | **deux suites**, pièce commune |
| plancher | `+3` écrit en dur | **`DELAI_MINIMAL_JOURS`** |
| mois consultés | un de plus | jusqu'à trois |

**Décision : la pièce commune est retenue**, et le nom de `main` survit **en
délégation** — ses trois points d'appel continuent de fonctionner. Ce qui
disparaît est la seconde implémentation, jamais un point d'appel.

Les garder toutes les deux aurait été la duplication elle-même, celle que
`CLAUDE.md` §3 interdit.

### 4. `scripts/test-face-id-e2e.ts` — additif des deux côtés

`main` ajoute un contrôle de mise en page mesurée ; le lot 3 ajoute le contrôle
qui porte M11 (« une session seule ne suffit plus, et aucune clé n'est créée »).
**Les deux conservés**, dans l'ordre, sans doublon d'ouverture de cas.

### 5. `scripts/test-ia-02-e2e.ts` — la version de `main` retenue

Elle **contient déjà** la propriété du lot 3 : attendre que le décor soit
vraiment écrit, et s'accuser elle-même plutôt que d'accuser l'assistant. Garder
la mienne aurait dupliqué la même attente.

### 6. Les cinq documents de mémoire

Additifs des deux côtés : **tout conservé**, la place de `main` d'abord.

**`ARCHITECTURE.md` : mes §170 et §171 renumérotés en §191 et §192.** `main` est
monté à §190, et la règle dit de renuméroter **celui qui n'est pas encore sur
`main`** — c'était le nôtre. Mes renvois croisés ont suivi ; ceux de `main`
vers **ses** §170/§171 n'ont pas été touchés.

---

## C — Migrations

### L'ordre final

```
0063_allure_documents.sql          0063_cles_appareil.sql
0064_conditions_sur_le_devis.sql  0064_secret_authentification.sql   ← M9
0065_preuve_recente.sql     ← M11 0065_roles_et_acces.sql
0066_format_numero.sql            0066_preuve_par_le_moteur.sql      ← M11
0067_isolation_contexte_vide.sql  ← F5   0067_propositions_sans_chantier.sql
```

### Cinq numéros partagés — et pourquoi ce n'est PAS un problème

**`run-migrations.ts` identifie une migration par son NOM DE FICHIER**, pas par
son numéro : `dejaAppliquees.has(fichier)`, et `INSERT INTO _migrations (nom)`.

| | |
|---|---|
| deux migrations partagent un NUMÉRO | oui — 0063 à 0067 |
| deux migrations partagent un NOM DE FICHIER | **non**, aucune |

Chacune s'applique **une fois**, dans l'ordre alphabétique. Le précédent existe
déjà sur `main` : `0063_allure_documents` et `0063_cles_appareil` coexistent
depuis longtemps.

### Aucune renumérotation, et c'est un refus argumenté

**Renommer un fichier de migration le ferait rejouer sur toutes les bases** —
`_migrations` porte l'ancien nom, le nouveau n'y est pas. C'est exactement le
constat F6 que ce lot a refusé de « corriger ». La règle vaut ici aussi.

**Vérifié** : aucune migration existante n'a été modifiée par la fusion — que
des ajouts.

### Aucune migration entrante n'affaiblit M9 ni M11

Les quatre migrations arrivées de `main` ont été relues une par une : **aucune
ne porte de `GRANT` ni de `REVOKE` sur `users`, sur les preuves ou sur les
secrets d'authentification.**

---

## D — Sécurité, propriété par propriété

| Lot | Propriété attendue | Moyen de contrôle | Résultat |
|---|---|---|---|
| **M9** | `atlas_app` ne lit jamais le condensat | droits mesurés en base + la porte SQL est la seule voie | ✅ — et **deux suites de `main` s'y sont cassé les dents**, ce qui le prouve mieux qu'un test |
| **M11** | preuve liée à une session, dix minutes, non forgeable | les trois gestes gardent `exigerPreuveRecente` | ✅ |
| **M12** | la mise à jour reste au patron | `exigerProprietaire` | ✅ |
| **F1** | l'issue de mise à jour reste au patron | 13 gardes dans `reglages/actions.ts` | ✅ |
| **F2** | un site tiers n'efface aucun cookie | `sec-fetch-site` en place | ✅ |
| **F5** | aucune politique fragile au contexte vide | mesuré en base | ✅ |
| **F8** | `/reglages/agenda` réservé au patron | garde en place | ✅ **et plus nécessaire que prévu** — voir ci-dessous |
| **F12 / F13** | maquettes hors production, `robots.txt` servi | fichiers et `matcher` en place | ✅ |
| **Audio** | les quatre chemins par la porte commune | mesuré | ✅ |

### La découverte de la fusion : F8 était plus large qu'on ne le croyait

`/reglages/agenda` **n'est pas** dans `FERME_AU_COMMERCIAL`. Sur `main`
aujourd'hui, un **commercial** peut donc ouvrir cet écran et y lire le compte
d'agenda relié du patron — son identifiant iCloud ou Google, et son état de
connexion.

La garde du lot 3 le ferme, et **elle suit exactement le modèle que `main`
documente lui-même** pour `/reglages/tarifs` et `/reglages/prix` : *« ces deux
pages portent leur propre garde `estProprietaire` […] et elles la gardent »*.

---

## E — Batterie

### Premier tour après intégration

| Étape | Résultat |
|---|---|
| `npx tsc --noEmit` | ✅ |
| `npm run lint` | ✅ |
| Construction | ✅ |
| `npm run verifier:memoire` | ✅ |
| Suites base — RLS comprises | ❌ **255 / 258** |
| Suites navigateur | ✅ **115 / 115** |
| `npm run verifier:connexion` | ✅ |

**115 et non 110** : `main` a légitimement ajouté cinq suites navigateur. Le
total n'a pas été reproduit artificiellement.

### Second tour — **en cours au moment où ce document est écrit**

Les trois rouges du premier tour sont corrigés (voir §G) et la batterie rejoue
en entier. **Les chiffres définitifs seront ajoutés ici** ; ce document sera
renvoyé complété.

---

## F — Revue hostile

| Ce qui a été tenté | Résultat |
|---|---|
| une migration entrante rend-elle des droits sur `users` ? | **non** — les quatre relues une par une |
| une migration existante a-t-elle été modifiée ? | **non** — que des ajouts |
| deux migrations partagent-elles un nom de fichier ? | **non** |
| le rôle disparu `membre` survit-il dans du code exécuté ? | **non** — seulement dans des commentaires et un script de capture hors batterie |
| un chemin audio contourne-t-il la porte ? | **non** — les quatre l'emploient |
| `main` a-t-il posé une garde centrale qui rendrait F8 inutile ? | **non** — `/reglages/agenda` reste ouvert au commercial |
| `estProprietaire` a-t-il changé de sens ? | **non** — `main` a réécrit `autorisation.ts` en gardant la fonction à l'identique |

---

## G — Régressions, classées avec preuve

### 1. `test-acces-roles-db.ts` — **défaut du contrôle**, et M9 avait raison

Il lisait `users.password_hash` en direct pour comparer lui-même. **C'est la
protection qui parle, pas une panne.** Le contrôle passe désormais par la porte
`SECURITY DEFINER` : même règle éprouvée, et il éprouve en plus le vrai chemin
de connexion au lieu d'une comparaison refaite à côté.

### 2. `test-assistant-explique-l-appli.ts` — **défaut du contrôle**, même famille

`returning()` nu sur `users` : `RETURNING *` demande à lire le condensat. Seul
l'identifiant sert.

### 3. `test-mode-emploi.ts` — **VRAIE RÉGRESSION**, causée par M11

Et c'est la plus importante des trois : **un contrôle de `main` a attrapé une
régression de notre lot**, que la batterie de notre branche seule ne pouvait pas
voir.

Le bouton « Télécharger mes données » a quitté `donnees/page.tsx` pour un
composant client — c'est M11, qui devait demander qui parle avant d'ouvrir un
export contenant tout ce que l'entreprise sait de ses clients. La fiche du mode
d'emploi pointait encore l'ancien fichier : **l'assistant aurait enseigné un
geste dont la preuve n'existe plus là où elle est annoncée.**

La fiche suit le bouton.

**Aucune assertion affaiblie, aucun délai allongé, aucune suite désactivée,
aucun `--force`.**

---

## H — Diff final

Aucune modification opportuniste. Les seuls changements hors résolution de
conflit sont les trois corrections du §G, chacune imposée par un rouge, et la
mise à jour du commentaire de `rubriques-reglages.ts` pour qu'il cesse de
contredire la réalité fusionnée.

**Rien n'a été traité de :** F7 / RGPD, F10 / CSP, rôles Salarié et Commercial,
`/catalogue`, qualité Dictée → Devis, sauvegardes, refonte, nettoyage.

**`ATLAS_PROXY_SAUTS` n'a pas été configuré** : la valeur dépend de
l'hébergement réel, et le comportement de repli actuel est conservé.

---

## I — Défauts encore ouverts

### Sécurité

| | |
|---|---|
| **CSP `unsafe-inline`** | réelle — le retirer sans `nonce` casse l'application (F10) |
| **`/catalogue` sans garde de rôle** | faible — aucun prix, seulement le vocabulaire de dictée |
| **`cle-appareil` : seuil global** sans `ATLAS_PROXY_SAUTS` | faible, délibéré, documenté |

### Produit

F7 / RGPD · `/catalogue` · qualité Dictée → Devis.

### Hébergement

`ATLAS_PROXY_SAUTS`, **et il faut les deux moitiés** : poser la variable, ET
s'assurer que le mandataire écrase `x-forwarded-for`. Sans les deux, la poser
serait pire que ne rien faire.

### Tests

Trois suites navigateur rougissent sous la batterie et jamais seules —
consigné dans `TODO.md` avec le remède.

### Hors périmètre, trouvé pendant la fusion — **non corrigé**

| | |
|---|---|
| `scripts/capture-reglages.mts` emploie encore le rôle `membre` | **script de capture, hors batterie.** Il échouerait s'il était joué : la contrainte de la migration 0065 refuse ce mot. Gravité nulle pour l'application |
| `ARCHITECTURE.md` porte en double §134, §135, §136, §164, §165 | dette de `main`, alourdie depuis le dernier relevé |

### Sauvegardes

**Toujours aucune. C'est le point le plus grave du dépôt**, et il ne se règle
pas en codant.

---

## J — Verdict

**En attente du second tour de batterie.** Le verdict sera posé sur des chiffres,
pas sur une impression.
