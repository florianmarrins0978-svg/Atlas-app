---
version: 1
slug: "appli-facture-au-planning-html"
primary_target: "appli/facture-au-planning.html"
related_targets: []
---

# Surface : planche « La facture au planning » (appli/facture-au-planning.html)

Mode : Operate. Maquette essayable, aucun code dans `src/` (`CLAUDE.md` §3 bis).
Elle sert un seul choix : où poser les trois portes de la fiche de chantier —
la facture, le devis, la fiche client — quand cet écran disparaîtra.

## Direction contract

THESIS : le planning est fini et ne se rejoue pas ; la planche ne montre que ce
qui s'y ajoute, dans un cadre à la taille de son téléphone où chaque allure
révèle son propre coût. Refuse la planche à regarder — celle-ci s'essaie au
pouce.

OWN-WORLD : celui de l'application, en charte **Nuit**, relevé sur sa capture du
4 septembre 2026 — fond `#101210`, plage `#1a1d19`, encre `#e9e8de`, gris
`#84887b`, or `#B98B47` (l'or ne suit pas la charte). Sur Nuit l'accent est
CLAIR : ce qu'on pose sur un aplat prend `--sur-plein`, jamais un crème écrit en
clair (faute du 22 août 2026).

STORY : il ouvre la planche, touche A, B, C, voit la même journée se comporter
autrement, et répond une lettre.

FIRST VIEWPORT : titre court, trois onglets, puis le cadre 390 × 664 — le
préambule a été coupé jusqu'à ce que l'écran arrive vite ; l'explication et la
mesure vivent SOUS le cadre.

FORM : le socle est relevé, pas réinterprété — semaine, capsule du jour, nom en
serif, durée dorée, lieu, pastille d'équipe, chevron, tiroir « 3 chez le
client ». Sa consigne : *« garde le planning tel quel, il est fini. »*
Interaction signature : en C, la feuille monte **dans** le cadre (0,42 s,
`cubic-bezier(.16,1,.3,1)`, annulée sous `prefers-reduced-motion`) — hors du
cadre elle monterait nulle part, ce que la première version faisait.

CE QUE LA REVUE A CORRIGÉ, et qui ne se redéfait pas :
- le cadre a une **hauteur fixe** ; sans elle, A ne dépassait jamais et son coût
  restait invisible ;
- **B ne pose un bouton que là où il y a un geste**. Trois aplats clairs — dont
  un sur une facture déjà partie — appelaient « geste » une consultation ;
- la mesure est **lue sur le rendu** (375 px contre 794), jamais estimée.

FINISH : rien n'est codé tant qu'il n'a pas répondu A, B ou C. La planche est
liée depuis `appli/essais.html` et son adresse ne lui est donnée qu'une fois
qu'elle répond 200.
