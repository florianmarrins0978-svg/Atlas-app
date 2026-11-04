# La note du devis, codée (4 novembre 2026)

Ta demande : *« tu peux coder ça, mais ne lance pas de batterie »*, après tes
choix du jour sur les deux planches de la note (`appli/soignee/devis-note-client.html`,
`appli/soignee/devis-note-avant-envoi.html`).

**Où c'est :** sur la branche `lot/note-du-devis`. **Pas sur `main`** : le lot
ajoute une case en base et touche la page devis de ton client, donc il lui
faut la batterie complète avant d'arriver dans ton application. Elle n'a pas
été jouée, à ta demande.

## Ce qui est codé, point par point

| Ton choix | Verdict | Fichier |
|---|---|---|
| La note sur la page du client, juste avant « J'accepte ce devis » (A) | codé | `src/app/devis/[jeton]/NoteDuDevis.tsx`, `formulaire.tsx` |
| « À savoir : » sur une plage dorée, deux lignes au plus | codé | `NoteDuDevis.tsx` |
| Plus longue, elle s'ouvre en entier d'un appui | codé | `NoteDuDevis.tsx` |
| Au toucher de « Notes / conditions », une fenêtre de 8 secondes | codé | `src/app/chantiers/[id]/devis-complet/OuLeClientLiraLaNote.tsx` |
| La vraie image de la page du client, la note entourée d'or | codé | `public/images/devis-note-chez-le-client.jpg` |
| Une seule fois par compte, plus jamais ensuite | codé, retenu en base | `drizzle/0163_aide_note_devis_vue.sql`, `src/server/repositories/aide-note-devis.ts` |

Rien de neuf à remplir pour toi : c'est le même champ « Notes / conditions »,
celui que le PDF imprimait déjà.

## Ce qui a été fait autrement, et pourquoi

- **« Une seule fois » se retient dans la base, par compte**, et pas dans le
  téléphone : sinon la fenêtre reviendrait sur ton PC, ou après un
  nettoyage du navigateur. Chaque compte de ton entreprise (un commercial, la
  facturation) la voit lui aussi une fois, puisqu'il écrit des devis.
- **L'image de la page du client est la même pour tous** : c'est celle de la
  planche, ta note d'exemple entourée d'or. Une image vivante de CE devis
  n'est pas possible avant que le devis parte.

## Ce que j'ai trouvé en le codant, et corrigé avant toi

1. **La note longue restait coupée sans s'ouvrir.** Le navigateur ne signale
   pas qu'un texte coupé de cette façon déborde, et en plus la note, une
   fois reconnue coupée, se remplaçait elle-même, ce qui annulait la
   reconnaissance. Corrigé, et vérifié à l'écran.
2. **La fenêtre restait noire ses premières secondes** : l'image arrivait
   après elle. Elle est maintenant chargée dès l'ouverture du devis.
3. **L'application n'avait pas le droit de lire la nouvelle case**, sur la
   table des comptes, protégée colonne par colonne. Le contrôle en base l'a
   vu rouge avant la correction.

## Ce qui a été éprouvé

| Contrôle | Résultat |
|---|---|
| Types, style | verts |
| La case « déjà vue » en base (`test-aide-note-devis-db`) | 4 sur 4, vue rouge avant le droit ajouté |
| La note dans ce que la page du client reçoit (`test-envois-devis`) | 39 sur 39 |
| Le parcours dans un vrai navigateur (`test-note-du-devis-e2e`) | 5 sur 5 : la note courte, la longue et sa feuille, sans note, la fenêtre au premier toucher, puis plus jamais |
| La page client existante (`test-devis-client-e2e`) | verte |
| Migrations, couches, code mort, tirets, flèches, chartes | verts |
| Écrans regardés ici, données de démonstration | note courte, note longue et sa feuille, page à 360 et 390 px, fenêtre du patron |
| **Batterie entière** | **pas jouée**, à ta demande |

## Ce qui reste ouvert

- **La batterie, puis `main`** : à lancer avec ton accord.
- **La place de la note sur le PDF** (sous les totaux aujourd'hui) : la
  planche de mise en page du devis d'une autre session la touche.
