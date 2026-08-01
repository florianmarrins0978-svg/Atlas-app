# Atlas

Application mobile (PWA) pour artisans : dictée sur chantier → vérification
humaine → calcul du prix → préparation du devis → planning simple.

> **Vous voulez essayer l'application ?** Suivez
> [`docs/ESSAYER.md`](docs/ESSAYER.md) — l'application entière s'ouvre depuis un
> navigateur, y compris sur téléphone, sans rien installer.
>
> **Vous reprenez le projet ?** Commencez par [`HANDOVER.md`](HANDOVER.md), puis
> [`PROJECT_STATE.md`](PROJECT_STATE.md) et [`TODO.md`](TODO.md). Le dépôt est la
> source de vérité : tout ce qu'il faut pour continuer y est écrit, sans dépendre
> d'une conversation passée.

La spécification fonctionnelle officielle est [`docs/MVP.md`](docs/MVP.md).
L'architecture de données est décrite dans
[`docs/ARCHITECTURE_DONNEES.md`](docs/ARCHITECTURE_DONNEES.md) et ses
[corrections v2.1](docs/ARCHITECTURE_DONNEES_v2.1_corrections.md) (document le
plus récent, faisant autorité).

Le dossier [`appli/`](appli/README.md) héberge par ailleurs l'application
Arborea (écrans statiques + coque Capacitor + tests), copiée depuis le dépôt
`Arborea-` et publiée sur GitHub Pages. C'est un projet distinct de
l'application Next.js décrite ci-dessous, avec son propre outillage.

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

La direction du produit — l'agent qui prépare devis, créneaux et envois, et ce
qu'il ne fera jamais seul — est cadrée dans [`docs/AGENT.md`](docs/AGENT.md).

## La mémoire du dépôt

Tenue à jour après chaque lot de travail, pour que le projet se transmette sans
perte d'une conversation à l'autre. Protocole dans [`CLAUDE.md`](CLAUDE.md).

- [`HANDOVER.md`](HANDOVER.md) — de quoi reprendre le travail à froid
- [`PROJECT_STATE.md`](PROJECT_STATE.md) — ce qui est fait, ce qui reste, ce qui bloque
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — les décisions structurantes et leur pourquoi
- [`TODO.md`](TODO.md) — les prochaines tâches, par priorité
- [`CHANGELOG.md`](CHANGELOG.md) — l'historique des changements qui comptent
- [`CLAUDE.md`](CLAUDE.md) — les règles permanentes et les conventions
- [`docs/AGENT.md`](docs/AGENT.md) — le parcours du produit et ses points d'arrêt

## Documentation opérationnelle

- [`docs/A-FAIRE.md`](docs/A-FAIRE.md) — ce qui doit être réglé avant de servir de vrais artisans
- [`docs/QUESTIONS.md`](docs/QUESTIONS.md) — les questions posées en cours de route et leurs réponses, en langage courant
- [`docs/RGPD.md`](docs/RGPD.md) — registre des traitements, sous-traitants, conservation, violations
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — déploiement, health checks, rollback
- [`docs/INCIDENT_RESPONSE.md`](docs/INCIDENT_RESPONSE.md) — réponse aux incidents
- [`docs/PRODUCTION_BACKUP_RESTORE.md`](docs/PRODUCTION_BACKUP_RESTORE.md) — sauvegarde/restauration, stratégie de migration
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) — système de design

## Principe fondamental

Le patron reste l'unique expert du chantier. L'IA ne décide jamais : elle
transcrit une dictée et propose une structuration modifiable. Aucune durée,
aucun nombre d'hommes, aucun matériel, aucun prix n'est jamais affirmé par
l'IA sans validation humaine explicite.
