# Les points au milieu des phrases — où ils sont, tous

Sa demande du 22 septembre 2026 : *« Va me chercher tous les · qui servent à
rien dans l'application comme le 6 à facturer · 19 facturés. Montre-les moi. »*

Elle suit sa règle du même jour, devant « Probable · Peuplier » : *« Plus jamais
tu mets de point entre le nom et probable ! Retiens pour les autres fiches, et
plus jamais de tiret, fais des phrases normales. »*

**Ce qui suit est un relevé, pas une correction.** Rien n'a été touché.

---

## Ce que le relevé couvre

Tout `·` écrit dans `src/`, commentaires du code retirés : **123 lignes de
code, 149 points**. Ils se répartissent ainsi.

| | Lignes |
|---|---|
| **des écrans qu'il ouvre**, et des documents que ses clients reçoivent | **72** |
| les conditions générales, où le `·` sert de **puce de liste** | 42 |
| hors produit — pages `/design`, fournisseur d'IA de développement, consigne envoyée au modèle | 6 |
| faux positifs : du code qui **retire** des points, jamais qui en pose | 3 |

---

## 1. Ce qu'il voit tous les jours

| L'écran | Ce qui s'affiche | Où c'est écrit |
|---|---|---|
| **Terminés**, en tête de mois | `6 à facturer · 19 facturés` | `src/app/termines/ListeTermines.tsx:312` |
| **Terminés**, chaque ligne | `12 août · 1 250 € prévus` | `src/lib/termines-par-mois.ts:341` |
| **Terminés**, une ligne facturée | `Facturé le 20 août · F-2026-019` | `src/lib/termines-par-mois.ts:349` |
| **Chantiers**, sous chaque nom | `BROUILLON · SANS PHOTO`, `À VÉRIFIER · 6 PHOTOS`, `CORRECTION DEMANDÉE · 9 PHOTOS` | `src/lib/chantier-etat.ts:169` |
| **Chantiers**, un devis parti | `Devis envoyé · à relancer`, `Devis envoyé · sans réponse` | `src/lib/chantier-etat.ts:150` |
| **Chantiers**, la pile d'alertes | `Devis en attente · 5 jours` | `src/app/Notifications.tsx:342` |
| **Clients**, chaque ligne | `44300 Nantes · Devis 5 sept.` | `src/app/clients/ListeClients.tsx:409` |
| **Fiche client** | `DERNIÈRE PRESTATION · 12 août` | `src/app/clients/[id]/page.tsx:186` |
| **Fiche client**, feuille d'une pièce | `Devis · n° 12` | `src/app/clients/[id]/PieceDuDossier.tsx:181` |
| **Planning**, un jour | `2 chantiers · complet`, `3 chantiers · 120 % de vos équipes` | `src/lib/planning-jour.ts:168,169,187,188` |
| **Planning**, une demi-journée à prendre | `Jardin Martin · ½` | `src/app/planning/PlanningClient.tsx:2828` |
| **Planning**, le client retenu | `06 12 34 56 78 · 12 rue des Lilas` | `src/app/planning/PlanningClient.tsx:3151` |
| **Planning**, une absence posée | `Paul · annuler` | `src/app/planning/PlanningClient.tsx:3516` |
| **Planning**, la poignée de la liste | `2 sans date · 1 en attente du client` | `src/app/planning/PlanningClient.tsx:4906` |
| **Planning**, une équipe | `matin · 2 j` | `src/lib/disponibilites.ts:833` |
| **Nouveau chantier**, choix du client | `Nantes · 3 chantiers` | `src/app/chantiers/nouveau/FormulaireNouveauChantier.tsx:1677, 1728` |
| **Export d'une journée** | `Paul · Julien`, `2 chantiers · complet` | `src/app/chantiers/[id]/export/JourneeRegardee.tsx:107,280,281` |
| **Travaux supplémentaires** | ` · devis 12` | `.../travaux-supplementaires/TravauxSupplementairesClient.tsx:419` |
| **Catalogue**, mes mots | ` · vous` | `src/app/catalogue/MesMots.tsx:152` |
| **L'assistant**, ce qu'il propose | `Créer le devis : Taille de haie · Évacuation` | `src/lib/decrire-proposition.ts:157` |

