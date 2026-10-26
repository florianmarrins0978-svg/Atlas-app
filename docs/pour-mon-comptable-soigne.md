# Pour mon comptable, soigné : ce qui est codé, et ce qui a été fait autrement

**Sa demande du 25 octobre 2026 au soir :** *« Ok, dans ce cas, tu peux coder tout ça. N'oublie rien et ne lance pas de batterie. »* « Tout ça », ce sont ses trois planches du même jour :

| Planche | Adresse |
|---|---|
| L'écran Pour mon comptable, le relevé, Mes dossiers (boutons arrondis) | `appli/soignee/termines-comptable.html?forme=arrondi` |
| Le dossier PDF envoyé au comptable | `appli/soignee/comptable-dossier.html` |
| La page où le comptable valide ou rejette | `appli/soignee/comptable-verification.html` |

**État :** codé sur la branche `claude/pour-mon-comptable-soigne`, **pas encore sur `main`**. Le lot est de niveau 3 (une migration, de l'argent) : la batterie se joue avant de pousser, et il a demandé qu'elle ne parte pas ce soir.

---

## 1. Les deux défauts qu'il a signalés

| Son signalement | Verdict | Ce qui a été fait | Le fichier |
|---|---|---|---|
| *« Le dernier ticket, je peux pas le valider : la notification n'apparaît pas, je peux pas verrouiller mon dossier »* | **vrai**, reproduit | La carte d'un virement reçu se règle sur place : la facture d'Atlas qui attend (même payée en partie), une facture faite hors d'Atlas (photo ou PDF), ou l'une de ses cinq réponses (un remboursement, mon argent perso, un prêt, une aide ou une subvention, entre mes comptes). | `src/app/termines/comptable/CarteARegarder.tsx`, `src/server/repositories/banque.ts` (`confirmerLaLigneRecue`) |
| *« Je pouvais valider une facture qui n'était pas du montant »* | **vrai**, lu dans le code | Une pièce d'un autre montant ne se joint plus sans son accord : les deux montants s'affichent, puis « La joindre quand même » ou une autre pièce. L'écart reste écrit sur le relevé, dans le dossier et chez le comptable. | `src/server/repositories/pour-mon-comptable.ts` (`poser`, `refusDEcart`) |

**La racine du premier**, et pourquoi l'accueil ne pouvait rien : l'accueil ne pose une question que sur un virement qu'une facture d'Atlas explique au centime. Un acompte, un remboursement, un virement arrivé hors de la fenêtre des questions n'y apparaissait jamais. Le dossier, lui, le comptait comme « à justifier » : il ne pouvait plus s'arrêter.

**Le contrôle du montant vaut partout où une pièce se joint** : le ticket choisi parmi deux, le ticket photographié depuis sa ligne (vérifié AVANT d'être rangé, sans quoi un refus laissait un achat rangé et une ligne vide), la facture de fournisseur, la facture d'Atlas (contre ce qui reste à payer), la facture faite hors d'Atlas. « Payée en partie » se dit sans alerte : c'est le cas normal d'un acompte.

---

## 2. L'écran, point par point

| Sur la planche | Codé |
|---|---|
| Le point en tête : combien attendent sur une plage rouge, ou « Tout est justifié » en vert, la banque dessous | oui |
| Check up seul bouton plein, collé en bas ; les boutons des cartes cernés | oui |
| Le nom et le montant en grand, ce qui manque en rouge avec son signe | oui |
| Sous chaque mois, ce qui sort en rouge et ce qui entre en vert, une barre plus épaisse | oui |
| « Arrêter mon dossier ici » après les mois, et qui dit d'avance pourquoi il attend | oui |
| Le relevé : les totaux en grand, un point par ligne, un signe par pièce, la pièce qui s'ouvre | oui |
| Le filtre « Sans ticket » renommé « À justifier » | oui |
| Sans banque, Check up disparaît et « Relier ma banque » devient le bouton plein | oui |
| Mes dossiers : l'année avec deux flèches, le bilan sous le nom, trois vrais boutons, le lien sans sa longue adresse | oui |
| Tous les boutons arrondis, comme dans l'application | oui |

---

## 3. Le dossier PDF, point par point

| Sur la planche | Codé |
|---|---|
| La date d'une ligne n'est plus barrée par le trait du dessus | oui |
| La case de la pièce prend sa hauteur : plus de grands blancs | oui |
| Chaque mois commence sa page | oui |
| Une première page qui dit tout de suite que chaque ligne est justifiée, puis les chiffres, les mois, et les dépenses par catégorie avec leur part | oui |
| Des titres de colonnes : Date, Ligne de banque, Montant, Justificatif | oui |
| La couleur de la catégorie en point devant son nom | oui |
| « Voir la facture », « Voir la photo », et chaque photo du bout porte sa ligne de banque | oui |
| Les tickets perdus après le dernier mois, avec leur total | oui, sous le dernier mois quand ils y tiennent, comme sur la planche |
| La facture faite hors d'Atlas posée au bout, avec son lien aller et retour ; l'écart écrit sous la pièce | oui |

---

## 4. La page du comptable, point par point

| Sur la planche | Codé |
|---|---|
| Un seul tableau : les montants tombent l'un sous l'autre, alignés à droite | oui, mesuré à 1 280, 1 100, 1 024 et 390 de large |
| Sur un téléphone, chaque ligne garde sa date ; Valider, Rejeter, Suivant collés en bas quand la pièce est ouverte | oui, mesuré sur 390 × 664 et 360 × 640 |
| Sur un ordinateur, Rejeter ne tombe plus sous l'écran quand il écrit sa raison | oui |
| « Reconstitué par Atlas » et « Photo d'origine » écrits en onglets | oui (« Facture d'origine » pour un PDF) |
| Chaque mois dit où il en est, le haut compte tout le dossier | oui |
| Une ligne validée teintée de vert, une rejetée de rouge avec sa raison dessous | oui |
| Des icônes dessinées au lieu des caractères ✓ et ✕ | oui, les mêmes que l'écran du patron |
| La facture faite hors d'Atlas, et l'écart montré AVANT qu'il valide | oui |

---

## 5. Ce qui a été fait autrement, et pourquoi

- **La phrase d'un écart est plus courte que sur la planche.** La planche écrivait *« Elle attend 1 728,00 € : ce virement en paie une partie, il restera 864,00 € »* sous un encart qui montrait déjà les deux montants. L'écran dit *« Ce virement en paie une partie, il restera 864,00 € »* : le montant ne se répète pas (`CLAUDE.md` §3, le moins de mots).
- **Sans banque mais avec des lignes déjà lues**, l'écran garde le point et le Check up, et la ligne de la banque dit « Aucune banque reliée » avec « Relier ma banque ». La planche ne montrait le cas sans banque que sans aucune ligne ; dans l'autre cas, le Check up a encore des tickets à relier, et son bilan doit pouvoir s'écrire.
- **Une facture d'Atlas émise APRÈS le virement n'est pas proposée** dans la carte : le règlement serait refusé (*« ce règlement est daté d'avant la facture »*). La proposer serait proposer un refus.
- **Chez le comptable, la date reste « 02/10 »**, comme aujourd'hui, au lieu de « 2 oct. » sur la planche : la ligne est plus étroite, et une troisième façon d'abréger les mois s'ajoutait aux deux qui existent.
- **Chez le comptable, une facture d'Atlas payée en partie montre son vrai total** : la page affichait le montant du virement à la place, ce qui était faux dès qu'il ne payait qu'une partie.
- **La facture faite hors d'Atlas a son propre lecteur**, qui ne rend que le total et le numéro. Le lecteur des factures de fournisseurs lisait des lignes d'articles d'un fournisseur qui écrit à l'artisan : pas la même pièce. Sans clé ou sans total lisible, l'écran le fait taper.

## 6. Trouvé en route, et refermé

**La contrainte de cohérence de la migration 0143 ne refusait rien sur une ligne « à justifier ».** Elle finissait par « la justification est l'une de celles-ci », ce qui vaut *inconnu* quand la justification est vide ; et une contrainte qui vaut inconnu passe. Une ligne à justifier qui portait un ticket ou un motif entrait donc sans refus. L'épreuve de 0150 sur une base habitée l'a montré dès son premier jet (`scripts/test-migration-0150-base-habitee.ts`).

0150 la referme, **sans risquer sa base** : la nouvelle règle est posée pour toute écriture nouvelle, sans juger les lignes d'hier. Une ligne ancienne qui ne la tiendrait pas ne peut donc pas bloquer la migration, comme 0087 l'avait fait le 13 septembre. Elle se validera une fois sa base regardée.

## 7. Ce qui a été éprouvé, sans batterie

| Suite | Résultat |
|---|---|
| Règles pures (`test-pour-mon-comptable.ts`) | 43 sur 43 |
| Lecture d'une facture hors d'Atlas (`test-facture-hors-atlas-lue.ts`) | 4 sur 4 |
| Le dossier PDF (`test-dossier-comptable-pdf.ts`) | 17 sur 17 |
| Base : pour mon comptable, banque, dossiers, vérification, mouvements, achats | 26, 12, 13, 12, 8, 16 : tout vert |
| 0150 sur une base habitée (`test-migration-0150-base-habitee.ts`) | vert, après avoir rougi sur le trou de 0143 |
| Navigateur : pour mon comptable (dont le virement reçu réglé dans sa carte et l'écart montré avant de joindre) | 11 sur 11 |
| Navigateur : la page du comptable | 14 sur 14 (8 sur 14 contre l'ancienne page : les six règles nouvelles savent rougir) |
| Navigateur : la photo du Check up | 4 sur 4 |
| Navigateur : les pages publiques, sans la barre d'Atlas | vert |
| Navigateur : Mes dossiers | 6 sur 7, voir ci-dessous |
| Garde-fous : couches, code mort, tirets, flèches, pansements, chartes lisibles | tous verts |

**Le rouge de Mes dossiers ne vient pas du lot** : sur ce poste, le navigateur des suites nomme « download » tout fichier tiré d'un blob, quel que soit le nom posé. Éprouvé sur une page nue, sans une ligne d'Atlas.

**Le chemin entier a été joué** dans un vrai navigateur : une facture photographiée depuis la carte d'un virement reçu, son total tapé (aucune clé d'IA ici), l'écart montré, jointe quand même, le dossier arrêté, son PDF ouvert avec la facture posée au bout.

**Les écrans ont été regardés**, état par état, à la largeur de son téléphone : deux défauts en sont sortis et sont corrigés (les titres de rubrique en serif, un « ? » seul à la ligne).

## 8. Ce qui reste ouvert

| Point | Qui |
|---|---|
| La batterie, puis `main` | à lancer quand il le dit |
| La lecture du total d'une facture faite hors d'Atlas, avec la vraie clé | à essayer sur son espace |
| Valider la règle de cohérence sur sa base, une fois regardée | une session, plus tard |
| Une entrée rejetée par le comptable alors qu'elle était réglée par une facture d'Atlas : sa carte ne propose que les réponses | à trancher s'il le rencontre |
