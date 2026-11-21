# Revérifier la visite guidée

`appli/visite-guidee.html` se joue au doigt, de bout en bout, sans serveur ni
base : rien ici ne demande son « oui ».

```bash
node appli/scripts/visite-guidee/parcourir.mjs                 # tout, à 320, 390, 1024 et 1280 points (une dizaine de minutes)
node appli/scripts/visite-guidee/parcourir.mjs --vite          # son écran seulement, 390 × 664
node appli/scripts/visite-guidee/parcourir.mjs --seulement chrono
node appli/scripts/visite-guidee/parcourir.mjs --adresse https://florianmarrins0978-svg.github.io/Atlas-app/visite-guidee.html
```

Il sort en erreur et nomme l'étape dès qu'un contrôle tombe.

| Contrôle | Ce qu'il tient | La remarque qui l'a fait naître |
|---|---|---|
| `visite` | chaque étape mène à la suivante ; la cible n'est jamais sous le guide ni hors de l'écran ; rien ne déborde ; les 19 rubriques des Réglages s'ouvrent et reviennent ; faire défiler replie le guide | « la petite barre noire cache les informations » (21 novembre) |
| `essais` | les boutons à essayer du devis et de la facture s'enchaînent sans Retour ; Suivant fait avancer | « on est obligé de faire retour pour essayer les autres » (21 novembre) |
| `muets` | chaque bouton des écrans d'essai répond | `CLAUDE.md` §3 bis, 2 quater |
| `chrono` | à chaque étape, le guide est là, opaque et immobile, en moins de 600 ms, processeur ralenti quatre fois | « on reste sur la page plusieurs secondes » (21 novembre) : 3 546 ms pendant que la fiche du client s'écrivait seule |

**Chaque contrôle a été vu rouge** sur le défaut qu'il tient, avant la
correction. Le `chrono` a même dû être repris : sa première version comptait
comme présent un guide qui commençait à s'effacer, et passait au vert sur la
visite fautive.

**Ce qu'il ne voit pas : Safari sur un iPhone.** Ce poste n'a que Chromium.
La visite pose `cursor: pointer` sur chaque cible, sans quoi Safari n'envoie
aucun appui hors d'un bouton.

**Ce qui manque toujours : le script qui FIGE les écrans** de la visite
(`scripts/planche-figee/visite-guidee/`, jamais enregistré, voir
`docs/visite-guidee.md`). Ce dossier-ci vérifie la planche ; il ne la refait
pas.
