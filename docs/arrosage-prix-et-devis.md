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
| Les prix sur le plan | le prix d'achat à droite de chaque pièce de LA liste, **chez le fournisseur de la pastille**, sa source et sa date dessous, « pas de prix chez … » quand il ne la vend pas, et le total avec la date de ses prix | `prix-du-plan.ts`, `ListeDesPieces.tsx` |
| Prix par fournisseur (planche du 20 octobre) | une pastille par fournisseur au-dessus de la liste, jamais « le moins cher » ; « Écrire à Aqua Plus » ouvre le mail, son adresse déjà écrite, la liste sans prix, et l'enregistre dans ses Demandes envoyées ; son début et sa fin de message gardés pour la fois suivante ; l'adresse sur sa fiche, dans Réglages | `LePlanDuJardin.tsx`, `FeuillePiece.tsx`, `FournisseursPartenaires.tsx`, migration `0133` |
| Importer un devis | « Par où commencer » (croquis, ou devis en photo ou PDF), les pièces reconnues, « Pas dans le catalogue », la nourrice composée au nombre d'électrovannes avec ce qui manque grisé, « Ajouter ce qui manque », « Ajouter une pièce », « Envoyer au fournisseur », « Il manque le croquis » | `DepuisUnDevis.tsx`, `devis-du-plan.ts` |
| Demandes envoyées | la liste envoyée s'enregistre chez le fournisseur : celui de la pastille pour le plan, celui qu'il choisit pour le complément d'un devis | `FeuillePiece.tsx`, `EnregistrerLaDemande.tsx` |
| Photos | les 42 photos du 18 et 19 octobre copiées dans `public/arrosage-photos`, 99 références de plus dans `photos.ts` | |

## Ce qui a été fait autrement, et pourquoi

- **Une pièce prend un prix par sa référence**, pas par son nom : un nom voisin
  ferait prendre le prix d'un autre raccord.
- **Corrigé après la fusion de `main` (20 octobre)** : j'avais d'abord posé une
  section « Le matériel du plan » à côté de la liste, avec son propre total.
  `main` avait déjà la colonne et le total dans la liste, comme tu l'as demandé
  le 19 au soir : deux totaux sur un écran, c'est un de trop. La section est
  retirée, et les prix vont dans la liste.
- **Corrigé le 20 octobre, sur ta planche** : la liste prenait le moins cher
  de tes fournisseurs. Elle prend maintenant ceux d'un seul, celui de la
  pastille, et chaque prix dit de qui il vient. Le choix « Chez qui » dans « Au
  fournisseur » est retiré pour le plan : c'est la pastille qui décide.
- **Le complément d'un devis importé n'a pas changé** (« Copier », « Envoyer »,
  le choix du fournisseur) : ta planche du 20 octobre ne le touchait pas.
- **« Garder la liste sans plan » la garde sur l'écran**, comme le plan, qui ne
  s'enregistre nulle part encore. À toi de dire où la garder.
- **« Par où commencer » est retiré le 21 octobre, sur ta décision** : il
  doublait le croquis. Il reste une ligne, « J'ai déjà un devis fournisseur »,
  sous le bloc du croquis.

## Ce qui est éprouvé

| Contrôle | Résultat |
|---|---|
| `test-prix-du-plan` (référence, unité, un seul fournisseur, source et date, le total de la liste) | 7 sur 7 |
| pièces posées (le message : son début, la liste, sa fin ; le lien du mail) | 24 sur 24 |
| `test-fournisseurs-partenaires-rls` (son adresse et son message, jamais ceux d'une autre entreprise) | 11 sur 11 |
| le 20 octobre, l'écran réel : pastilles Aqua Plus 146,20 € (« Prix Aqua Plus du 12/10/2026. Ils ont pu changer. ») et France Bonhomme 107,10 € (27 « pas de prix chez France Bonhomme »), le mail sans adresse et son alerte, « Bonjour Julien » retrouvé, « Merci, Florian » gardé en base, la demande enregistrée (26 lignes), l'adresse sur la fiche et « aqua plus » refusée | vu |
| `test-devis-du-plan` (reconnaissance, nourrice 3 voies, message) | 3 sur 3 |
| pièces posées, règles du patron (37), cloisonnement, pansements, code mort, couches, tirets, flèches, chartes, boutons | verts |
| types, lint | verts |
| l'écran réel, regardé en Origine et Nuit : « Par où commencer », le plan dessiné au doigt, « Au fournisseur » et la demande enregistrée en base | vu |
| après la fusion de `main` : la liste avec ses prix (turbine 9 × 11,90 € = 107,10 €, total 141,70 €, 25 pièces sans prix sur 28) | vu |
| le montage d'un devis, rendu à part : apporté en couleur, manquant grisé | vu |

**Pas vérifiable ICI** : la lecture d'un vrai devis par l'IA. Ici l'écran dit
« Aucun fournisseur de lecture d'image n'est configuré. Le devis ne sera pas
lu. » À jouer sur ton espace.

## Ce qui reste

1. Pousser ta branche aquaplus locale, puis fusionner (voir `HANDOVER.md`).
2. La batterie entière, après le lot A.
3. Où garder « la liste sans plan ».
