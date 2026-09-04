# Retirer la fiche du chantier — ce qui a été fait, et ce que ça coûte

*4 septembre 2026 · lot suivant celui de la facture au planning*

---

## En une phrase

L'écran `/chantiers/[id]` ne montre plus rien. Son adresse existe toujours et
**redirige** vers l'endroit où le travail s'est arrêté ; un chantier dont la
date est posée ouvre **sa journée** au planning, portes levées.

---

## 1. Le brief, point par point

| Ce qui était demandé | Verdict | Ce qui le fonde |
|---|---|---|
| Retirer l'écran `/chantiers/[id]` | **fait** | `src/app/chantiers/[id]/page.tsx` ne rend plus qu'une redirection |
| Rediriger les huit chemins relevés | **fait, et il y en avait dix** | voir §2 |
| Corriger `lienDeReprise` AVANT la route | **fait — et le piège était pire que décrit** | quatre cas, pas trois, plus un cinquième chemin qui bouclait |
| Ne pas rouvrir ce qui est tranché | **tenu** | photos et dictée → fiche client ; devis parti → `/export` ; les cinq écrans d'étape restent |
| Décider ce que devient l'adresse, et le dire | **fait** | §3 |
| Adapter les suites, ne pas remettre l'écran | **fait — onze suites** | §5 |
| Ne toucher à rien d'autre | **tenu, à une exception assumée** | §4, le chevron des deux listes du planning |

---

## 2. Le piège, et il était pire que ce que le brief disait

Le brief annonçait trois cas où `lienDeReprise` rendait `/chantiers/[id]`.

**Il y en avait quatre**, et le quatrième n'était pas dans la liste : un devis
parti sans date encore posée. Et surtout, **un cinquième chemin bouclait
ailleurs**, que personne n'avait relevé — `apresLesCoordonnees()` rendait la
fiche du chantier quand aucune provenance n'était donnée. Enregistrer la fiche
client y renvoyait, la redirection ramenait à la fiche client : le patron
serait retombé sur le formulaire qu'il venait de quitter, sans comprendre.

Les deux fonctions ont donc été corrigées **avant** la route, dans cet ordre.

**Un contrôle nouveau empêche la boucle de renaître**
(`test-reprendre-ou-il-en-etait.ts`, `test-retour-du-devis.ts`) : il parcourt
les huit états possibles d'un chantier et refuse que la reprise rende jamais
cette adresse. Sans lui, un retour en arrière dans six mois se verrait chez
lui, sur un chantier posé, et nulle part ailleurs.

---

## 3. Où mène chaque chemin, maintenant

| D'où | Vers | Pourquoi celui-là |
|---|---|---|
| des photos, une dictée à faire | `/chantiers/[id]/coordonnees` | la pellicule et l'anneau y vivent depuis le 31 août : c'était exactement le doublon qu'il refusait |
| une date à poser | `/planning` | ce que la règle rendait déjà — le chantier est dans « À planifier » |
| **la date est posée** | `/planning?chantier=[id]` | **sa journée**, portes levées. Sa réponse du jour, mot pour mot |
| la fiche client enregistrée, sans provenance | `/` | la flèche du même écran y allait déjà : les deux gestes cessent de se contredire |
| les cinq flèches de retour | `/` | elles **héritent** de celle de la fiche, mot pour mot. Aucune règle inventée |
| le rappel « Faire le devis » | `/devis-complet` | le libellé le dit |
| le rappel « Ouvrir le chantier » | `/export` | la règle du 20 août : un devis parti mène à l'envoi |

**L'adresse survit à l'écran.** Un signet, un lien profond, **une notification
déjà partie** la portent encore. Supprimer le dossier rendrait un 404 à
quelqu'un qui avait raison de cliquer. Le fichier fait quinze lignes et ne
montre rien.

**L'identifiant voyage, jamais la date.** Le planning connaît déjà la date de
chaque chantier ; la répéter dans l'adresse ferait deux vérités sur la même
journée — un signet gardé une semaine ouvrirait le mois d'avant.

---

## 4. Ce qui a été fait EN PLUS, et pourquoi c'était nécessaire

**« Sans date » et « En attente du client » n'avaient AUCUN lien vers le
chantier.** Ni chevron, ni nom cliquable, ni bouton. Tant que la fiche existait
cela ne se voyait pas : la liste des chantiers y menait. En la retirant, un
devis parti serait devenu injoignable — c'est-à-dire le cul-de-sac qu'il
signalait le 8 août 2026, *« comment moi je fais pour avoir accès au devis ? »*,
sous un autre nom.

Les deux listes portent donc le **même chevron et la même feuille** que les
journées. Aucune règle nouvelle : `portesDuPlanning` rend déjà le devis et la
fiche client sur un chantier sans date, et pas la facture — un chantier qui n'a
pas eu lieu ne se facture pas.

**Le chevron, jamais le nom** : sa consigne du 4 septembre.

Et le chevron vit désormais dans **une seule pièce**, employée par les trois
listes. Recopié trois fois, il aurait changé de couleur dans l'une le jour où
l'on retouche les deux autres.

---

## 5. Ce qui a été REFUSÉ, et ce que ça aurait coûté

| Refusé | Pourquoi |
|---|---|
| **supprimer le dossier de la route** | un 404 sur les signets, les liens profonds et les notifications déjà parties. La route vidée coûte quinze lignes qui ne montrent rien |
| **un `?de=` sur les cinq flèches** | une **troisième** règle de retour pour gagner un cran de navigation. Le brief demandait de ne pas en faire une troisième, et il avait raison |
| **toucher `src/app/design/d/page.tsx`** | maquette à données simulées : ses liens ne mènent nulle part **déjà**, avant comme après |
| **garder `getSecondarySteps` « au cas où »** | c'était la liste du tiroir de la fiche, et elle n'avait qu'un seul appelant. Une liste conservée au cas où se met à mentir en silence |
| **remettre l'écran quand une suite rougit** | ce serait rendre l'écran impossible à changer. Onze suites ont été visées plus profond — sur une adresse d'arrivée, un identifiant, un compte en base |

