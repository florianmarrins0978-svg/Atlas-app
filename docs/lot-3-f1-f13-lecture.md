# Atlas — F1 à F13 : rapport de lecture

**Document destiné à ChatGPT.** 25 août 2026. **Aucune ligne de code n'a été
écrite.** Tout ce qui suit a été mesuré sur le dépôt d'aujourd'hui.

---

## AVERTISSEMENT PRÉALABLE — le rapport d'audit n'est pas dans le dépôt

Votre §1 demandait de retrouver la définition exacte de F1 à F13 **dans le
dépôt**. Cherché : `TODO.md`, `HANDOVER.md`, `PROJECT_STATE.md`, `CHANGELOG.md`,
`docs/`, et **tout l'historique git** (`git log --all -S "F13"`, recherche des
fichiers supprimés).

**Résultat :**

| `TODO.md` (commit `c35289a`, 23 août) | *« F1 à F13 — treize points mineurs, listés dans le rapport d'audit »* |
| Le rapport d'audit lui-même | **absent du dépôt, et il ne s'y est jamais trouvé** |

Deux seulement y sont décrits par leur contenu :

> **F6** (deux paires de migrations partagent un numéro) et **F7** (les droits
> RGPD d'accès et d'effacement sont codés et testés, mais aucun écran ne les
> appelle).

**Conséquence, dite franchement.** Pour les onze autres, la seule formulation
disponible est **celle de votre brief**. Je ne les ai donc pas traités comme des
constats établis, mais comme des **allégations à vérifier** — ce qui revient au
même travail, puisque chacune est concrète et confrontable au code. **Je n'ai
inventé aucune exigence au-delà de ce que votre brief énonce.**

Si vous exigez la règle littérale — *« non retrouvé avec certitude, ne pas
corriger »* —, alors seuls F6 et F7 sont instruisables, et les onze autres
s'arrêtent ici. **Je pense que ce serait un gâchis** : les mesures ci-dessous ont
trouvé deux choses réelles, dont une que le brief ne nommait pas.

---

## A — Tableau F1 → F13

| Point | Constat | Code actuel | Exploitable ? | Protection existante | Verdict |
|---|---|---|---|---|---|
| **F1** | `derniereIssueMiseAJour()` sans contrôle d'accès | `src/app/reglages/actions.ts:428` — **aucun** `getCurrentCtx`, aucun rôle | **non anonyme** : le *middleware* exige une session. Un **membre** peut l'appeler | *middleware* | **PARTIELLEMENT FONDÉ** |
| **F2** | `/api/session-perimee` — déconnexion *cross-site* | `GET` qui efface six cookies puis 303 | **oui** : `<img src="…/api/session-perimee">` sur un site tiers déconnecte le patron | aucune | **FONDÉ** (nuisance) |
| **F3** | expose l'environnement | **corps mesuré en production** (voir §D) | **non** | `NODE_ENV === "production"` borne les origines | **PARTIELLEMENT FONDÉ — rien de sensible ne sort** |
| **F4** | `Content-Disposition` depuis un nom d'utilisateur | `nom: \`devis-${cle.numero}.pdf\`` (`envois-devis.ts:649`) | **non** — le nom est **engendré par le serveur** | — | **FAUX PROBLÈME** |
| **F5** | RLS de `corrections_dictee` sans `NULLIF` | `0025_vocabulaire_metier.sql:118` | **non** — *fail-closed* des deux côtés | `FORCE ROW LEVEL SECURITY` | **FONDÉ, mais ce n'est pas une vulnérabilité** |
| **F6** | migrations en double | `run-migrations.ts` suit **par nom de fichier** | **non** | — | **FAUX PROBLÈME — NE RIEN FAIRE** |
| **F7** | `exporterClient` / `effacerClient` sans écran | aucun appelant (`grep` sur tout `src/app`) | — | — | **DÉCISION PRODUIT / RGPD** |
| **F8** | agenda visible par un membre | `/reglages/agenda/page.tsx` — `getCurrentCtx` **sans rôle** | **oui** : un salarié lit le compte d'agenda relié du patron | les **actions** sont gardées ; la **lecture** non | **FONDÉ** |
| **F9** | réponse publique au devis sans cadence | `repondreAction` — **zéro** `verifierLimite` | **jeton à 256 bits** (`randomBytes(32)`) : indevinable | entropie du jeton | **PARTIELLEMENT FONDÉ** (durcissement) |
| **F10** | CSP `unsafe-inline` | `next.config.ts:19-25` — `script-src` **et** `style-src` | — | `nosniff`, M1/M2/M3, aucun `dangerouslySetInnerHTML` | **HORS LOT — LOT CSP DÉDIÉ** |
| **F11** | e-mails / IP en clair dans les journaux | seul `seed.ts` (script de développement) écrit un courriel | **non** | **contrôle existant** : `test-bourrage-connexion-db.ts:181` — *« l'adresse n'est écrite nulle part — seulement son empreinte »* | **DÉJÀ CORRIGÉ (Lot 1)** |
| **F12** | `/design/*` servi en production | 12 pages, `mock-data`, **aucune garde** `NODE_ENV` | **non** : données factices, et le *middleware* exige une session | *middleware* | **FONDÉ — hygiène** |
| **F13** | `robots.txt` absent | **confirmé absent** | — | — | **FONDÉ — cosmétique** |

