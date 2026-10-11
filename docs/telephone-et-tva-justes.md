# Le téléphone et le n° TVA doivent être justes

7 octobre 2026. Sa capture : « 85 45 » au téléphone et « Fr33 » au n° TVA, et
le devis commençait quand même.

| Point | Verdict | Où |
|---|---|---|
| Téléphone incomplet accepté | **corrigé** : aucune lecture n'existait. `telephoneLu` refuse ce qui n'a pas 10 chiffres commençant par 0 (ou « + » et 8 à 15 chiffres) | `src/lib/numero-telephone.ts` |
| N° TVA « Fr33 » accepté | **corrigé** : la règle acceptait toute forme européenne de 4 signes. Un numéro français exige FR, 2 signes de clé, 9 chiffres | `src/lib/autoliquidation.ts` |
| Les boutons de la fiche | « Je rédige à la main », « Faire la facture », la flèche de retour et le micro refusent tant qu'un numéro est faux ; la phrase rouge dit lequel | `FormulaireNouveauChantier.tsx` |
| Le serveur | les trois actions qui écrivent un téléphone le relisent par la même règle | `chantiers/nouveau`, `chantiers/[id]/coordonnees`, `clients/[id]/coordonnees` |

**Fait autrement que la simple interdiction :** le micro refuse **avant** de
dicter, jamais après. L'arrêt de la dictée enregistre impérativement (sa
demande du 21 août) ; refuser à l'arrivée aurait perdu la note.

**La clé du n° TVA**, les deux chiffres après FR, se calcule désormais sur le
SIREN : tu as choisi la B le 7 octobre (`appli/verifier-la-tva.html`). Une
faute se signale sous la case et le bon numéro se propose, **sans bloquer** :
seule la forme bloque. Les numéros déjà en base ne sont pas relus.

**Et la case porte « FR » d'office.** Laissé seul, il compte comme une case
vide : il ne bloque ni la fiche, ni le devis.
