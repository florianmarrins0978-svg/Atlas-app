# Runbook de réponse aux incidents — Atlas

## Diagnostic de premier niveau (toujours commencer ici)

1. `GET /api/health/live` — le process répond-il ?
2. `GET /api/health/ready` — quelle dépendance est en échec (`dependances`) ?
3. Consulter les journaux applicatifs (JSON structuré en production, voir
   `src/server/logger.ts`) — chaque entrée porte un `requestId` permettant de
   suivre une requête à travers toute la pile.
4. Si Sentry est configuré (`SENTRY_DSN`), vérifier le tableau de bord Sentry
   pour les exceptions récentes groupées par empreinte.

## Incident : `/api/health/ready` renvoie 503

**Cause probable :** PostgreSQL injoignable ou configuration invalide.

- `dependances.base_de_donnees = "echec"` → vérifier l'état du fournisseur de
  base de données managée, la validité de `DATABASE_URL`, les quotas de
  connexions.
- `dependances.stockage_configure = "echec"` → configuration `STORAGE_*`
  invalide ou incomplète en production ; vérifier les variables
  d'environnement du déploiement, pas le code.

## Incident : connexions utilisateur refusées en masse

**Cause probable :** `AUTH_SECRET` a changé (invalide toutes les sessions
existantes) ou Redis (limitation de débit) indisponible.

- Un changement d'`AUTH_SECRET` déconnecte tous les utilisateurs
  immédiatement (JWT signés avec l'ancienne clé deviennent invalides) — ne
  jamais changer cette valeur sans en informer les utilisateurs au préalable.
- Si Redis est indisponible, `verifierLimite()` (voir
  `src/server/rate-limit/index.ts`) lèvera une exception à la construction du
  magasin en production — vérifier la connectivité Redis.

## Incident : le process applicatif redémarre en boucle

**Cause probable :** erreur de configuration au démarrage
(`ErreurConfiguration` levée par `src/server/env.ts`) ou erreur non
interceptée du pool PostgreSQL.

- Consulter les tout premiers journaux après démarrage — `env.ts` échoue
  toujours de façon explicite et nommée (variable manquante précise).
- Le pool PostgreSQL a un gestionnaire d'erreur (`pool.on("error", ...)`,
  voir `src/server/db/client.ts`) qui journalise sans faire planter le
  process — si le process plante malgré tout, chercher une exception non
  interceptée ailleurs (vérifier Sentry si configuré).

## Incident : un client signale une ligne de devis incorrecte ou dupliquée

- Rechercher dans les journaux les entrées
  "Échec de l'application d'une proposition" ou
  "Régénération du devis échouée" avec le `chantierId` concerné.
- Vérifier la table `propositions_ia` pour l'historique des propositions de
  ce chantier (statut `proposee`/`appliquee`/`expiree`) — chaque proposition
  a une identité serveur stable, jamais reconstruite côté client.
- Ne jamais corriger directement en base sans comprendre la cause : consulter
  d'abord `docs/ARCHITECTURE_DONNEES.md` et les tests de non-régression
  (`scripts/test-remediation.ts`) qui documentent les invariants attendus.

## Incident : purge planifiée des fichiers en échec

- Vérifier les journaux pour "Échec de la purge planifiée des fichiers".
- Confirmer que le planificateur externe envoie bien l'en-tête
  `x-cron-secret` correspondant à `CRON_SECRET`.
- Une purge en échec n'est jamais silencieuse : la route renvoie `500` avec
  un message d'erreur journalisé, jamais un `200` trompeur.

## Escalade

**[À COMPLÉTER PAR L'ÉQUIPE]** — nommer ici la personne ou le canal
d'astreinte à contacter si un incident dépasse ce qui est couvert par ce
runbook, et le seuil de gravité à partir duquel une communication client est
nécessaire.
