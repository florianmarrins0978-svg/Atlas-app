---
version: 1
slug: "appli-vente-cause-2-html"
primary_target: "appli/vente/cause-2.html"
related_targets: ["appli/vente/outils.html"]
---

# Surface : planche « Cause, en mouvement », le site de vente rejoué en cinéma (appli/vente/cause-2.html)

Mode : Persuade. Planche essayable posée à côté de `appli/vente/cause.html`, qui ne bouge pas : sa demande du 17 novembre 2026, « une maquette de la version améliorée, des animations plus jolies, plus spectaculaires, je te laisse toutes les libertés, ne modifie pas cette version, crée une autre maquette pour pouvoir comparer ». Aucun code dans `src/`.

Ce qui est repris tel quel de `cause.html` : tous les textes et leur ordre, les prix, les couleurs (crème, vert nuit, vert feuille, or), Instrument Serif et Hanken Grotesk, les vraies captures et les vrais films de l'appli, et la mécanique des films (première image, film, dernière image) éprouvée sur son iPhone.

Ce que ses retours passés interdisent, et qui tient ici : rien n'est dessiné par-dessus un écran de l'appli (« enlève cette pastille blanche »), aucun anneau ni pulsation, aucun geste d'écran lié au défilement (« ça bug »), pas de papier froissé (« c'est nul ») ni d'écrans qui glissent, s'empilent ou zooment dans un téléphone fixe (« ça ne fait pas professionnel »). Une scène part tôt (un tiers à l'écran) mais laisse une demi-seconde pour voir avant le geste.

## Direction contract

THESIS : rien ne se retape, tout se porte. Le site prouve sa promesse par un seul geste répété : un objet vrai (les mots dictés, la feuille du devis, le montant de la TVA) est porté de sa source à sa destination sous les yeux du visiteur. Refuse la page produit où chaque section entre du même fondu.
OWN-WORLD : celui de `cause.html`, inchangé. Matières ajoutées : la profondeur (les téléphones se tournent vers le lecteur en 3D), l'écriture (la feuille du devis s'écrit de haut en bas), l'onde verte de la voix, les bandes nuit qui montent comme des feuilles aux coins arrondis.
STORY : en dix secondes le visiteur voit que sa voix devient un devis ; il y croit parce que les vrais écrans font le geste ; il appuie sur Essayer.
FIRST VIEWPORT : téléphone 390 × 664 : le chapo et les deux boutons sont là tout de suite, le titre monte mot à mot en une seconde, et au bas de l'écran le téléphone monte incliné dans la scène sauge, la feuille du devis glisse de derrière lui. Ordinateur : titre à gauche, scène à droite, le téléphone en 3D suit le pointeur, la feuille s'écrit.
FORM : mise en scène au fil de la page, jouée dans le temps à l'arrivée de chaque scène, le défilement ne commandant que la profondeur. seed: none (pinned) « des animations plus jolies, plus spectaculaires » « je te laisse toutes les libertés ». Interaction signature : l'objet porté (douze mètres devient 12 ml, la feuille glisse derrière le téléphone du client, la TVA entre dans Ma TVA). Voie code-led.
FINISH : unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Plan de mouvement

- Moment central : Dictez. La voix (onde verte) devient la phrase, mot à mot ; « douze mètres » vole et devient « 12 ml » sur la ligne du devis, le prix arrive, le total se compte.
- Continuité : la feuille du devis se montre derrière le téléphone du client et glisse derrière lui, jamais devant l'écran (Envoyez, le geste de l'ouverture à l'envers) ; dans le film de ce téléphone, la signature du client quitte sa page et se pose dans l'encadré du devis (18 novembre ; refilmé le 19 sur les écrans de l'appli) ; la fiche d'intervention porte une seule cinématique, du trajet au retour du soir (19 novembre, son oui : Maps, l'appel, les travaux cochés, la remarque, le retour envoyé, l'écran du patron), tournée dans l'appli, et la section « Et aussi » n'existe plus ; le montant de la TVA sort de la facture et entre dans Ma TVA (Encaissez, repris de `cause.html`) ; les bandes nuit montent en feuilles arrondies.
- Retour d'action : le menu, la bascule mois ou année (curseur qui glisse, prix qui roulent), les questions qui s'ouvrent en douceur.
- Ordre : une chose à la fois. La réponse aux corvées après la troisième barrée, le compteur après le titre, « 12 ml » après l'étiquette, le nouveau prix après l'ancien. Sur téléphone, ce qui ne se joue qu'une fois attend d'être au-dessus du bouton d'essai.
- Budget : une seule boucle au défilement (profondeur des téléphones, fil d'avancement, soleil couchant de la fin), un canevas de 84 px pour l'onde, arrêté hors de l'écran. Moins de mouvement demandé, ou pas de script : chaque scène montre son état le plus parlant, immobile, comme `cause.html`.

## Non résolu

- Pas éprouvé sur Safari ici (Chromium seul) : à regarder sur son iPhone.
- DESIGN.md n'existe pas dans ce dépôt et cette planche n'en crée pas : le monde est celui de `cause.html`.
