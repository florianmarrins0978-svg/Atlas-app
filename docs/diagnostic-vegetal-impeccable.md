# Diagnostic végétal — rendre l'outil impeccable

*Document de retour du lot ouvert le 11 septembre 2026. Il se tient à jour
jusqu'à la clôture ; ce qui est écrit ici prime sur tout récapitulatif de
conversation.*

## Ce qui a été vérifié avant d'écrire une ligne

| | Verdict | Où |
|---|---|---|
| L'écran est dans Paysage | **Oui, déjà fait** — rien redéplacé | `src/app/paysage/page.tsx:81`, `src/app/paysage/diagnostic/` |
| Le modèle n'a aucun champ pour nommer un problème | **Tient** | `src/server/diagnostic/observation.ts:100-115` |
| Le vocabulaire est injecté, pas recopié | **Tient** | `observation.ts:136-142` |
| Tout texte affiché sort d'une fiche ou d'une liste fermée | **Trois brèches**, ci-dessous | `src/app/paysage/diagnostic/[id]/page.tsx` |
| Une seule relance, à trois endroits | **Tient** | `diagnostic-vegetal.ts:703`, CHECK 0056, écran |
| Aucun pourcentage | **Tient** | `LIBELLE_CONFIANCE`, millièmes en base |
| EXIF retiré avant tout, fichier non nettoyé refusé | **Tient** | `actions.ts:74-98`, `photo-entrante.ts` |
| Fixtures tenues à l'écart | **Tient** — pas touchées | trois barrières, 0056 |

## Les trois choses les moins compréhensibles pour quelqu'un qui n'aime pas les téléphones

1. **Tout refus finit par la même phrase** — *« Une photo plus proche, ou
   prise sous un autre angle, peut suffire »* (`[id]/page.tsx:305`), y compris
   sous *« aucune autre photo ne permettrait de les départager »*. Il
   reprendra trois photos pour rien. Et l'écran ne dit jamais ce qui a été vu.
2. **« Personne n'a regardé » n'offre qu'un geste : « Nouvelle photo »**
   (`[id]/page.tsx:77`), juste sous *« ce n'est pas la photo qui est en
   cause »*. Rien vers Réglages › IA ; la photo rangée ne peut pas être
   réessayée.
3. **Du jargon en première ligne** — *« CONFIANCE INCERTAINE »* en capitales
   dorées (`[id]/page.tsx:121`) ; titres doublés (« Sans conclusion » deux
   fois, `:59` et `:297`) ; et l'essence lue — la règle la plus structurante
   du moteur — n'apparaît nulle part.

## Les trois endroits où l'écran affiche ce qu'aucune source ne fonde

| | Où | Le défaut | La racine |
|---|---|---|---|
| 1 | `[id]/page.tsx:305` | La phrase « une photo plus proche peut suffire », inventée par l'écran, fausse pour 4 refus sur 7 | La base range la **phrase** du refus, pas sa **clé** (`repositories/diagnostics.ts:171`) : l'écran ne sait pas quel refus il affiche |
| 2 | `[id]/page.tsx:300` | `phrase ?? "Je ne peux pas confirmer…"` — un verdict par défaut sur une colonne nulle (la ligne exacte du tableau `CLAUDE.md` §4 quater) | La même |
| 3 | `actions.ts:236` | *« Réessayez dans un instant »* — une promesse sans geste : seul « Nouvelle photo » existe | Aucune reprise sur les photos rangées |

Et le commentaire de `schema.ts:2705` — *« vient d'une liste fermée du
code »* — est faux pour `echoue` : c'est le texte du fournisseur.

## Ce que la documentation promettait et que le code ne fait pas

