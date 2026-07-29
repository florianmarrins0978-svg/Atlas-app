# Atlas

Application mobile (PWA) pour artisans : dictée sur chantier → vérification
humaine → calcul du prix → préparation du devis → planning simple.

La spécification fonctionnelle officielle est [`docs/MVP.md`](docs/MVP.md).
L'architecture de données est décrite dans
[`docs/ARCHITECTURE_DONNEES.md`](docs/ARCHITECTURE_DONNEES.md) et ses
[corrections v2.1](docs/ARCHITECTURE_DONNEES_v2.1_corrections.md) (document le
plus récent, faisant autorité).

## Démarrage en développement

```bash
cp .env.example .env   # renseigner au moins DATABASE_URL
npm install
npm run db:migrate     # applique les migrations (idempotent)
npm run db:seed        # données de démonstration + utilisateur demo@atlas.local
npm run dev
```

## Scripts disponibles

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm run start` | Build et démarrage en mode production |
| `npm run typecheck` | Vérification TypeScript |
| `npm run lint` | Lint |
| `npm test` | Suite de tests (base de données requise) |
| `npm run test:e2e` | Tests de bout en bout (démarre son propre serveur) |
| `npm run db:migrate` | Applique les migrations non encore appliquées |
| `npm run db:seed` | Données de démonstration |

## Documentation opérationnelle

- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — déploiement, health checks, rollback
- [`docs/INCIDENT_RESPONSE.md`](docs/INCIDENT_RESPONSE.md) — réponse aux incidents
- [`docs/PRODUCTION_BACKUP_RESTORE.md`](docs/PRODUCTION_BACKUP_RESTORE.md) — sauvegarde/restauration, stratégie de migration
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) — système de design

## Principe fondamental

Le patron reste l'unique expert du chantier. L'IA ne décide jamais : elle
transcrit une dictée et propose une structuration modifiable. Aucune durée,
aucun nombre d'hommes, aucun matériel, aucun prix n'est jamais affirmé par
l'IA sans validation humaine explicite.
