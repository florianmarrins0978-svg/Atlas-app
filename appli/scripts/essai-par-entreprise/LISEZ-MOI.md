# Refaire la planche « Un essai par entreprise »

`appli/soignee/essai-par-entreprise.html` est posée sur les VRAIS écrans de la
création d'un compte (la question du SIRET) et de l'accueil d'un compte neuf,
figés par `appli/scripts/parcours-inscription/figer.mjs` (voir son
`LISEZ-MOI.md` pour monter le serveur, sur son « oui »). Puis :

```bash
node appli/scripts/essai-par-entreprise/composer.mjs /tmp/fige appli/soignee/essai-par-entreprise.html
node scripts/planche-figee/parcourir.mjs "$PWD/appli/soignee/essai-par-entreprise.html" /tmp 'button[data-va="deja"]=>deja'
```

Les mots proposés vivent dans `MOTS`, en tête de `composer.mjs` ; tout le reste
est l'écran de l'appli. « Créer un devis », éteint sur l'accueil, porte
`aria-disabled` comme dans l'appli : `parcourir.mjs` refuse de le toucher, il
s'éprouve d'un clic forcé.
