# Atlas — Mise sur `main` de la correction « dictée → devis »

**29 août 2026.** Ce dossier ne rouvre aucun chantier et n'ouvre aucun lot. Il
rend compte de trois choses, et de rien d'autre :

1. la levée d'une **ambiguïté de mon rapport précédent** — elle était réelle, et
   elle méritait la question ;
2. la **preuve** que les migrations aux numéros en double coexistent sans danger ;
3. l'**état Git vrai**, et ce qui a été fait avec l'autorisation reçue.

---

## 1. L'ambiguïté, et ce qu'elle cachait

Le dossier 08 écrivait au §3 « la fusion est faite », puis au §5 « autoriser la
fusion vers `main` ». Les deux phrases étaient exactes, et ensemble elles étaient
trompeuses : **elles parlaient de deux fusions de sens opposé**, et rien ne le
disait.

| Ce que la phrase désignait | Sens | État au moment du rapport |
|---|---|---|
| §3 « la fusion est faite » | `origin/main` **→ ma branche** | **faite** — 163 commits de `main` tirés chez moi |
| §5 « autoriser la fusion » | **ma branche → `main`** | **pas faite**, et elle attendait l'accord |

C'est une faute de rédaction de ma part, pas un doute sur l'état du dépôt. La
formulation juste aurait été : *« j'ai intégré `main` chez moi ; il reste à
publier mon travail sur `main`. »*

### L'état Git, mesuré et non supposé

Relevé au moment de la question :

```
branche de travail  : claude/audit-dictee-devis-ryqfy6
  HEAD              : 8cfc9b2

main LOCAL          : dcfe242        ← périmé, jamais utilisé pour travailler
main DISTANT        : 575aad7

origin/main → ma branche : 2 commit(s) de main manquaient encore
ma branche → main        : 19 commit(s) à moi absents de main
```

Et le contrôle qui tranche vraiment — les fichiers, pas les compteurs :

```
✗ ABSENT de main : src/lib/natures-prestation.ts
✗ ABSENT de main : src/lib/quantite-commerciale.ts
✗ ABSENT de main : src/lib/comparabilite-prix.ts
✗ ABSENT de main : drizzle/0070_prix_a_chiffrer_et_comparabilite.sql
✗ ABSENT de main : scripts/verifier-chaine-dictee.mts
```

**Verdict : les corrections n'étaient pas sur `main`.** Il fallait donc bien
fusionner, et la fusion n'était pas un doublon.

---

## 2. Migrations 0068 / 0069 : coexistence sûre — **OUI**

La consigne était de chercher, avant de toucher à quoi que ce soit, une
hypothèse « un numéro = une migration unique » dans le dépôt, la CI, le
déploiement ou l'outillage. Recherche faite. **Elle n'existe nulle part**, et
voici les deux preuves.

### 2.1 Par le code — un seul applicateur, indexé sur le NOM COMPLET

`scripts/run-migrations.ts` est le seul chemin qui applique une migration :

```ts
CREATE TABLE IF NOT EXISTS _migrations (
  nom text PRIMARY KEY,          // ← le nom entier du fichier, pas son préfixe
  appliquee_a timestamptz NOT NULL DEFAULT now()
)

const fichiers = readdirSync(dossierMigrations)
  .filter((f) => f.endsWith(".sql"))
  .sort();                        // ← tri alphabétique sur le nom entier

for (const fichier of fichiers) {
  if (dejaAppliquees.has(fichier)) continue;   // ← comparaison sur le nom entier
```

Ce qui a été cherché, et n'a **rien** donné : `slice(0, 4)`, `substring(0, 4)`,
`parseInt(nom)`, `Number(fichier)`, `match(/\d{4}/)` sur un nom de migration —
dans `scripts/`, `.github/workflows/`, `.devcontainer/` et `drizzle.config.ts`.
Aucune extraction de numéro n'existe.

Les trois autres endroits qui touchent au dossier :

| | Ce qu'il en fait |
|---|---|
| `drizzle.config.ts` | `out: "./drizzle"` — sert à **engendrer** à la main. `drizzle-kit` n'est appelé par aucun script, aucun workflow, aucun script de banc |
| `drizzle/meta/_journal.json` | **lu par personne**. Vérifié : aucune référence dans `scripts/`, `src/`, `.github/`, `.devcontainer/` |
| `scripts/test-migrations-sous-rls.ts` | relit tous les `.sql` triés par nom, et sa table d'exceptions est indexée par **nom complet** (`"0039_identite_entreprise.sql"`) |

