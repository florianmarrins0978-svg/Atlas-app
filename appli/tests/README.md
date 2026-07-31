# Tests de bout en bout

Batterie de tests qui exerce chaque écran de l'appli et les cas limites, pour
garantir « zéro bug » à chaque mise en ligne. À lancer **avant chaque
déploiement**.

## Ce qui est couvert

- Navigation présente et sans erreur JS sur les 6 écrans, page active correcte.
- **Mes tarifs** : exemples, édition, persistance après rechargement, ajout de
  forfait, suppression.
- **Devis vocal** : extraction depuis la grille (nombres en lettres et en
  chiffres, forfaits sans double-comptage, poste sans prix **signalé et jamais
  chiffré**, note hors-sujet sans plantage, détection du client).
- Enchaînements **vocal → devis** et **devis → facture**.

## Lancer les tests

Pré-requis : Node.js + [Playwright](https://playwright.dev) (Chromium).

```bash
# Depuis le dossier appli/
npm install

# 1. Servir l'appli en local
python3 -m http.server 8080 &

# 2. Lancer les tests
BASE_URL=http://127.0.0.1:8080 npm run test:e2e
```

En intégration continue, ces trois étapes sont enchaînées par
`.github/workflows/pages.yml` : **aucune mise en ligne n'a lieu si un test
échoue**.

Sortie attendue : `✅ PASS: 52   ❌ FAIL: 0`. Le code de sortie est non nul si
un test échoue (utilisable en intégration continue).

> Note : les tests bloquent les ressources externes (polices, CDN) pour être
> rapides et déterministes hors-ligne. Cela n'affecte pas le site en production.