## 2. L'argent — TVA, règlements, factures

| L'écran | Ce qui s'affiche | Où c'est écrit |
|---|---|---|
| **Ma TVA**, une ligne | `Facture n° F-2026-019 · émise le 12 août` | `src/app/termines/tva/page.tsx:292` |
| **Ma TVA**, ce qui est rentré | `Martin · 1 250 € est rentrée au relevé.` | `src/app/termines/tva/EnAttenteDePaiement.tsx:152` |
| **Ma TVA**, en attente | `F-2026-019 · émise le 12 août` | `src/app/termines/tva/EnAttenteDePaiement.tsx:185` |
| **Alerte ancien IBAN** | `F-2026-019 · émise le 12 août` | `src/components/atlas/AlerteAncienIban.tsx:134` |
| **Grille des prix** | `2 à 4 m de haut · tronc de ⌀ 20 cm` | `src/lib/grille-prix.ts:441, 481` |
| **Réglages**, l'abonnement | un tiret est **remplacé** par un point : `.replace(" — ", " · ")` | `src/lib/abonnements.ts:393` |
| **Réglages**, l'abonnement | les comptes joints par ` · ` | `src/lib/abonnements.ts:420` |

## 3. Paysage — diagnostic, fiches, arrosage

| L'écran | Ce qui s'affiche | Où c'est écrit |
|---|---|---|
| **Diagnostic** — *celui qu'il a signalé* | `Probable · Peuplier` | `src/app/paysage/diagnostic/[id]/page.tsx:169` |
| **Diagnostic**, la source | `INRAE · consultée le 3 septembre` | `.../diagnostic/[id]/page.tsx:229, 531` |
| **Diagnostic**, une photo | `Photo de X · CC BY-SA` | `.../diagnostic/[id]/page.tsx:288` |
| **Diagnostic**, les sources | ` · à jour au 3 septembre` | `.../diagnostic/[id]/page.tsx:538` |
| **Diagnostic**, le détail | couleurs jointes par ` · ` | `src/lib/diagnostic-vegetal.ts:1120` |
| **Fiches de passage** | `12 août · matin · Paul` | `src/app/paysage/fiche/LignePassage.tsx:58` (deux points) |
| **Fiche de chantier** | ` · absent` | `src/app/paysage/fiche/[id]/FicheChantierClient.tsx:564` |
| **Composer ma fiche** | libellés joints par ` · ` | `src/app/paysage/fiche/composer/ComposerMaFiche.tsx:186` |
| **Fiches de sécurité** | `Signée par Paul · gardée jusqu'au 12 août 2031 · transmise` | `src/app/paysage/fiches-securite/ListeDesFiches.tsx:102` |
| **Retours d'intervention** | `Posé par Paul · 3 photos` | `src/app/termines/retours/ListeDesRetours.tsx:277` |
| **Arrosage**, le plan | `Le plan · 64 ml de tranchée` | `src/app/paysage/arrosage/PlanDessine.tsx:47` |
| **Arrosage**, la légende | `plein : la ligne continue · té taraudé 25×3/4″×25` | `src/app/paysage/arrosage/PlanDessine.tsx:270, 274, 280` |
| **Arrosage**, chaque réseau | `9 arroseurs · 8 tés · 1 coude · 76 ml Ø25 · 18 ml Ø16` | `src/app/paysage/arrosage/ArrosageClient.tsx:485, 487, 488, 489` |
| **Arrosage**, la source | ` · 1,76 m³/h au compteur` | `src/app/paysage/arrosage/ArrosageClient.tsx:382, 436, 480` |
| **Arrosage**, les réserves | réserves jointes par ` · ` | `src/lib/arrosage/mesure-debit.ts:219, 234` |
| **Arrosage**, les pièces | `par réseau : … · …` | `src/lib/arrosage/pieces.ts:98, 114` |