---

## B — Les mesures qui tranchent, point par point

### F3 — ce que la route rend VRAIMENT en production

Votre §3 refusait une lecture structurelle. **Exécutée**, `NODE_ENV=production`,
sans variables Codespaces :

```json
{
  "connexion_possible": false,
  "ce_que_le_serveur_voit": {
    "origine_probable": "evil.example",
    "hote_retenu_par_next": "atlas.exemple.fr",
    "entete_host": "atlas.exemple.fr",
    "entete_x_forwarded_host": "atlas.exemple.fr",
    "entete_origin": "https://evil.example"
  },
  "origines_autorisees": [],
  "environnement": { "NODE_ENV": "production", "CODESPACE_NAME": null,
                     "GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN": null }
}
```

**Ce corps ne contient que les en-têtes de L'APPELANT LUI-MÊME**, une liste vide,
et `NODE_ENV`. Aucun secret, aucun chemin, aucun fournisseur, aucune
cartographie. **Conformément à votre consigne : je ne modifie pas cette route.**

*Ce qui mérite un contrôle, en revanche : que personne n'y ajoute demain une
variable d'environnement.*

### F5 — mesuré, et le dépôt explique lui-même l'écart

```
sans réglage :        current_setting('app.entreprise_id', true)  →  NULL
                      NULL::uuid  →  NULL  →  0 ligne, des DEUX côtés

réglage = '' :        sans NULLIF  →  ERROR: invalid input syntax for type uuid: ""
                      avec NULLIF  →  NULL  →  0 ligne
```

La migration `0002` s'appelle **`rls_robuste_contexte_vide`** et son en-tête dit :

> *« Le comportement de sécurité (fail-closed, aucune fuite) était déjà correct ;
> seule l'ergonomie de l'échec est corrigée. »*

`corrections_dictee` vient de la migration **0025**, donc **après** ce
durcissement, et ne l'a pas suivi. **58 politiques emploient `NULLIF`, deux ou
trois non.**

**Ce n'est donc pas une fuite** — c'est une erreur brutale au lieu d'un résultat
vide, sur une connexion mutualisée où PostgreSQL réinitialise le réglage à `''`.

### F8 — plus large que son libellé, puis plus étroit que la peur

`src/lib/rubriques-reglages.ts` porte une fonction **`adressesAutorisees(role)`**
— et **elle n'a AUCUN appelant**. `grep` sur tout `src/` : rien. **Rien
n'applique le rôle par adresse.**

Recensement des quinze pages de `/reglages` :

| Vérifient le rôle | `abonnement`, `documents`, `donnees`, `equipe`, `fiche-entretien`, `ia`, `identite`, `notifications`, `prix`, `tarifs` |
| Ne le vérifient pas, **et n'ont pas à le faire** | `apparence`, `compte`, `connexion` — rubrique « Moi », ouverte aux salariés |
| **Ne le vérifient pas ALORS QU'ELLES DEVRAIENT** | **`/reglages/agenda`** |
| Cas particulier | `/reglages/vocabulaire` — page d'éditeur, **protégée** ; une suite prouve que rien n'en sort |

**Une seule page**, donc. Ce qu'un salarié y lit : le compte d'agenda relié
(identifiant iCloud ou Google du patron) et son état. Les **écritures** sont
gardées par `exigerProprietaire`.

### F9 — le jeton ne se devine pas

```ts
export function genererJeton(): string {
  return randomBytes(32).toString("base64url");   // 256 bits
}
```

L'absence de cadence n'ouvre donc **aucune** attaque par devinette. Ce qui reste :
qui détient un jeton valide peut marteler la réponse à **son propre** devis.

### F6 — reverifié, et la conclusion tient

`scripts/run-migrations.ts` lit `readdirSync(...).sort()` et compare au contenu
de la table `_migrations`, **par nom de fichier**. Deux noms distincts sont deux
migrations distinctes.

> **Renommer serait la seule façon de casser quelque chose** : le nouveau nom
> passerait pour une migration jamais appliquée, et serait **rejoué**.

### F11 — déjà fermé, et un contrôle le prouve

`scripts/test-bourrage-connexion-db.ts:181` : *« l'adresse n'est écrite nulle
part — seulement son empreinte »*. Le seul courriel écrit dans un journal l'est
par `src/server/db/seed.ts`, un script de développement.

### F10 — pourquoi c'est un lot à soi

`unsafe-inline` est dans **deux** directives :

| `script-src` | scripts d'hydratation engendrés par Next lui-même |
| `style-src` | les `style={{…}}` de **presque tous les écrans** — le dépôt interdit les couleurs en clair et passe par des jetons, ce qui produit des styles en ligne partout |

