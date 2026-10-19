# Arrosage : les prix des fournisseurs et l'import d'un devis (19 octobre 2026)

Branche `claude/arrosage-prix-et-devis`, **pas encore sur `main`**. Elle part du
lot « Fournisseurs et partenaires », dont elle lit les prix.

## Pourquoi pas sur ta branche aquaplus

`lot/catalogue-aquaplus-corrections` n'existe que sur ton PC : elle n'est pas
sur GitHub, et aucune session de ton PC n'était joignable. J'ai donc parti de
`main` (qui contient ce lot jusqu'au 19 octobre, 9 h) et des planches publiées.
Le neuf vit dans des fichiers neufs ; les fichiers de l'autre session ne
portent que de petits ajouts (liste dans `HANDOVER.md`).

## Ce qui est codé

| Planche | Ce qui est fait | Où |
|---|---|---|
| Les prix sur le plan | « Le matériel du plan » : le prix d'achat à côté de chaque pièce, « Le moins cher » ou un fournisseur, le total indicatif hors taxes (la C), les pièces sans prix comptées à part | `LeMaterielDuPlan.tsx`, `prix-du-plan.ts` |
| Importer un devis | « Par où commencer » (croquis, ou devis en photo ou PDF), les pièces reconnues, « Pas dans le catalogue », la nourrice composée au nombre d'électrovannes avec ce qui manque grisé, « Ajouter ce qui manque », « Ajouter une pièce », « Envoyer au fournisseur », « Il manque le croquis » | `DepuisUnDevis.tsx`, `devis-du-plan.ts` |
| Demandes envoyées | la liste envoyée (plan ou complément de devis) s'enregistre chez le fournisseur choisi | `EnregistrerLaDemande.tsx` |
| Photos | les 42 photos du 18 et 19 octobre copiées dans `public/arrosage-photos`, 99 références de plus dans `photos.ts` | |

## Ce qui a été fait autrement, et pourquoi

- **Une pièce prend un prix par sa référence**, pas par son nom : un nom voisin
  ferait prendre le prix d'un autre raccord.
- **Le fournisseur se choisit** dans « Au fournisseur » : la planche écrivait
  Aqua Plus en dur.
- **« Garder la liste sans plan » la garde sur l'écran**, comme le plan, qui ne
  s'enregistre nulle part encore. À toi de dire où la garder.
- **« Par où commencer » se pose sous « Le piquage se fait »**, qui ouvrait
  déjà l'écran.

## Ce qui est éprouvé

| Contrôle | Résultat |
|---|---|
| `test-prix-du-plan` (référence, moins cher, total, jamais 0 €) | 5 sur 5 |
| `test-devis-du-plan` (reconnaissance, nourrice 3 voies, message) | 3 sur 3 |
| pièces posées, règles du patron (37), cloisonnement, pansements, code mort, couches, tirets, flèches, chartes, boutons | verts |
| types, lint | verts |
| l'écran réel, regardé en Origine et Nuit : « Par où commencer », le plan dessiné au doigt, « Le matériel du plan » (141,70 €, 23 pièces sans prix sur 26), « Au fournisseur » et la demande enregistrée en base | vu |
| le montage d'un devis, rendu à part : apporté en couleur, manquant grisé | vu |

**Pas vérifiable ICI** : la lecture d'un vrai devis par l'IA. Ici l'écran dit
« Aucun fournisseur de lecture d'image n'est configuré. Le devis ne sera pas
lu. » À jouer sur ton espace.

## Ce qui reste

1. Pousser ta branche aquaplus locale, puis fusionner (voir `HANDOVER.md`).
2. La batterie entière, après le lot A.
3. Où garder « la liste sans plan ».
