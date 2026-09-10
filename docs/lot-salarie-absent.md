# « Salarié absent ? » — le petit +, la barre oblique, et ce qui a été mesuré

**9 septembre 2026.** Trois demandes du même soir, sur la fiche d'un jour du
planning. Ce document dit ce qui a été fait, ce qui a été vérifié, et ce qui ne
l'a pas été.

---

## Ce que vous avez demandé, et ce qui est codé

| Votre demande | Ce qui est fait | Où |
|---|---|---|
| *« Quelqu'un pas là faut le changer par salarié absent avec un petit + plutôt que le gros bouton »* | le bouton est devenu **« + Salarié absent ? »** | `GesteAbsence`, `src/app/planning/PlanningClient.tsx` |
| *« Salarié absent + sans contour ! »* | aucun cerne, aucun cadre, aucun fond | idem |
| *« Rajoute un ? à la fin »* | « Salarié absent ? » | idem |
| *« Retire ce jour-là, on sait que c'est ce jour »* | le titre est supprimé | idem |
| *« Mets Julien / Antoine, un / entre chaque salarié »* | la virgule devient une barre oblique | `ditQuiPart`, `src/lib/planning-jour.ts` |
| *« La façon de le noter tu la laisses »* | rien d'autre n'a bougé : le nom à toucher, « Plutôt Matin / Après-midi », « Annuler » | — |

**La planche est en ligne**, et elle garde les trois tailles de + pour montrer
ce qui a été écarté :
`https://florianmarrins0978-svg.github.io/Atlas-app/salarie-s-absente.html`

---

## Ce qui a été discuté plutôt qu'exécuté

**Le cerne ne pouvait pas partir sans rien à sa place.** Ce même geste était une
phrase nue le 6 septembre, et il vous a échappé une journée entière — c'est vous
qui l'aviez signalé le 7 : *« comment savoir qu'il faut cliquer dessus ? »*. La
réponse d'alors était la pastille que vous trouvez aujourd'hui trop grosse.

**Ce qui remplace le cerne, c'est le +**, et ce n'est pas de l'ornement : il dit
« ceci s'appuie, et ça ajoute », ce qu'un cadre ne disait pas. C'est pourquoi la
variante « le + tout seul, sans mot » est montrée sur la planche mais **n'a pas
été retenue** : sans mot, on ne sait pas ce qu'on ajoute.

**Ce qui n'a pas rétréci : la cible du doigt.** 44 px de haut, pleine largeur.
Un geste raté avec des gants coûte autant qu'un geste invisible.

**Un contrôle a dû être corrigé, pas contourné.** `test-pas-la-ce-jour-e2e.ts`
exigeait « un cerne, une ombre ou un fond » — c'est-à-dire exactement ce que
vous veniez de faire retirer. Il accepte désormais le **+** comme quatrième
signe, et refuse toujours les quatre absents à la fois.

---

## Ce qui reste ouvert, et que je n'ai pas tranché

**Quand vous n'avez aucun salarié**, l'écran garde votre phrase — « Je ne suis
pas là ». « Salarié absent ? » n'y voudrait rien dire. Vous ne vous êtes pas
prononcé : dites-le si vous voulez un seul mot pour les deux cas.

---

## Ce qui a été mesuré, et ce qui ne l'a pas été

| | |
|---|---|
| types, lint, mémoire | **verts** |
| pansement, code mort, couches, flèches | **verts** |
| `test-planning-jour.ts` (la barre oblique) | **vert** |
| `test-planning-e2e.ts` (43 contrôles du planning) | **vert** |
| `test-pas-la-ce-jour-e2e.ts` | 5 verts sur 6 |
| publication de la planche | **verte**, et le site a été interrogé à son adresse |

**LE ROUGE QU'IL FAUT DIRE.** Sur ce poste, la batterie complète rend
**22 suites navigateur rouges — avant comme après ce lot**. Vérifié en remettant
le fichier à nu : `test-pas-la-ce-jour-e2e` rend le MÊME échec sans une seule de
mes lignes. La cause tient à une ligne du journal : *« le bandeau du banc
apparaît sur un serveur qui n'en est pas un »*. Ce bandeau est une bande fixe :
tout ce qui se mesure « recouvert » tombe avec lui.

**Ce que cela veut dire pour vous :** ce lot n'allume aucun rouge, mais je ne
peux pas vous montrer une batterie verte tant que ce bandeau paraît hors banc.
C'est inscrit dans `TODO.md`, à reprendre avant tout lot qui compte sur elle.

**Et pour voir le changement dans l'application**, il faut que votre espace
redémarre : l'écran **Réglages** dit quelle version est servie.
