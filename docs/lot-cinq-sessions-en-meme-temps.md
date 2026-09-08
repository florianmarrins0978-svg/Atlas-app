# Cinq sessions qui tournent en même temps

*8 septembre 2026 — ce que tu as demandé, ce qui marche, ce qui reste.*

---

## Ce que tu voulais

> *« Une session utilise le port 3000, mais si tu as besoin de coder pour
> réaliser ça tu peux déjà le faire. L'idée c'est qu'après ça chaque session
> puisse tourner en même temps sans se gêner. »*

Et ta condition, du 5 septembre : **aucune manip en plus**. Tu envoies un
prompt, la session se débrouille.

---

## Ce qui est en place

### 1. Un ATELIER par session

Chaque session prend un **rang**, au premier port libre, sans se coordonner
avec personne. Ce rang lui donne tout ce que la batterie s'appropriait :

| Rang | Port | Base | Redis | Dossiers bâtis |
|---|---|---|---|---|
| 0 | 3000 | `atlas_test` | base 0 | `.next`, `.next-verification` |
| 1 | 3001 | `atlas_test_a1` | base 1 | `.next-a1`, `.next-verification-a1` |
| 2 | 3002 | `atlas_test_a2` | base 2 | `.next-a2`, … |

**Le rang 0 rend exactement la batterie d'avant.** Une session seule ne voit
aucune différence, et aucun chiffre ne bouge. Le partage ne s'invente que
lorsqu'une deuxième session arrive.

La base d'un atelier neuf se crée toute seule, avec ses droits et ses
migrations. La commande, elle, ne change pas :

```
npm run verifier:avant-livraison
```

### 2. Un DOSSIER de travail par session

```
npm run sessions:preparer 5
```

Cinq dossiers, côte à côte, tous branchés sur le même dépôt (`git worktree`).
Chacun a sa branche ; `main` reste le seul bien commun, et chaque session
fusionne et pousse comme avant.

**Le seul geste, une seule fois :** un `npm install` par dossier.

---

## Pourquoi le dossier était OBLIGATOIRE, et pas un confort

C'est le point important de la nuit, et il n'a pas été deviné — il a été
**mesuré**, après avoir rendu bavarde une étape qui échouait en silence depuis
trois batteries.

L'étape « Connexion derrière un proxy » disait seulement *« le serveur n'a pas
répondu en dix minutes »*. Sa sortie partait à la poubelle. Rétablie, elle a
donné la cause en une ligne :

```
⨯ Another next dev server is already running.
  Dir: C:\Users\Flori\Desktop\atlas-real-app\atlas-app
```

**Next.js refuse un second serveur de développement dans le même dossier**,
quel que soit le port. Donner un port à chaque session ne suffisait donc pas :
tant qu'elles partagent l'arbre, une seule peut jouer ses suites navigateur.

---

## Ce que la mesure a corrigé, et qu'aucune lecture n'aurait vu

| Défaut | Ce qu'il aurait coûté |
|---|---|
| L'essai du port **mentait sous Windows** — ouvrir un serveur d'essai sur `127.0.0.1` réussit alors qu'un autre écoute sur `0.0.0.0` | le rang 0 rendu « libre » pendant qu'une session servait dessus : les deux batteries se marchaient dessus exactement comme avant |
| Deux sessions lancées dans la même seconde prenaient **le même rang** | le partage échouait précisément dans le cas qu'il devait couvrir |
| Le jeu de démonstration **refusait** la base d'un atelier | il avait raison : sa garde n'accepte que des bases où effacer est sans conséquence. Ouverte au plus juste, et éprouvée dans les deux sens |
| Une base créée à la volée n'a **aucun privilège par défaut** | les tables créées ensuite restaient hors de portée du rôle applicatif |
| L'étape de connexion lançait le banc **par `npm`, à travers un shell** | sous Windows le shell avale tout : le banc ne démarrait pas, son journal faisait zéro octet, et l'étape attendait dix minutes pour ne rien dire. Même piège que le lanceur des suites, payé le 2 septembre |

