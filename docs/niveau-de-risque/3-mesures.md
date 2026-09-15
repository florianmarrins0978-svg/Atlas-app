# 3 — Les mesures, et comment les rejouer

Tous les chiffres de ce dossier sortent d'une seule commande. Aucun n'est
estimé, sauf ceux qui le disent.

```bash
node -e "import('./scripts/_rayon-impact.mjs')"
node -e "import('./scripts/_rayon-impact.mjs')" "src/app/clients/[id]/actions.ts"
```

**Relevé le 14 septembre 2026**, sur `main` à `524a90e`.

---

## La surface de l'application

| | |
|---|---|
| fichiers `.ts`/`.tsx` dans `src/` | **697** |
| **points d'entrée** (que personne n'importe) | **122** |

| Famille | Nombre |
|---|---|
| écrans (page, gabarit) | 88 |
| routes API | 24 |
| `middleware.ts` | 1 |
| entrées serveur (`db/seed`, `planning/appariement`, `trimestre`) | 3 |
| `lib/` que personne n'importe dans `src/` | 3 |
| `robots.ts` et déclarations de types | 3 |

## Répartition du rayon

Combien de points d'entrée chaque fichier peut atteindre :

| Rayon | Fichiers | Part |
|---|---|---|
| 1 | **339** | 49 % |
| 2 | 61 | 9 % |
| 3 – 4 | 44 | 6 % |
| 5 – 9 | 64 | 9 % |
| 10 – 19 | 101 | 14 % |
| 20 et plus | 88 | 13 % |

Avec un seuil à 10 : **189 fichiers en niveau 3**, 508 en niveau 2.

## Les fichiers les plus étendus

| Rayon | Fichier |
|---|---|
| 88 | `src/lib/design-tokens.ts` |
| 77 | `src/profil-banc.ts` |
| 74 | `src/server/db/client.ts` · `db/schema.ts` · `env.ts` · `logger.ts` · `request-context.ts` |
| 67 | `src/lib/acces-roles.ts` |
| 64 | `src/lib/civilite.ts` |

## Le lot client

Les huit fichiers de `src/app/clients/` sont **tous à un rayon de 1**.

Ce que la fiche client importe, et le rayon de chaque dépendance — c'est là
que se joue le niveau du lot :

| Rayon | Dépendance de `clients/[id]/actions.ts` |
|---|---|
| 58 | `src/server/session-ctx.ts` |
| 39 | `src/lib/jour.ts` |
| **28** | `src/server/repositories/chantiers.ts` |
| 25 | `src/server/garde-action.ts` |
| **13** | `src/server/repositories/clients.ts` |
| 11 | `src/server/repositories/lignes-prix.ts` |
| 10 | `src/lib/nom-chantier.ts` |
| 1 | `src/server/repositories/donnees-client.ts` |

## Les suites navigateur

| | |
|---|---|
| suites `scripts/test-*-e2e.ts` | **151** |
| suites citant `"/clients"` | **7** (16 occurrences) |
| suites citant `"/reglages"` | 27 (53 occurrences) |

## Ce qui n'est PAS mesuré, et reste une estimation

| | |
|---|---|
| batterie complète ~50 min, quinze suites ~20 min | repris de `CLAUDE.md` §5 — **jamais chronométré ici** |
| gain d'un niveau 2 ciblé (~10 à 15 min) | **extrapolé** de la ligne ci-dessus |
| part des suites qui naviguent au clic plutôt qu'à l'URL | **non mesurée** — elle décide si la correspondance point d'entrée → suite tient |

## Ce que le calcul ne voit pas

- un `fetch("/api/…")` : aucun lien d'import, donc aucun rayon ;
- un `import()` dynamique dont le chemin est une variable ;
- ce qui n'est importé que depuis `scripts/` — seul `src/` est parcouru, donc
  un fichier appelé de là paraît n'être importé par personne.
