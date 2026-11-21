# La visite guidée, le début revu

*21 novembre 2026. Ta demande : une version améliorée des quatre premières
étapes de la visite, arrêtée au client, avant d'entrer dans le devis.*

**La planche :** `appli/visite-guidee-le-debut.html`, sur les mêmes vrais
écrans figés que `appli/visite-guidee.html` (l'accueil, Vos clients, la fiche
de Costa, ses factures). Rien dans `src/`, rien de changé dans la visite
d'aujourd'hui : on compare les deux.

## Ce qui n'allait pas, vu sur les captures à 390 × 664 (ton écran)

| Étape | Défaut | Ce qu'il coûtait |
|---|---|---|
| Toutes | le bouton le plus visible de la bulle était « Passer », en blanc plein | l'œil allait vers « Passer », pas vers le cadre doré : on apprenait à sauter |
| Toutes | le geste (« Touchez Vos clients. ») était la ligne la plus petite, en bas | ce qu'il faut faire se lisait en dernier |
| Toutes | la bulle prenait 182 points de haut, plus d'un quart de l'écran | elle cachait l'écran qu'elle décrivait |
| Toutes | une barre de progrès de 1 sur 74, presque vide | elle annonçait une visite interminable |
| 2 | « Touchez Mme Costa », alors que la liste écrit « Costa » | on cherche un mot qui n'est pas à l'écran |
| 3 | la page s'ouvrait au milieu : le nom du client et ses coordonnées hors de l'écran | « ses coordonnées » sans coordonnées |
| 4 | « Ses factures » : **aucune facture visible**, cachée sous la barre du bas | l'étape ne montrait pas ce qu'elle annonçait |
| 4 | « ouverte, payée ou due » | la fiche du client n'écrit ni « payée » ni « due » sur une facture ; elle écrit « Ouverte le », « Réception confirmée le » ou « Pas encore ouverte. » (`src/lib/reception-facture.ts`) |
| 1 à 4 | toucher un champ de recherche ouvrait le clavier du téléphone | le clavier recouvrait la bulle |

## Ce qui change

| | Avant | Après |
|---|---|---|
| **Le titre de la bulle** | le nom de l'écran (« L'accueil ») | **le geste**, en grand : « Touchez Vos clients. » |
| **La phrase dessous** | deux lignes | une, ce que l'écran apporte |
| **Retour et Passer** | Passer en bouton blanc plein | deux mots discrets en haut de la bulle ; seul le cadre doré appelle le doigt |
| **Le progrès** | une barre de 74 | quatre traits, un par étape |
| **La hauteur** | 182 points | 116 points, sur ton écran |
| **Ce que l'écran montre** | défilement fixe | la page défile pour que la cible ET ce que dit la phrase soient vus en entier, au-dessus de la bulle ; le haut de l'écran tombe sur un bord net, jamais au milieu d'un nom |
| **Toucher à côté** | la bulle tremble | la bulle tremble et le cadre doré se rappelle |
| **Cadre doré et lumière** | un seul signe | le cadre doré qui bat veut dire **touchez ici** ; la lumière sans cadre (étape 4) veut dire **regardez ici** |
| **Les champs** | le clavier s'ouvrait | figés en lecture : aucun clavier |
| **La fin (étape 4)** | « Touchez Dernier devis » | la facture de Costa éclairée, « Vous savez s'il l'a ouverte. », puis Recommencer |

**Les quatre phrases :**

1. Touchez Vos clients. *Vos chantiers, et ce qui attend votre réponse.*
2. Touchez Costa. *Rangés par lettre, avec ce qu'ils vous doivent.*
3. Touchez Factures. *Ses coordonnées, ses devis, ses factures.*
4. Vous savez s'il l'a ouverte. *Utile quand un client dit n'avoir rien reçu.*

La quatrième vient de ta réponse du 9 septembre, écrite dans le code de la
fiche : c'est ce que tu viens vérifier quand un client prétend n'avoir rien
reçu.

## Ce qui n'a pas été touché, et pourquoi

| | Pourquoi |
|---|---|
| Les écrans eux-mêmes | ce sont les vrais écrans de l'appli, figés tels quels |
| L'ouverture (« Cause, d'un devis à votre comptable ») | elle sert toute la visite, pas seulement le début |
| Les 70 étapes suivantes | ta demande s'arrête au client |

## Vérifié ici

- Touché au doigt à 390 × 664 (ton écran), 375 × 667, 430 × 932, 1024 × 768 et
  1280 × 800 : chaque cadre doré mène à l'étape suivante, la cible n'est
  jamais sous la bulle, aucune page ne déborde, aucune erreur.
- Les 79 boutons des quatre écrans touchés un par un : aucun muet (la bulle
  tremble), aucun ne quitte la planche.
- Sur ordinateur, la bulle se rétrécit pour tenir à côté de l'écran de
  l'appli ; à 1024 points (une tablette couchée), elle le recouvrait.
- Contrôles du dépôt : aucun tiret, aucune flèche décorative, une seule barre
  de recherche.

## Corrigé en route

`docs/visite-guidee.md` et `TODO.md` disaient que
`scripts/planche-figee/visite-guidee/tout.sh` refait toute la visite. **Ce
dossier n'a jamais été commité** : refaire la visite demande de réécrire son
parcours. C'est écrit dans les deux fichiers.

## Ce que tu as à trancher

1. **Cette bulle te convient-elle ?** Si oui, elle passe sur les 74 étapes de
   la visite, avec les mêmes règles (le geste en titre, la page qui montre
   ce que dit la phrase).
2. **La quatrième étape** : dans la visite entière, elle ne finit pas : elle
   mène au dernier devis. On garde « Vous savez s'il l'a ouverte. » comme
   étape à regarder, puis « Touchez Dernier devis. » à l'étape suivante ?