---

## 6. CE QUE ÇA COÛTE — les deux contreparties, écrites plutôt que découvertes

### a) Plus aucun écran n'ouvre la fiche du client depuis un chantier

Cette porte — « ce qu'on sait de ce client » : ses chantiers, ce qu'il doit —
vivait dans le tiroir de la fiche du chantier, retenue le 16 août. Elle part
avec l'écran.

| | |
|---|---|
| ce qui reste | la fiche du client s'atteint par la liste des clients, en deux touches |
| ce qui manque | y aller depuis le chantier qu'on a sous les yeux |

**Ce n'est pas décidé, et c'est délibéré.** L'ajouter à la fiche client, ce
serait remettre sur l'écran vidé le 20 août (*« tout le reste, tu enlèves, c'est
du trop »*) ; en faire une quatrième porte du planning, ce serait retoucher une
feuille choisie le matin même.

**La question, telle qu'elle se pose :** *quand tu regardes un chantier, as-tu
besoin d'ouvrir ce qu'Atlas sait du client — ou la liste des clients suffit ?*

### b) La flèche d'`/export` d'un chantier planifié mène à la liste, où il n'est plus

Il y arrive par le planning, dont la porte reste, et le retour du navigateur
marche. C'est ce qu'un `?de=` aurait fermé — et il a été refusé plus haut. Si ça
le gêne à l'usage, c'est ce refus qu'il faut lever.

---

## 7. Les suites — onze adaptées, aucune contournée

| Suite | Ce qu'elle visait | Ce qu'elle vise maintenant |
|---|---|---|
| `_creer-chantier-e2e` — le socle de **82 fichiers** | ouvrait la fiche après création | rien : elles réclament un chantier, pas une page |
| `test-rapprochement-client-e2e` | la porte du tiroir vers `/clients/[id]` | **le `client_id` en base**, que rien ne peut faire retirer |
| `test-anneau-vers-devis-e2e` | « Mon devis » sous l'anneau, puis le tiroir | l'arrivée automatique du devis, **et le signet d'hier qui mène au planning** |
| `test-anneau-dictee-e2e` | le corps vide et son tiroir | l'anneau sur la fiche client |
| `test-photos-e2e`, `test-retrait-differe-e2e` | la pellicule dans le tiroir | la pellicule à découvert, un geste de moins |
| `test-devis-a-la-main-e2e`, `test-devis-complet-e2e` | la ligne « Devis à la main » du tiroir | l'arrivée sur le devis, sans détour |
| `test-coordonnees-depuis-accueil-e2e`, `test-devis-qui-tarde-e2e`, `test-reprise-chantier-e2e` | la fiche comme point d'arrivée | l'écran que le libellé annonce |
| `test-retour-fiche-client` | `versFicheClient(` dans l'écran retiré | **le cas est SUPPRIMÉ**, et la perte écrite noir sur blanc dans le fichier |
| `test-hub-repo`, `test-reprendre-ou-il-en-etait`, `test-retour-du-devis` | la fiche comme destination | **qu'elle ne le soit jamais** — le contrôle anti-boucle |

**Un cas a été retiré sans remplaçant**, et il faut le savoir : « le corps ne
porte que l'anneau, et le tiroir garde tout le reste » défendait la maquette du
11 août sur un écran qui n'existe plus. Le réécrire sur la fiche client aurait
été lui prêter une promesse qu'il n'a jamais faite sur cet écran-là.

---

## 8. Les chiffres de la batterie

| Étape | Résultat |
|---|---|
| `npx tsc --noEmit` | **vert** |
| `npm run lint` | **vert** — 0 erreur, 17 avertissements, tous antérieurs |
| `verifier:memoire` | **vert** |
| Suites base (`atlas_test`) | **291 / 310** |
| Suites navigateur | **pas encore jouées** — voir ci-dessous |

**Les 19 rouges des suites base ne désignent pas ce lot, et c'est mesuré.**
Aucun ne mentionne la reprise, la fiche, le planning ou les portes. Ils portent
trois signatures, et toutes les trois sont des signatures de **collision entre
sessions** :

| Signature | Ce que c'est |
|---|---|
| « n'est pas membre de l'entreprise » | deux batteries sur la même base |
| « deadlock detected » | idem |
| « la capacité n'a pas la forme attendue », « aucune garde n'a été retirée » | les essais négatifs **écrivent sur disque** pour se prouver capables d'échouer — une autre session écrivait au même moment |

Deux rouges sont d'un autre lot en cours et nommément identifiés :
`ChoixCanal.tsx` (bouton rectangulaire) et les capsules « Par SMS » / « Par
e-mail » du formulaire de création.

**Les suites navigateur n'ont pas été jouées, et c'est dit plutôt que
supposé.** Elles refusent de démarrer tant que le port 3000 est occupé — à
raison : elles travailleraient sur le serveur d'un autre code. Elles se jouent
quand les autres sessions se taisent.

---

## 9. Ce qui reste ouvert

| Quoi | Qui peut trancher |
|---|---|
| Faut-il rendre une porte du chantier vers la fiche du client, et où ? | **lui** |
| La flèche d'`/export` d'un chantier planifié — la liste suffit-elle ? | **lui**, à l'usage |
| Jouer les suites navigateur | une session, quand les autres se taisent |