Une CSP à nonce demanderait de poser le nonce dans le `middleware`, de le
propager, et de **retirer les styles en ligne de tous les écrans**. Le gain est
faible : aucun `dangerouslySetInnerHTML` dans le dépôt, et M1/M2/M3 ferment déjà
le service de contenu hostile.

---

## C — Ordre de traitement proposé

**Aucun point F n'est critique.** Aucun ne permet de lire les données d'une autre
entreprise, d'obtenir un accès, ni de contourner une garde.

| Rang | Point | Pourquoi ce rang |
|---|---|---|
| **1 — important** | **F8** | c'est le seul qui laisse un salarié voir une donnée du patron |
| **2 — durcissement** | **F2** | un site tiers peut déconnecter le patron. Nuisance réelle, correction petite |
| **3 — durcissement** | **F5** | aligner `corrections_dictee` sur le motif des 58 autres, **par une migration NEUVE** |
| **4 — durcissement** | **F1** | cohérence avec M12 : la mise à jour est réservée au patron, son issue devrait l'être aussi |
| **5 — durcissement** | **F9** | une cadence, par hygiène |
| **6 — hygiène** | **F12** | `/design/*` hors production |
| **7 — cosmétique** | **F13** | `robots.txt` |

**L'ordre minimise les régressions** : F8, F1 et F12 ne touchent que des gardes
d'écran ; F5 est une migration additive ; F2 et F9 touchent des chemins publics
et méritent d'être traités avec le plus de soin, donc pas en premier.

---

## D — À NE PAS toucher

| **F4, F6** | **faux problèmes.** Renommer une migration créerait précisément le défaut qu'on prétend corriger |
| **F11** | **déjà fermé par le Lot 1**, avec son contrôle |
| **F3** | **rien de sensible ne sort** — mesuré. Ne pas modifier la route |
| **F7** | **décision produit / RGPD.** Ne pas construire d'interface |
| **F10** | **lot CSP dédié** |

---

## E — Défaut trouvé hors des treize

**`adressesAutorisees(role)` est du CODE MORT.**

- **Chemin** : `src/lib/rubriques-reglages.ts:202`.
- **Impact** : aucun en soi — mais c'est la fonction qui *devrait* interdire à un
  salarié d'atteindre une adresse réservée au patron, et **rien ne l'appelle**.
  F8 en est la conséquence ; le prochain écran réservé au patron le sera aussi.
- **Reproduction** : `grep -rn "adressesAutorisees" src/` → une seule ligne, sa
  définition.
- **Protection existante** : chaque page se garde elle-même — **quand on y
  pense**. Dix sur onze y pensent.
- **Traitement proposé** : soit brancher cette fonction là où elle a un sens,
  soit la supprimer et poser un **contrôle structurel** qui exige une garde de
  rôle sur toute page de `/reglages` hors rubrique « Moi ». La seconde option est
  plus robuste : elle rougit à l'ajout d'un écran, pas seulement à l'usage.

---

## F — Plan de preuves

| Point | Contrôle à écrire | Rouge attendu avant | Vert après | Où la propriété est garantie |
|---|---|---|---|---|
| **F8** | suite base : un membre appelle la page ou son chargeur → refus | le membre lit le compte d'agenda | refus | **serveur** (garde de page) |
| **F8 bis** | contrôle structurel : toute page `/reglages` hors « Moi » porte une garde de rôle | `/agenda` manque | toutes présentes | architecture |
| **F2** | contrôle : une requête au `Sec-Fetch-Dest` autre que `document` ne doit rien effacer | les cookies sont effacés | refus | **serveur** |
| **F5** | suite base sous `atlas_app`, réglage forcé à `''` | `invalid input syntax for type uuid` | 0 ligne | **moteur** |
| **F1** | suite base : un membre appelle → refus | le membre lit l'issue | refus | **serveur** |
| **F9** | suite base : au-delà du seuil, refus | illimité | refus après N | **serveur** |
| **F12** | contrôle : `/design/*` refuse en production | 200 | 404 | **serveur** |
| **F13** | contrôle : `robots.txt` est servi | 404 | 200 | *aucune — voir ci-dessous* |
| **F3** | contrôle : le corps en production ne porte aucune variable hors `NODE_ENV` | *(vert d'emblée)* | vert | garde-fou contre l'avenir |

**Sur F13, une phrase que je tiendrai :** `robots.txt` **n'est pas une frontière
de sécurité**. Il demande à des robots polis de ne pas explorer. Il ne protège
aucune route, et aucun rapport ne prétendra le contraire.

---

## G — Ce que je NE ferai pas sans votre accord

- toucher à la CSP ;
- construire l'interface RGPD de F7 ;
- renommer une migration ;
- modifier l'architecture M11 ;
- toucher aux sauvegardes ou à l'audio.

**J'attends votre feu vert avant d'écrire la moindre ligne.**