| La doc dit | Le code fait | Sortie |
|---|---|---|
| 0057 : `informations_requises` « affiché quand Atlas refuse de conclure » | affiché seulement dans le résultat rendu (`[id]/page.tsx:154`) ; sur un refus, aucune fiche n'est retenue | la promesse est intenable telle quelle — à réécrire dans 0057, pas à forcer dans l'écran |
| 0057 : `facteurs_favorisants` « s'affiche » | jamais rendu ; `criteresDiscriminants` et `criteresExclusion` non plus (`moteur.ts:223-239`) | à afficher dans les détails, ou à retirer de `ResultatFige` |
| §135.10 : « aucune fiche réelle » | trois | **déjà redressé sur `origin/claude/modest-mendel-2vpvtz`** (commit `a0bd5205`) — non touché ici pour ne pas produire deux versions à la fusion |

## Tranché par lui, le 11 septembre 2026

**Le coude à coude après la relance REFUSE.** `arbitrer` concluait
« incertaine » sur la première dès qu'elle valait 0,5 — le seul chemin où un
nom sortait malgré un concurrent égal, et sans qu'aucune photo de confusion
ait été posée (la relance unique peut avoir servi à l'essence). Ses mots :
*« en cas de doute, bloquer »*, et le coût n'est pas symétrique — une photo de
plus contre un traitement appliqué pour rien.

**Codé** : `src/lib/diagnostic-vegetal.ts` (la branche a disparu, elle n'a pas
été recouverte), `scripts/test-diagnostic-vegetal.ts` (le cas retourné, plus
un témoin qui garde la conclusion sur un écart net), `ARCHITECTURE.md` §135.5.

## La planche

`appli/diagnostic-le-refus-est-l-ecran.html`, liée depuis `appli/essais.html`.
Les quatre issues, Aujourd'hui / Proposé, Origine / Nuit ; les sept refus un
par un ; le nom de l'outil en trois options. Textes recopiés de
`donnees/phyto/fiches/002-anthracnose-platane.json`, photo de la fiche
(domaine public). **Rien n'est codé dans `src/` pour les écrans** tant qu'il
n'a pas choisi.

Ce qu'elle propose, et ce que ça coûte :

| Issue | Proposé | Ce que ça demande |
|---|---|---|
| Sans conclusion | vu · pourquoi · le geste, propres à chaque refus ; « Atlas connaît N problèmes » quand aucune fiche ne correspond | une **migration** : `motif_refus` range la clé (CHECK sur la liste fermée), le texte du fournisseur va dans sa colonne, les lignes existantes sont converties ; les libellés du vocabulaire en français vivent dans `lib` |
| Personne n'a regardé | « La photo n'a pas été regardée. Elle est gardée. » — Réessayer, Réglages de l'IA | une action de reprise sur les photos rangées |
| Résultat | « Probable · sur un platane » à la place de « CONFIANCE PROBABLE » ; source et date sur l'écran principal ; plus de liseré | `LIBELLE_CONFIANCE` change ; le nom commun du taxon se lit dans `taxons` |
| Une photo de plus | le titre une fois ; « Vu » au-dessus de la consigne | rien de plus |

## Ce qui reste ouvert, et qui le tranche

| | Qui |
|---|---|
| La planche : Proposé, oui ou non — et le nom | **lui** |
| La licence INRAE (Ephytia) — le courriel est prêt depuis le 20 août (`docs/courriel-inrae.md`), personne ne sait ici s'il est parti. Réponse complète : `docs/QUESTIONS.md` §24 | **lui** |
| L'appel réel de vision sur une vraie photo — jamais joué ; `VISION_PROVIDER` retombe sur le fournisseur de rédaction, sa clé Anthropic suffit | **lui**, sur son banc, une capture |
| Combien de photos réelles échouent à l'identification de l'essence — la première chose à mesurer le jour où la clé tourne | **lui**, sur son banc |
| Les seuils (0,35 · 0,15 · plafonds) — un point de départ nommé, pas mesuré ; ne bougent pas au jugé | de vraies photos, de vraies fiches |
| La durée de conservation des photos, et ce que le fournisseur garde ; le fournisseur de vision est **déjà** au registre RGPD (`docs/RGPD.md`, ligne « Vision »), `TODO.md` est en retard là-dessus | **lui** |

## La batterie

*Pas encore jouée sur ce lot — les chiffres viendront ici.*
