# La fiche du jour, sans un bouton — 19 septembre 2026

**Ta planche :** `appli/planning-tout-ensemble-en-mieux.html`, et ton oui du
19 au matin : *« enlève le Annuler à côté de Journée, ensuite c'est bon tu
peux coder »*.

**C'est codé, à la lettre.** Une seule règle sur la fiche du jour : noir un
fait, or un geste, gris le reste. Plus une pastille, plus un cadre, plus un
aplat.

---

## Point par point

| Ce que la planche montrait | Dans l'application | Où |
|---|---|---|
| « + Salarié absent ? » en or, au milieu, avec le « + » | fait | `GesteAbsence` |
| les prénoms en or sur une ligne, « · annuler » sur celui qui manque | fait | `PasLaCeJour` |
| « Absent · Julien · journée » et la **croix noire** à droite qui supprime | fait | `PasLaCeJour`, repère `retirer-absence` |
| Matin · Après-midi · Journée en mots, le retenu souligné d'or, **sans Annuler** | fait | `BasculeDuMoment` |
| Matin / Après-midi **comme aujourd'hui** : la pastille et le mot en capitales | inchangé | — |
| « + Salarié » en or à la place de « Qui ? » ; les prénoms en noir avec un « + » en or | fait | `PastilleEquipe` |
| toucher « + Salarié » : les prénoms en mots, le retenu souligné, « Fermer » à droite | fait | `MotAChoisir`, `Choisir mots` |
| « Déplacer  Retirer » en bas à droite, **sous l'après-midi, au-dessus d'Ajouter** | fait | `CarteDuJour`, `libresApres` |
| « Ajouter » en or, qui devient « Fermer » ; les trois voies en mots | fait | `GesteAjouter`, `VoieDAjout` |
| « **Client en attente** » derrière Ajouter | fait | `AjoutAuJour` |
| dans le tiroir, **le nom seul pose** le client, la durée en gris à droite | fait | `TiroirDuBas`, `data-poser` sur le nom |
| « Mr. Linotte est sur jeudi 17 septembre · Annuler » après la pose | fait | `TiroirDuBas`, repère `pose-a-defaire` |

## Ce que le lot enlève, et que tu sais

- le bouton « Poser » et le chevron « › » de la liste « Sans date » : le nom
  pose, et le chantier s'ouvre depuis l'onglet Chantiers (ta réponse du 17) ;
- la pastille « Annuler » sous les trois voies (ta réponse C du 17) ;
- l'« Annuler » à côté de Journée (ta réponse du 19) : la croix suffit.

## Ce qui n'a PAS été touché, parce que la planche ne le montrait pas

- la liste des chantiers en attente qui s'ouvre derrière « Client en attente »
  (des petites capsules, avec « Annuler ») ;
- les deux formulaires « Un client » et « Autre chose » ;
- « Déplacer » : le bandeau « Touchez le jour au-dessus · Annuler », tel que tu
  l'as réglé le 17.

Dis-le si tu les veux dans la même grammaire.

## Trois contrôles ont été adaptés, et pourquoi ce n'est pas de la triche

| Suite | Ce qu'elle réclamait | Ce qu'elle défend désormais |
|---|---|---|
| `test-planning-e2e` | le mot « Qui ? » | « + Salarié » — ton choix du 18 |
| `test-planning-e2e` | des bords hauts alignés sur la ligne Matin | des **centres** alignés : un mot de 44 px à côté d'une pastille de 11 n'est pas un repli |
| `test-bloquer-sans-devis-e2e`, `test-planning-e2e` | une pastille « Annuler » sous les voies | « Ajouter » devenu « Fermer » referme — ta réponse C |

**Et un rouge qui n'était pas à moi, corrigé quand même :**
`test-poser-une-date-e2e` rougissait **tous les vendredis** — son jour
d'accueil tombait sur le lundi que le chantier occupe déjà, et le serveur
refusait à raison. Il compte désormais en jours ouvrables.

## Les chiffres

Batterie complète jouée le 18 septembre 2026 au soir, dans le dossier du lot (`npm run verifier:avant-livraison`), puis les rouges rejoués seuls (`verifier-ce-qui-a-bouge`) et comparés à `main` (`verifier-rouge-prealable`).

| Étape | Résultat |
|---|---|
| Types, lint, mémoire du dépôt, construction, données de démonstration | verts |
| Suites base | 382/395, puis 381/395 au rejeu |
| Suites navigateur | 154/162 ; au rejeu des 8 rouges, 3 redeviennent vertes (anneau-vers-devis, pages-publiques-sans-navigation, tva-au-paiement) |
| Connexion derrière un proxy | rouge une fois (page restée sur « Chargement… »), verte au rejeu |
| Les 9 suites du planning | vertes, en batterie et jouées seules |

**Aucun rouge ne touche le planning.** Les quatorze rouges base sont les suites d'outillage qui rougissent déjà sur `main` sur ce poste Windows (verrou de construction, port du banc, ouverture de session, seed, version exécutée…) plus `test-reception-facture-db` ; les cinq rouges navigateur qui restaient en batterie (bandeau-banc, ia-03, ia-04, ligne-du-client, reprise-chantier) ouvrent des écrans que ce lot ne modifie pas, et **redeviennent tous verts joués seuls**, sur le lot comme sur une copie propre de `main` : des suites sensibles à la charge, pas un défaut du lot. Chaque rouge a été rejoué sur la base de `main` elle seule : même sort des deux côtés.

## Ce qui reste ouvert, et qui est à toi

- les trois endroits ci-dessus qui gardent l'ancienne forme ;
- « Un client » et « Autre chose » : la planche ne les a pas dessinés.
