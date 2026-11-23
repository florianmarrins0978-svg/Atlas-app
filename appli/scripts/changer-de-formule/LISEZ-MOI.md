# Refaire la planche « Changer de formule »

`appli/soignee/changer-de-formule.html` est posée sur le VRAI écran Abonnement
(`/reglages/abonnement`), figé dans chaque état par `figer.mjs`. Le serveur, la
base et le compte d'essai demandent son « oui » (`CLAUDE.md` §5).

**Aucun amorçage.** Le compte vient de la vraie création de compte
(`appli/scripts/parcours-inscription/figer.mjs`, voir son `LISEZ-MOI.md`), qui
ne vide rien ; `figer.mjs` pose ensuite la formule et l'échéance sur la ligne
d'abonnement de ce compte, entre deux prises.

```bash
source scripts/monter-base-locale.sh
# Une clé factice : l'écran se croit branché (bouton plein, pas de plage bleue),
# et l'appel au prestataire échoue, ce qui peint le vrai refus.
DATABASE_URL=postgresql://atlas_app:atlas_app_ci_pw@localhost:5432/atlas_test \
  AUTH_SECRET=ci-secret-not-a-real-production-value-000000000000 CRON_SECRET=ci-placeholder-cron-secret-0000000000 \
  REDIS_URL=redis://localhost:6379 LLM_PROVIDER=dev \
  ATLAS_PAIEMENT_CLE=sk_test_planche_factice ATLAS_URL_PUBLIQUE=http://localhost:3001 \
  npx next dev -p 3001 > /tmp/dev.log 2>&1   # dans un autre terminal
ATLAS_ADRESSE=http://localhost:3001 node appli/scripts/parcours-inscription/figer.mjs /tmp/inscription /tmp/dev.log
ATLAS_ADRESSE=http://localhost:3001 node appli/scripts/changer-de-formule/figer.mjs /tmp/fige <e-mail du compte créé>
node appli/scripts/changer-de-formule/composer.mjs /tmp/fige appli/soignee/changer-de-formule.html
node scripts/planche-figee/parcourir.mjs "$PWD/appli/soignee/changer-de-formule.html" /tmp \
  '[data-atlas="formule-entreprise"]=>monter' '[data-atlas="choisir-entreprise"]=>feuille-monter' '[data-atlas="confirmer"]=>entreprise'
```

| | ce qu'il fait |
|---|---|
| `figer.mjs` | Artisan puis Entreprise puis Illimité, échéance au 23 décembre 2026 ; les cartes touchées pour de bon ; « Avant de partir » ouverte (sa feuille sert de gabarit) ; « Passer à Entreprise » appuyé, pour le vrai refus |
| `composer.mjs` | pose la feuille proposée dans la vraie feuille vidée, le vrai bouton plein en « Confirmer » ; la plage rouge du vrai refus dans la feuille ; l'état « descente prévue » sur l'écran d'Entreprise. Les mots proposés vivent dans `MOTS`, ce que la planche raconte dans `DIT` |