Et la CI applique les migrations par `npm run db:migrate` (`ci.yml:114`) —
c'est-à-dire exactement le même applicateur. Il n'y a pas de second chemin.

### 2.2 Par la base — les doublons sont **déjà le régime normal**

Le point qui clôt la question, et qui n'est pas un raisonnement mais un relevé.
Sur une base migrée de bout en bout :

```
numéro 0035 → 2     numéro 0064 → 2     numéro 0067 → 3
numéro 0036 → 2     numéro 0065 → 2     numéro 0068 → 2
numéro 0062 → 2     numéro 0066 → 2     numéro 0069 → 2
numéro 0063 → 2
```

**Dix numéros portent déjà plusieurs migrations**, dont certains depuis 0035 —
c'est-à-dire depuis longtemps, en service, sans incident. Le dépôt tourne avec
plusieurs sessions en parallèle ; deux d'entre elles prennent naturellement le
même numéro le même jour.

Les quatre fichiers concernés sont enregistrés distinctement :

```
0068_effacement_client_devis_envoye.sql      ← une autre session
0068_prestation_structuree.sql               ← ce lot
0069_fil_assistant.sql                       ← une autre session
0069_ligne_de_prix_et_ses_prestations.sql    ← ce lot
0070_prix_a_chiffrer_et_comparabilite.sql    ← ce lot
```

**Décision : les fichiers sont conservés tels quels.** Les renommer serait
d'ailleurs le geste dangereux — `_migrations` retenant le nom complet, un
fichier renommé serait vu comme neuf et **rejoué** sur toutes les bases qui
l'ont déjà appliqué, production comprise.

---

## 3. Ce qui a été fait avec l'autorisation

### 3.1 Nettoyage des sorties de build

Trois dossiers, tous ignorés par git et recréables sans perte :

```
.next                 5.0G
.next-batie           988K
.next-verification    130M
```

`.next-batie` datait du 27 août. Entre-temps `main` avait déplacé la page
`fiche-entretien` (commit `b034a52`), et le validateur engendré par cet ancien
build la référençait encore. `tsconfig.json` exclut `.next-batie/dev` mais pas
`.next-batie/types` : `tsc --noEmit` **et** `next build` le lisaient tous les
deux — **deux étapes rouges pour un seul reste**, et zéro erreur dans le code.

`tsconfig.json` n'a **pas** été modifié pour masquer le problème. C'était une
option tentante et c'eût été une faute : la règle du dépôt vaut aussi contre
soi-même — on ne rend pas un contrôle plus tolérant pour obtenir du vert.

### 3.2 La batterie AVANT nettoyage, pour mémoire

Elle établit que les deux rouges étaient bien les seuls :

| Étape | Résultat |
|---|---|
| Types | ❌ — 2 erreurs, **toutes deux dans `.next-*`** |
| Lint | ✅ |
| Construction | ❌ — même cause, unique |
| Mémoire du dépôt | ✅ |
| Fournisseurs d'IA | ✅ |
| **Suites base de données** | **✅ 274/274** |
| Données de démonstration | ✅ |
| **Suites navigateur** | **✅ 116/116** |
| Connexion derrière un proxy | ✅ |

274 + 116 au vert **après** l'intégration des 163 commits de `main`. C'est le
chiffre qui compte : la correction et le travail des autres sessions cohabitent.

### 3.3 Ce que la fusion a révélé sur la cohabitation des sessions

Trois faits, tous nés du fait que plusieurs sessions écrivent sur la même
application :

**a) Collision de paragraphe.** Deux sessions avaient pris le §191 dans
`ARCHITECTURE.md`. La règle du dépôt tranche : **c'est celui qui n'est pas
encore sur `main` qui se renumérote.** Le §191 du lot est devenu **§203**, ses
références suivies. Les doublons §134-136 et §164-165 sont antérieurs, déjà sur
`main` : pas touchés.

**b) Une autre session avait réparé les trois mêmes suites de calendrier — et
mieux.** Elle dispose d'un helper `unJourAutreQueLesProposees()` et de
sélecteurs `[data-jour][data-etat]` là où ma version cliquait les jours un par
un. **Sa version a été retenue, la mienne jetée.** Deux lectures d'un même
calendrier auraient divergé, ce que le dépôt interdit explicitement.

