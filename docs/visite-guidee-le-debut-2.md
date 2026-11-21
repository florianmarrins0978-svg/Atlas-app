# La visite guidée, le début : seconde proposition

*21 novembre 2026. Ta demande : « propose une version améliorée juste pour les
4 premières étapes seulement, arrête-toi avant d'entrer dans le devis, au
client ».*

**La planche :** `appli/visite-guidee-le-debut-2.html`
<https://florianmarrins0978-svg.github.io/Atlas-app/visite-guidee-le-debut-2.html>

**Deux de tes sessions ont reçu cette demande et y ont répondu chacune.** Je ne
l'ai vu qu'au moment de livrer : l'autre avait déjà mis la sienne en ligne
(`appli/visite-guidee-le-debut.html`, son retour dans
`docs/visite-guidee-le-debut.md`). Les deux partent du même constat et font des
choix différents. Tu as donc deux propositions à comparer, sur les mêmes
quatre écrans. La visite d'aujourd'hui n'est pas touchée, et la fin de ma
planche ouvre les deux autres.

## Ce qui sépare les deux propositions

| | La première | La seconde (celle-ci) |
|---|---|---|
| L'appli autour de la cible | grisée, comme aujourd'hui | à ses couleurs |
| La bulle | le geste en titre, la phrase dessous | la phrase, puis le geste en or |
| Sa hauteur, sur ton écran | 116 points aux trois premières étapes, 180 à la dernière | 151 points aux trois premières, 99 à la dernière |
| L'arrivée sur un écran | la page est posée sur la cible | la page arrive en haut, comme dans l'appli, puis glisse jusqu'à la cible |
| Montrer où toucher | le cadre doré qui bat | le cadre doré, et une main qui vient toucher deux fois puis se retire |
| Toucher à côté | la bulle tremble | rien ne tremble : la main revient |
| Ce qu'on regarde sans le toucher | la ligne de la facture éclairée | « Ouverte le 21/11 » surligné, comme au surligneur |
| Le trait d'or sous l'onglet | figé, juste à 390 points de large seulement | replacé à toute largeur, et il glisse de Devis à Factures comme dans l'appli |
| Sortir de la visite | pas avant la fin, comme aujourd'hui | une croix, à chaque étape |
| L'ouverture | celle d'aujourd'hui | la même phrase, en feuille posée au bas de l'écran, sans le petit titre |

**Ce que je lui ai repris :** « Touchez Costa. » La liste écrit « Costa », pas
« Mme Costa » : elle avait raison, on fait toucher le mot qui est à l'écran.

## Mon avis, et ce qui le ferait changer

**Je garderais la seconde pour ce qu'elle fait, et la bulle peut prendre la
forme courte de la première si tu la préfères.** Une visite sur le site de
vente sert à montrer l'appli : la griser pour montrer un bouton la montre moins
bien, et une main qui touche se comprend sans lire. La première a pour elle sa
bulle plus basse de 35 points aux trois premières étapes.

Ce qui me ferait changer d'avis : ton essai sur ton iPhone (voir plus bas), et
ton goût pour la main.

## Les quatre étapes

1. *Vos chantiers en cours, et ce qui attend votre réponse.* Touchez Vos clients.
2. *Tous vos clients, et ce qu'ils vous doivent.* Touchez Costa.
3. *Sa fiche : ses coordonnées, ses devis, ses factures.* Touchez Factures.
4. *Vous voyez si le client a ouvert sa facture.* Rien à toucher : « Suivant ».

La 1 est ta phrase. La 2 perd « rangés par lettre », la 3 « Tout se télécharge
d'un coup ». La 4 est neuve : l'ancienne disait « ouverte, payée ou due » sur
une facture qu'on ne voyait pas. L'étape 4 ne fait plus toucher « Dernier
devis » : c'est l'entrée dans le devis, où tu m'as dit d'arrêter.

## Ce qui a été fait autrement, et pourquoi

| | Pourquoi |
|---|---|
| **Le guide lit le doigt, pas le clic** | dans cette planche les écrans figés ne répondent plus eux-mêmes, et sur un iPhone Safari n'envoie aucun clic pour un appui hors d'un lien ou d'un bouton : elle y serait restée muette |
| **De la marge autour de la cible** | un appui à dix points du bouton compte : on vise mal avec un doigt épais |
| **Deux appuis rapides ne sautent pas une étape** | qui hésite appuie souvent deux fois, et la cible suivante peut tomber sous le même doigt |
| **« Passer » est en retrait** | tant qu'un geste est attendu, c'est l'écran qu'on touche. Sans geste, « Suivant » devient le bouton plein |
| **L'onde autour de la cible grandit de 13 points** | en proportion, elle débordait de 56 points sur un téléphone et de 106 sur un ordinateur, autour de la ligne de Costa |

## Vu, et non touché : ce n'est pas le guide

- Sur l'accueil, les chantiers en cours sont datés de **juillet** alors que
  l'histoire de Mme Costa est en **novembre**. Deux sont une salle de bain et
  une toiture.
- Sur Vos clients, « Vos partenaires, Aucun » et « Services publics, Aucun ».
- Les changer demande de rejouer la base de démonstration, donc ton accord, et
  le script qui refait la visite. Ce script n'a jamais été enregistré (l'autre
  session l'a écrit dans `docs/visite-guidee.md`). **Le plus court :** si la
  session qui a fait la visite est encore ouverte, dis-lui « enregistre le
  dossier scripts/planche-figee/visite-guidee et pousse-le ».

## Vérifié ici, et ce qui ne peut pas l'être

**Vérifié ici**, au doigt, dans un vrai navigateur : dix parcours (320, 360,
390 et 414 points de large, une tablette, un ordinateur à 1024 et à 1280, les
animations réduites, sans fondu, et comme sur un iPhone, sans aucun clic hors
des boutons). Chaque geste mène à l'étape suivante, un appui à côté ne fait
rien avancer, un doigt qui glisse ne compte pas, la bulle ne couvre ni la cible
ni la barre du bas, le trait d'or tombe sous son mot, la page ne déborde pas,
aucune erreur. Cinq défauts ont été vus rouges avant d'être corrigés.

**Pas vérifiable ICI : Safari sur ton iPhone.** Ce poste n'a que Chromium. Les
conditions de Safari ont été imitées, pas jouées. **À essayer sur ton
téléphone** : si un appui sur le cadre doré ne fait rien, dis-le-moi, c'est là
que ça se jouerait.

## Pour la refaire

Tout est dans le dépôt, dans `appli/scripts/visite-le-debut-2/` : le guide,
ce qui l'assemble sur les quatre écrans, et le parcours au doigt dans dix cas.
Ni serveur ni base : rien n'y demande ton accord.

## Ce que tu as à trancher

1. **La première, la seconde, ou un mélange.**
2. **La main** : la garder, ou le cadre doré seul.
3. **Les deux temps** : là où ce qu'on regarde n'est pas ce qu'on touche (la
   facture, puis Dernier devis), la visite gagne un appui sur « Suivant ». Elle
   est plus claire, et un peu plus longue.