## 4. Ce qui part chez ses CLIENTS

C'est le plus gênant : ici le point n'est pas sur son écran, il est sur un
document qui sort de chez lui.

| Le document | Ce qui s'imprime | Où c'est écrit |
|---|---|---|
| **PDF fiche de chantier** | `Matin · 2 demi-journées · équipe Nord` | `src/server/pdf/fiche-chantier-pdf.ts:101` |
| **PDF fiche de chantier** | `MATÉRIEL EMPLOYÉ : taille-haie · souffleur` | `src/server/pdf/fiche-chantier-pdf.ts:149` |
| **PDF fiche de sécurité** | `15 SAMU · 18 Pompiers · 112 Urgences` | `src/server/pdf/fiche-securite-pdf.ts:319` |
| **Rapport d'entretien** (page du client) | `12 août · Martin` | `src/app/entretien/[jeton]/page.tsx:84` |
| **Aperçu du devis**, Réglages | `Adresse · SIRET · téléphone`, `ÉMETTEUR · CLIENT` | `src/app/reglages/documents/pieces.tsx:273, 278` |
| **Allure du devis** | `Sobre · par défaut` | `src/app/reglages/documents/allure/AllureClient.tsx:359` |
| **Devis lu par l'IA**, réserves | réserves jointes par ` · ` | `src/server/ai/services/lire-allure-devis.ts:174` |

## 5. Technique — il les voit, mais ce ne sont pas des phrases

| Où | Ce qui s'affiche | Où c'est écrit |
|---|---|---|
| **Réglages**, version servie | `22/09/2026 14:02 · f05dfb9` | `src/server/version-executee.ts:100, 106` |
| Fiche de l'espace, retard de la base | `en retard de 2 · le code est en retard de 1` | `src/lib/retard-de-la-base.ts:84` |
| Fiches phytosanitaires, compte | `128 fiches · 2026-09-01` | `src/server/repositories/fiches-phyto.ts:283` |

## 6. Ce qui n'est PAS à toucher

| | Pourquoi |
|---|---|
| **Conditions générales** — 42 lignes, `src/server/documents-legaux/versions.ts` | ce sont des **puces de liste** et des séparateurs de tableau, pas des séparateurs de phrase. Les toucher change un document juridique **déjà publié et accepté** : cela demande une nouvelle version et une nouvelle acceptation par chaque compte |
| `/design/a`, `/design/b` | pages de démonstration, hors produit (`src/app/design/a/page.tsx:45,55`, `b/page.tsx:82`) |
| `src/server/ai/providers/llm/dev.ts:879, 890` | fournisseur d'IA **de développement** : personne ne lit ça |
| `src/server/ai/services/discuter-plan.ts:92` | c'est une consigne envoyée au modèle, pas un écran |
| `commune-adresse.ts:130`, `libelle-client.ts:496`, `correspondance-prestation.ts:71` | ces trois-là **retirent** des points d'une saisie. Ils sont du bon côté |

---

## Ce qui a été vérifié, et ce qui ne l'a pas été

| | |
|---|---|
| **regardé à l'écran**, ici, connecté sur le jeu de démonstration | l'accueil : `BROUILLON · SANS PHOTO`, `À VÉRIFIER · 6 PHOTOS`, `VÉRIFIÉ · 3 PHOTOS`, `CORRECTION DEMANDÉE · 9 PHOTOS` sont bien peints |
| **pas vérifiable ICI** | Terminés, Ma TVA, le diagnostic et l'arrosage : le jeu de démonstration n'a ni chantier terminé, ni facture, ni photo de croquis. Ce qui est écrit ci-dessus vient du code, pas d'une capture |

## Le tiret, sa deuxième règle du jour

*« Plus jamais de tiret, fais des phrases normales. »* Ce relevé ne porte que
sur les points. Les `—` affichés à l'écran n'ont pas été comptés — c'est un
deuxième relevé, à faire s'il le demande.
