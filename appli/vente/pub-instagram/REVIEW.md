# La relecture du film

17 novembre 2026, second montage. Le premier (51 secondes, 16 novembre) est
remplacé : il ouvrait sur huit secondes de texte avant le premier écran.

## Les choix faits

- **Droit au but**, sa demande. Plus de question, plus de corvées : le
  téléphone est à l'image dès la première, le micro s'allume dans la première
  demi-seconde, et le titre dit pour qui et quoi, « Artisans, dictez vos
  devis. ».
- **Un bénéfice par plan, en grand.** Les mots de chapitre du site (Dictez,
  Envoyez, Planifiez, Encaissez) et leur petite ligne laissent la place à une
  seule phrase de deux lignes, à 118 px, avec un mot en or.
- **Le nom : Cause.** Il paraît deux fois, en or dans « Cause écrit le devis »
  et sur la carte de fin. Aucun écran filmé ne portait l'ancien nom.
- **Sortis du montage pour aller vite** : l'accueil et « Créer un devis », la
  feuille d'envoi et ses dates, la carte « Devis accepté ». Le tournage les
  filme toujours.
- **Un seul chantier traverse l'appli** (Mr. Lemaire, 862,20 € TTC, 143,70 € de
  TVA) : le même montant sur le devis, la page du client, la facture et
  Terminés.
- **Le micro est filmé en gros plan** : il vit au bas de la fiche client, donc
  sous l'habillage d'Instagram.
- **Pas de doigt, pas d'anneau de clic** : sa consigne du 6 novembre pour le
  site de vente.

## Ce qui a été mesuré, ce qui a été regardé

- **Mesuré** : `npx hyperframes check` passe (aucune erreur, aucun texte hors
  de la zone d'Instagram). Durée 30,5 s, 1080 × 1920, 30 images par seconde.
- **Regardé** : vingt-trois images du rendu final, et les six enchaînements
  image par image.
- **Personne n'a rien écouté** : le film est muet.

## Les avertissements gardés exprès

- `film_silent` : aucune musique n'a pu être prise ici (le catalogue demande un
  compte). Elle s'ajoute dans Instagram.
- `outside_safe_zone` pour TikTok et YouTube Shorts seulement : le film est
  cadré pour Instagram (marge de 72 px à gauche, textes entre 270 et 1248 px
  de haut).
- `timeline_track_too_dense`, `nested_media_start_basis_ambiguous` : les temps
  des films sont bien ceux de leur scène.

## Le plan le plus faible, et ce qu'il faudrait

- **Le chrono tourne une fois et demie trop vite** (cinq secondes de dictée en
  trois et demie), pour tenir le plan. Personne ne le chronomètre, mais un
  tournage plus court de la note vocale le rendrait exact.
- **Le devis** (4 à 8 s). L'écran du devis sur téléphone range chaque ligne
  sur cinq rangées : on lit une ligne et le total, pas les quatre lignes d'un
  coup.
- **La page du client propose « Mercredi 18 » avant « Lundi 16 »** : l'appli
  range les deux dates dans l'ordre où l'artisan les a touchées.
- **Sans clé d'IA**, la ligne du devis ne sort pas de la dictée à l'image : on
  voit le micro, puis le devis. À refaire sur son espace le jour où le
  tournage pourra s'y jouer.
- **« Cause écrit le devis »** : le nom est aussi un mot courant. L'or et la
  majuscule le signalent, la carte de fin le confirme ; s'il se lit mal, la
  phrase peut devenir « L'appli Cause écrit le devis ».
