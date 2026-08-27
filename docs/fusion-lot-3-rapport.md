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

Quatre fusions successives ont été nécessaires : **`main` a bougé pendant tout
le travail** — 185 commits, puis 19, puis 12, puis 27. Chaque mouvement a été
réintégré, et la batterie rejouée quand le code arrivé touchait le nôtre.

### Le tour final, sur l'état exact destiné à la fusion

| Étape | Résultat |
|---|---|
| `npx tsc --noEmit` | ✅ |
| `npm run lint` | ✅ |
| Construction | ✅ |
| `npm run verifier:memoire` | ✅ |
| Suites base — RLS comprises | ✅ **258 / 258** |
| Suites navigateur | ❌ **114 / 115** |
| `npm run verifier:connexion` | ✅ connexion réelle derrière une origine étrangère |
| `npm audit` | **4 modérées, inchangées** — `drizzle-kit → esbuild`, dépendance de développement. Rien n'a été lancé |

**Les tours précédents avaient rendu 258/258 et 115/115.** Le seul écart du tour
final est décrit au §G, et il n'est pas de nous.

### Les nombres ont changé, et c'est légitime

De 234/110 sur notre branche seule à **258/115** après fusion : `main` a
légitimement ajouté 24 suites base et 5 suites navigateur. Aucun total n'a été
reproduit artificiellement.

---

## F — Revue hostile après fusion

### Les privilèges, MESURÉS en base

| | Résultat |
|---|---|
| `users.password_hash` pour `atlas_app` | **`INSERT` seul** — ni SELECT, ni UPDATE |
| `preuves_authentification` pour `atlas_app` | **`SELECT, DELETE`** — ni INSERT, ni UPDATE |
| `atlas_app` | ni superutilisateur, ni `BYPASSRLS` |

### Quatre contournements tentés pour de vrai

| Tentative | Réponse de PostgreSQL |
|---|---|
| lire le condensat | `permission denied for table users` |
| le modifier | `permission denied for table users` |
| **forger** une preuve | `permission denied for table preuves_authentification` |
| **rajeunir** une preuve | `permission denied for table preuves_authentification` |

### Le reste

| Ce qui a été cherché | Résultat |
|---|---|
| une migration entrante qui rend des droits sur `users` ou les preuves | **aucune** — les cinq relues une par une |
| une migration existante modifiée | **aucune** — que des ajouts |
| deux migrations partageant un NOM DE FICHIER | **aucune** |
| un chemin audio qui contourne la porte | **aucun** |
| `fichier.type` qui décide encore côté serveur | **nulle part** — il ne sert qu'au message de refus |
| un écran du patron sans garde | **aucun** — contrôle structurel vert |
| une table d'entreprise sans RLS ou sans `FORCE` | **deux files de purge**, et c'est **par conception** — migrations 0017 et 0056, mécanisme décrit par `CLAUDE.md` §4 |

---

## G — Régressions, classées avec preuve

### Sur la première fusion — trois rouges, trois causes

**1. `test-acces-roles-db.ts` — défaut du contrôle.** Il lisait
`users.password_hash` en direct. **C'est M9 qui parle, pas une panne.** Le
contrôle passe désormais par la porte `SECURITY DEFINER` : même règle éprouvée,
et il éprouve en plus le vrai chemin de connexion.

**2. `test-assistant-explique-l-appli.ts` — défaut du contrôle**, même famille :
`returning()` nu sur `users`.

**3. `test-mode-emploi.ts` — VRAIE RÉGRESSION, causée par M11.** Et c'est la
plus importante : **un contrôle de `main` a attrapé une régression de notre lot**,
que la batterie de notre branche seule ne pouvait pas voir. Le bouton
« Télécharger mes données » a quitté sa page pour un composant client — c'est
M11, qui devait demander qui parle avant d'ouvrir un export. La fiche du mode
d'emploi pointait encore l'ancien fichier : l'assistant aurait enseigné un geste
dont la preuve n'existe plus là où elle est annoncée.

### Sur la troisième fusion — un rouge, une horloge

**`test-liste-clients.ts` — défaut du contrôle, préexistant.** À 23 h 15 UTC, la
suite calculait « aujourd'hui » en UTC (`toISOString`) quand le serveur date une
facture à l'heure de l'atelier (`jourIso`). Le règlement paraissait antérieur à
sa facture, et **le refus du produit avait raison**. Deux heures par nuit.

*Une autre session a trouvé le même défaut le même soir, dans le même fichier, et
l'a corrigé avec la même fonction. La fusion a gardé SA version, déjà sur `main`.*

### Sur la quatrième fusion — un rouge, et il n'est PAS de nous

**`test-carte-reponse-mene-au-geste-e2e.ts` — DÉFAUT PRÉEXISTANT SUR `main`.**

