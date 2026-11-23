# Refaire la planche « L'identité attachée au SIRET »

`appli/soignee/identite-au-registre.html` est posée sur le VRAI écran Mon
entreprise (`/reglages/identite`) du compte de démonstration. Serveur lancé sur
la base de démonstration (son « oui » d'abord, `CLAUDE.md` §5) :

```bash
ATLAS_ADRESSE=http://localhost:3000 node appli/scripts/identite-au-registre/figer.mjs /tmp/fige-id
node appli/scripts/identite-au-registre/composer.mjs /tmp/fige-id appli/soignee/identite-au-registre.html
node scripts/planche-figee/parcourir.mjs "$PWD/appli/soignee/identite-au-registre.html" /tmp '.ir-changer=>changer' '.ir-prendre=>change'
```

Les mots proposés vivent dans `MOTS`, en tête de `composer.mjs`. L'entreprise
d'arrivée (« Paysages Durand ») est inventée, comme son numéro ; son numéro de
TVA est celui que l'appli en tire.