**c) Deux commits de plus sont arrivés pendant la vérification**, touchant
`src/app/chantiers/[id]/informations/actions.ts` — un fichier que ce lot modifie
aussi. Selon la règle, cela impose une **batterie complète**, et non un
raccourci. Elle a donc été rejouée entièrement sur l'état propre et fusionné.

**Aucun des 163 + 2 commits n'a été perdu. Aucune poussée en force. Aucune
réécriture d'historique. Aucun travail d'une autre session supprimé.**

---

## 4. La vraie IA : toujours NON, et c'est honnête

`npm run verifier:chaine-dictee` a été rejouée. Sortie inchangée :

```
Fournisseur : dev
❌ Aucune clé d'IA n'est configurée : rien n'a été appelé, et ce contrôle
   ne peut donc RIEN prouver.
```

Code de sortie 1. **Aucune des douze informations demandées — nature, espèce,
quantité, unité, méthode, diamètre, hauteur, tailleEquipe, dureePrevue,
non-fusion tonte/démontage, absence d'invention — n'a été observée sur une
réponse réelle de modèle.** Les affirmer serait précisément la faute interdite.

Ce qui reste vrai sans clé, et qui a été mesuré : **une faute de transcription
ne contamine plus rien.**

```
[abattage · principale]  Érable — démontage en rétention / Évacuation des déchets
[autre]                  Tombe de la pelouse (1200 m²)
```

« Tombe » ne rejoint pas la ligne d'abattage, ne prend pas son prix, n'entre pas
dans sa mémoire de prix. Elle sort seule, « à chiffrer », donc **visible**.

**Et c'est délibérément le comportement retenu :** aucun correcteur
probabiliste de Whisper n'a été créé. Deviner que « tombe » veut dire « tonte »
serait inventer une donnée de chantier — exactement ce que le produit s'interdit.
La ligne inconnue et séparée est le comportement sûr, parce qu'elle se voit.

---

## 5. Ce qui n'a pas été touché

| Sujet | État |
|---|---|
| « 2 souches × prix unitaire » | **inchangé** — la ligne garde le prix de grille, l'écran pose la question |
| « Offert / geste commercial » | **non créé** |
| Whisper | **non touché** — mesuré seulement |
| `tsconfig.json` | **non modifié** — le problème a été réglé, pas masqué |
| Numérotation des migrations | **non modifiée** — coexistence prouvée sûre |

Aucun lot ouvert, aucune architecture modifiée, aucun défaut sans rapport
corrigé au passage.

---

## Questions

1. **Sur la non-renumérotation des migrations.** L'argument est qu'un fichier
   renommé serait rejoué, `_migrations` retenant le nom complet — et que dix
   numéros en double tournent déjà sans incident. Voyez-vous un scénario où deux
   `0069` distincts posent réellement problème : un outil de restauration, une
   comparaison de schémas, un audit ?

2. **Sur l'ordre alphabétique comme ordre d'application.** `0069_fil_assistant`
   passe avant `0069_ligne_de_prix_et_ses_prestations` parce que « f » précède
   « l ». Aujourd'hui elles touchent des tables différentes, donc l'ordre est
   indifférent. Faut-il un contrôle qui refuse deux migrations de même numéro
   touchant la **même** table, ou est-ce se prémunir contre un fantôme ?

3. **Sur le refus de créer un correcteur de Whisper.** Une ligne « à chiffrer »
   nommée « Tombe de la pelouse » est visible mais laide, et l'artisan doit la
   corriger à la main. L'alternative — suggérer « vouliez-vous dire tonte ? »
   sans rien appliquer — est-elle un juste milieu, ou la première marche vers
   l'invention ?

4. **Sur les deux rouges de build.** Un reste de build local a rendu deux étapes
   rouges alors que le code était sain. Cela peut se reproduire chez n'importe
   qui. Faut-il que la batterie nettoie elle-même ses sorties avant de commencer,
   au prix de plusieurs minutes de reconstruction à chaque fois ?

5. **Qu'est-ce qui manque ?** Entre le micro et le devis, quelle étape peut
   encore échouer sans qu'aucun des contrôles décrits ici ne le révèle ?