*« aucune carte de réponse pour le chantier … à l'accueil »*, sur un cas — les
trois autres passent.

**Preuve, et non supposition :** `src/` et `scripts/` ont été ramenés au code de
`origin/main` SEUL, et la suite rend **exactement le même message**. Notre lot
n'a jamais touché ce fichier.

**Non corrigé, délibérément** : c'est hors du périmètre de cette fusion, et cela
ne la rend pas dangereuse — le défaut est déjà sur `main` sans nous. Le corriger
serait élargir le périmètre que vous avez fermé.

### Ce qui n'a JAMAIS été fait

Aucune assertion affaiblie. Aucun délai allongé. Aucune suite désactivée. Aucun
`--force`. Aucune règle métier modifiée pour faciliter la fusion.

---

## H — Diff final

Aucune modification opportuniste. Hors résolution de conflits, les seuls
changements sont les quatre corrections du §G — chacune imposée par un rouge —
et la mise à jour du commentaire de `rubriques-reglages.ts`, pour qu'il cesse de
contredire la réalité fusionnée.

**Rien n'a été traité de :** F7 / RGPD, F10 / CSP, rôles Salarié et Commercial,
`/catalogue`, qualité Dictée → Devis, sauvegardes, refonte, nettoyage.

**`ATLAS_PROXY_SAUTS` n'a pas été configuré.** La valeur dépend de l'hébergement
réel ; le comportement de repli est conservé.

---

## I — Défauts encore ouverts

### Sécurité

| | |
|---|---|
| **CSP `unsafe-inline`** | réelle — le retirer sans `nonce` casse l'application (F10) |
| **`/catalogue` sans garde de rôle** | faible — aucun prix, seulement le vocabulaire de dictée |
| **`cle-appareil` : seuil global** sans `ATLAS_PROXY_SAUTS` | faible, délibéré, documenté |
| **`/reglages/agenda` ouvert au COMMERCIAL sur `main`** | **fermé par cette fusion** — c'était la découverte du §D |

### Produit

F7 / RGPD · `/catalogue` et les rôles Salarié / Commercial · qualité Dictée → Devis.

### Hébergement

`ATLAS_PROXY_SAUTS`, **et il faut les deux moitiés** : poser la variable, ET
s'assurer que le mandataire écrase `x-forwarded-for`. Sans les deux, la poser
serait pire que ne rien faire.

### Tests

| | |
|---|---|
| `test-carte-reponse-mene-au-geste-e2e` | **rouge sur `main` sans nous** — prouvé |
| Trois suites navigateur qui lâchent sous charge | consignées dans `TODO.md` |
| Le mélange UTC / heure de l'atelier | deux suites l'avaient ; rien ne dit qu'il n'y en a pas une troisième |

### Hors périmètre, trouvé pendant la fusion — non corrigé

| | |
|---|---|
| `scripts/capture-reglages.mts` emploie le rôle disparu `membre` | script de capture, hors batterie |
| `ARCHITECTURE.md` porte en double §134, §135, §136, §164, §165 | dette de `main` |

### Sauvegardes

**Toujours aucune. C'est le point le plus grave du dépôt**, et il ne se règle pas
en codant.

---

## J — Verdict

# FUSION EFFECTUÉE MAIS NON VALIDÉE

**Ce qui est démontré**, et qui justifie « effectuée » :

- aucune modification récente de `main` n'est détruite — quatre fusions
  successives, chaque conflit tranché en conservant les deux propriétés quand
  elles existaient ;
- **aucune propriété de sécurité des lots précédents n'est perdue** — mesurée en
  base, et quatre contournements refusés par PostgreSQL ;
- aucune migration renommée, aucune rejouée, aucune modifiée ;
- 258/258 en base, et la connexion réelle derrière une origine étrangère.

**Ce qui manque pour « validée »**, et je ne l'habillerai pas :

**la batterie n'est pas entièrement verte.** Une suite navigateur rougit — et
elle rougit **à l'identique sur `main` sans nous**, ce qui est prouvé par
exécution. Le lot n'en est pas la cause, mais la règle du dépôt est claire : on
ne livre pas sur une batterie qui n'est pas au vert.

**Le travail fusionné est poussé sur `claude/atlas-securite-lot3`** — il est en
sécurité, plus seulement sur cette machine.

**RIEN N'EST POUSSÉ SUR `main`.** Deux chemins possibles, et c'est vous qui
tranchez :

| | |
|---|---|
| **pousser quand même** | le rouge est celui de `main` : le pousser ne l'aggrave pas, et la course avec les autres sessions s'arrête |
| **attendre** | que la session propriétaire de cette suite la répare, puis refusionner — au prix d'une course qui recommence |
