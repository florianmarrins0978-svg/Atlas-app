# Chercher les photos des pièces d'arrosage, un lot

Tu cherches des photos produit pour un catalogue d'arrosage (fournisseur Aqua Plus, France). Un artisan paysagiste validera chaque photo. Ton travail : de bons candidats, et la vérité sur leurs défauts.

Ton lot : le fichier `pieces.json` de TON dossier (indiqué dans ton message). Chaque entrée : référence Aqua Plus, désignation exacte, catégorie, marque si connue. Écris UNIQUEMENT dans ton dossier. Ne lance aucun fichier téléchargé.

## La règle qui ne se discute pas (sa consigne du 18 octobre 2026)

« Ne me montre pas des photos de 32 pour du 25, ou inversement. » Une photo proposée montre LA taille ou LA variante visée :
- preuve acceptée : le marquage lu sur la pièce (ouvre l'image avec l'outil Read et regarde), OU une image propre à la page de cette taille exacte. Une image commune à toutes les tailles d'un vendeur (même adresse d'image, ou même empreinte `sha1sum` que la page d'une autre taille) n'est PAS une preuve ;
- tu n'as rien à la bonne taille : ne télécharge rien pour cette forme, et dis-le.

## Une photo par FORME, pas par référence

Des pièces qui ne diffèrent que par le diamètre ou le filetage ont la même tête : une seule photo par forme, prise à la TAILLE VISÉE, servira à toutes. Taille visée :
- raccords PE et colliers de prise en charge (CPC) : le 25 (CPC : 25 x 3/4"), sinon la plus proche qui existe dans la liste ;
- raccords filetés / taraudés en pouces (polypro, robinetterie) : le 1", sinon le 3/4" ;
- tubes : le Ø25 pour le PEHD, le Ø16 pour le PEBD ;
- raccords goutte-à-goutte : le Ø16.
Les produits à MODÈLE (électrovannes, programmateurs, sondes, regards, clés, câbles…) : une photo par modèle. Les variantes qui se VOIENT différemment (9V à impulsion contre 24V : solénoïde différent ; FF contre MM ; nombre de stations écrit sur la façade ; nombre de fils d'un câble) ont chacune la leur. Ne regroupe que ce qui est visuellement identique, et dis lequel tu as photographié.

## Critères de la photo, dans l'ordre

1. la bonne pièce, la bonne forme, la bonne variante (taraudé = filetage intérieur, fileté = extérieur) ;
2. la bonne marque si la désignation en nomme une, sinon la marque que vend Aqua Plus (cherche « aquaplus » ou la référence sur le web pour la reconnaître ; les raccords polypro sont souvent Plasson ou Cepex, les colliers Plasson, les raccords Palaplast…) ; une autre marque, seulement si la forme est identique, et dis-le ;
3. fond blanc ou neutre, pièce seule, nette, 500 px ou plus.
1 à 2 candidats par forme. Fichiers : `<cle>-1.jpg`, `<cle>-2.jpg` (extension réelle), `<cle>` en minuscules sans accents (ex. `pp-mamelon-double`, `ev-rb-100dv-24v`). Télécharge avec `curl -L -A "Mozilla/5.0"`, vérifie que c'est une vraie image (`file`, taille > 5 Ko). Regarde chaque image toi-même avant de la garder.

Sources qui ont marché : sites des fabricants (plasson.fr, rainbird.com, hunterindustries.com, toro.com, solem.fr, duraplastics.com, palaplast), hydralians.fr, cityplumbing.co.uk, bricomarche.com, castorama.fr, leroymerlin.fr, manomano.fr, arrosage-distribution.fr, mon-irrigation.com, irrigationdirect, anjou-connectique.com, sprinklersupplystore.com, amazon.

## Ce que tu rends

`manifeste.json` dans ton dossier : un tableau, une entrée par photo (ou par forme sans photo) :
{ "forme": "<cle>", "nom": "<nom court de la forme ou du modèle, en français>", "refs": ["<toutes les références du lot que cette photo sert>"], "fichier": "<cle>-1.jpg" ou null, "montre": "<ce que la photo montre vraiment : taille, variante, ex. 25 x 3/4\" ou 9V FF>", "vise": "<la taille ou variante visée>", "preuve": "<marquage lu, ou page dédiée à cette référence>", "source": "<page>", "image": "<adresse de l'image>", "site": "<domaine>", "doute": "<vide si la photo montre exactement ce qui est visé ; sinon une phrase>" }
CHAQUE référence de `pieces.json` doit apparaître dans un `refs`. Français simple, phrases sans tiret long ni point médian.

En réponse : le nombre de formes, de photos, les formes sans photo, et tes doutes principaux. Court.