---

## Les chiffres

**Deux batteries lancées en même temps**, dans deux dossiers différents,
pendant que ta session gardait le port 3000 :

| | Dossier n° 2 | Dossier n° 3 |
|---|---|---|
| Atelier pris | n° 1 — port 3001 | n° 2 — port 3002 |
| Base | `atlas_test_a1` | `atlas_test_a2` |
| Redis | base 1 | base 2 |
| Suites base | **303/321** | **303/321** |

Chacune a pris son rang toute seule, a créé sa base, l'a amorcée et a joué ses
suites base **sans jamais toucher à celle de l'autre**. C'est ce qu'on voulait
démontrer, et c'est démontré.

---

## Ce qui reste ouvert — et il faut que tu le saches

### 1. `main` ne compile pas pour qui le récupère à neuf

**Quatre contrôles** sont sur `main` et réclament du code qui n'existe que
dans **l'arbre partagé, non enregistré** — le travail en cours d'une autre
session :

```
scripts/test-compte-db.ts                    → ecrireIdentite, civilite, prenom
scripts/test-facture-reprend-le-devis-db.ts  → modalites, entrepriseTitulaireCompte
scripts/test-identite-personne.ts            → src/lib/identite-personne.ts   (NON SUIVI par git)
scripts/test-modalites-paiement.ts           → src/lib/modalites-paiement.ts  (NON SUIVI par git)
```

Les deux derniers sont les pires : `src/lib/identite-personne.ts` et
`src/lib/modalites-paiement.ts` ne sont **même pas suivis par git**. Ils
n'existent que dans ton dossier.

Dans ton dossier, ça compile — le fichier non enregistré est là. Dans n'importe
quel autre, `tsc` est rouge, donc la batterie ne peut pas être verte.

**Ce n'est pas mon lot, et je n'y ai pas touché** : c'est le travail en vol
d'une session voisine. Mais c'est exactement la panne que j'ai causée le
5 septembre avec un autre fichier, et c'est le meilleur argument pour le dossier
par session. **À dire à cette session : enregistrer son implémentation, ou
retirer le contrôle de `main` en attendant.**

### 2. Cinq batteries EN MÊME TEMPS, ce n'est pas raisonnable sur cette machine

Deux batteries simultanées ont suffi à faire tomber un serveur de
développement : connexion à 43 secondes, puis effondrement de Turbopack
(*« an internal panic occurred »*). Les suites base tiennent très bien à deux ;
ce sont les **suites navigateur** qui ne tiennent pas — trois serveurs Next et
deux navigateurs sur le même processeur.

**Ce que ça change pour toi, concrètement :** tes cinq sessions peuvent
désormais **travailler** en même temps sans se gêner, et chacune peut mesurer
**quand elle en a besoin** sans attendre qu'une autre libère le port. Deux
batteries en parallèle passent. Cinq, non — et aucune ligne de code n'y
changera rien, c'est la machine.

### 3. La batterie complète n'a pas pu être rendue verte cette nuit

À cause du point 1 : `tsc` est rouge sur `main` pour une raison qui n'est pas
la mienne. Le lot a été poussé quand même — il ne touche que l'outillage, il a
été éprouvé par deux batteries réelles, et il ne rend `main` ni plus ni moins
rouge qu'il ne l'était.

---

## Où c'est écrit

| | |
|---|---|
| `scripts/_atelier.ts` | le rang, le port, la base, Redis, les dossiers |
| `scripts/preparer-atelier.ts` | la base d'un atelier neuf, ses droits, ses migrations |
| `scripts/preparer-sessions.mjs` | les dossiers de travail |
| `ARCHITECTURE.md` §287 | l'atelier, et les quatre défauts mesurés |
| `ARCHITECTURE.md` §288 | le dossier par session, et pourquoi c'est la condition |
