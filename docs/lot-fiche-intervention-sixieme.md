# La fiche d'intervention — la sixième planche, codée

*Lot ouvert le 18 septembre 2026 au soir, CLOS le 20 au matin. Six planches en
une journée ; la sixième codée sur son « tu peux coder exactement cette
planche ».*

*Sa page consultable vit dans `appli/` :
`node scripts/md-en-page.mjs docs/lot-fiche-intervention-sixieme.md appli/lot-fiche-intervention-sixieme.html`.*

---

## Ce qui a été fait, en six lignes

1. **La fiche est celle de la sixième planche**, à l'écran près : carte cernée
   d'or (2 px, vraie bordure), quatre gestes sur une ligne avec leur dessin en
   couleur, « Ma note » en noir sur un papier doré, « Ouvrir le devis sans les
   prix » en noir gras.
2. **Les lignes du devis vivent dans le bandeau « Travaux à faire », fermé** :
   il dit « 4 lignes », « 2 sur 4 faits », « tout est fait » ; on le touche, il
   s'ouvre sur les cases, les photos, « À signaler » et le bouton.
3. **« Envoyer le retour du jour » part toujours** — sans photo, sans tout
   cocher. Ce que vous attendez (Réglages › Équipe) se lit en gris dessous : un
   rappel, plus un verrou.
4. **Un chantier porte plusieurs retours** : un par soir. Le lendemain, la fiche
   repart des cases cochées la veille ; les photos et « À signaler » repartent
   vides. Migration 0096.
5. **Une fois parti** : « Retour du jour envoyé — À retrouver dans Terminés,
   Retour d'intervention ». Sans point.
6. Batterie entière jouée dans un dossier à part, puis fusion sur `main` —
   les chiffres sont en §5.

---

## 1. Vos décisions, une par une

| Vous avez dit | Ce qui est fait | Où |
|---|---|---|
| « garde l'esprit de la page d'avant, juste embellis » | la carte, les gestes, la note, le bouton vert restent ; tout est plus fin | `PlanningClient.tsx`, `FeuilleChantier` |
| « je veux pas de point entre Terminés et Retour d'intervention » | « Terminés, Retour d'intervention » | `TravauxAFaire.tsx` |
| « Fin de chantier, ce qu'il y a à l'intérieur c'est pas ça » | le bandeau s'appelle « Travaux à faire » et compte ce qui est fait | `TravauxAFaire.tsx` |
| « un devis de trois pages, ça va faire trop long » | les lignes sont DANS le bandeau, fermé par défaut | idem |
| « mets un peu de couleur, elle est trop sobre » | vert pour ce qu'on fait (Maps, Waze, Appeler, cocher, envoyer), or pour ce qui se lit (Copier l'adresse, la note) | `Geste`, `TravauxAFaire.tsx` |
| « le contour en doré, celui de l'appli » ; « les bords mal arrondis » | `border: 2px` de `colors.or` — le même que « une journée », mesuré par une suite | `FeuilleChantier` |
| « retire les ronds autour des sigles, garde la couleur » | fait | `Geste` |
| « Ouvrir le PDF fait ton sur ton » ; « Ma note, en noir ? » | les deux en noir | `FeuilleChantier`, `NoteDuChantier` |
| « il faut qu'on puisse l'envoyer même sans photo, un chantier de 8 jours… » | le retour part toujours, et un chantier en porte plusieurs | `retour-actions.ts`, `retours-intervention.ts`, migration 0096 |
| « Ouvrir le devis sans les prix » | le mot, à la même place | `FeuilleChantier`, `mode-emploi.ts` |

## 2. Ce qui a été décidé sans vous, et pourquoi

**Les deux réglages « Demander une preuve » et « Au moins une photo » restent,
mais ne bloquent plus.** Les retirer aurait effacé votre décision du
8 septembre (*« ça sera au patron de décider »*) ; les garder verrouillés
aurait contredit votre planche. Ils écrivent donc sous le bouton ce qui manque
encore, et le retour part quand même. Si vous ne voulez plus les voir, c'est
un mot.

**Un retour ne termine pas le chantier.** Il est à retrouver dans Terminés,
Retour d'intervention — c'est déjà là que la liste vit —, et le chantier reste
au planning tant qu'il n'est pas fini. Vous n'aviez pas répondu à cette
question ; c'est ce que la planche disait, et c'est ce qui est codé.

**« Retour du jour envoyé » puis « 2 retours envoyés ».** Le premier envoi de la
session dit « du jour » ; à partir du second, c'est le compte — comme sur la
planche. En rouvrant la fiche un autre jour : « 1 retour envoyé ».

## 3. Ce que ça défait, et qui était juste avant

- **un seul retour par chantier** (8 septembre) : pensé pour un chantier d'un
  jour, faux pour huit. Le premier retour d'un chantier existant reste tel
  quel ; les suivants s'ajoutent ;
- **la liste s'efface à l'ouverture** (votre proposition A du 9 septembre) :
  plus d'objet, il n'y a plus qu'une liste, dans le bandeau ;
- **le bouton figé après « C'est fini »** (9 septembre) : remplacé par le bloc
  « … retours envoyés », et le bandeau reste ouvrable pour demain.

## 4. La fenêtre à connaître, une seule

Entre le moment où la migration 0096 passe sur votre espace et celui où la
version neuve est servie — le temps de la construction —, l'ancien « C'est
fini » échoue. Rien d'autre. Rallumer l'espace suffit ; rien n'est à refaire.

## 5. Les chiffres

*(remplis à la clôture du lot, après la batterie)*

## 6. Ce qui reste ouvert

- Les colonnes `retour_demande` et `retour_photo_exigee` gardent leur sens
  (rappel). Si vous retirez les deux réglages un jour, elles partiront avec.
