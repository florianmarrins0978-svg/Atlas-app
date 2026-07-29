# Atlas — Système de design

Direction artistique validée le 27/07/2026. Ce document est la référence pour tout nouvel écran. On ne remet plus en question l'identité visuelle elle-même — seule l'expérience (parcours, hiérarchie, densité d'information) se construit écran par écran à partir d'ici.

Source des jetons : `src/lib/design-tokens.ts`. Composants partagés : `src/components/atlas/`.

## Palette (une seule couleur d'accent)

| Rôle | Valeur | Usage |
|---|---|---|
| Fond de page | `#F6F1E6` | derrière tout écran |
| Fond de carte | `#FBF8F3` | cartes, lignes de liste |
| Texte principal | `#1C1B17` | titres, contenu |
| Texte secondaire | `#6B6656` | meta, sous-titres |
| **Accent (unique)** | `#B25A2E` | bouton principal, labels de statut, icônes actives, navigation active |
| Fond teinté accent | `#F1DECB` | avatars d'icône |
| Séparateurs | `#E7E0D0` | bordures fines |

Aucune autre couleur n'est introduite. Le statut ne se distingue jamais par une couleur différente — toujours par une icône, jamais par plusieurs teintes.

## Typographie

- **Serif** (`ui-serif, Georgia`) — réservé au nom du chantier et aux titres de page. C'est l'élément qui capte le regard en premier.
- **Sans** (`ui-sans-serif, system-ui`) — tout le reste : meta, boutons, navigation, corps de texte.
- **Petites capitales** (11px, `tracking-[0.12em]`, couleur accent) — pour tout libellé de statut ou eyebrow. Jamais de pastille colorée pleine.

Les tailles de texte sont fixes et ne se réinventent pas d'un écran à l'autre : 36px pour un titre de page, 20-22px pour un titre de carte, 14px pour le texte courant, 11px pour les libellés.

## Composants

- **Bouton principal** (`PrimaryButton`) : pleine largeur, fond accent plein, coins arrondis 16px, toujours à la même position dans la page (juste sous l'en-tête). Un seul bouton principal par écran.
- **Icône de statut** (`StatusIcon`) : avatar circulaire 44px, fond teinté, icône fine (trait 1.8px). Le statut se lit à l'icône, pas à la couleur.
- **Carte** : coins arrondis 22px, ombre presque invisible (`0 1px 2px + 0 6px 18px`, opacité ≤4%), jamais de bordure visible.
- **Navigation basse** (`AtlasBottomNav`) : identique sur tous les écrans qui la comportent, 3 onglets, icône + libellé, accent = actif.
- **Chevron** : seule affordance de navigation vers l'intérieur d'une carte — gris discret, jamais coloré.

## Feuilles de confirmation — deux patrons, une seule coquille

Toute feuille de confirmation utilise la coquille partagée `BottomSheet` (`src/components/atlas/BottomSheet.tsx` : fond, feuille arrondie 26px, poignée). Le contenu et la hiérarchie des boutons changent selon l'intention de l'action.

### Patron n°1 — Confirmation d'action destructive

Utilisé pour : supprimer une photo, remplacer une note vocale, toute future suppression de contenu difficile à recréer.

Objectif : protéger l'utilisateur contre une perte de données.

Hiérarchie :
- **Annuler** = bouton principal (poids fort, fond `card`)
- **Action destructive** = action secondaire, simple texte `colors.alert`

### Patron n°2 — Confirmation d'action positive

Utilisé pour : envoyer un devis, valider une opération importante, lancer une action métier volontaire.

Objectif : accompagner l'utilisateur dans une action qu'il a déjà choisi d'effectuer.

Hiérarchie (inversée par rapport au patron n°1) :
- **Action principale** = bouton principal (poids fort, fond `rust` plein, texte blanc)
- **Annuler** = action secondaire, simple texte discret

Règle de décision : si la feuille protège contre une perte → patron n°1. Si la feuille confirme une action déjà voulue par l'utilisateur → patron n°2.

`BottomSheet` est le composant unique pour toute feuille modale de l'application — les feuilles inline encore présentes sur Photos et Note vocale seront migrées dessus lors d'une phase de refactorisation dédiée, sans changement de comportement.

## Actions destructives (référence pour toute l'application)

Validé sur l'écran Photos, ce patron s'applique à **toute** action irréversible future (remplacer une note vocale, supprimer une ligne de tarif, etc.) :

- Une action destructive n'est **jamais** l'action visuellement principale d'un écran — elle reste un lien ou bouton discret, jamais un `PrimaryButton`.
- Elle déclenche systématiquement une **confirmation légère** : une feuille qui remonte du bas (coins arrondis 26px, fond `cream`, poignée fine), un message court à la forme interrogative (« Supprimer cette photo ? »), puis deux actions empilées : **Annuler** (poids visuel fort — fond `card`) au-dessus de **[Verbe]** (simple texte, couleur `colors.alert`, jamais de fond plein).
- `colors.alert` (`#9C3B2E`) est réservée exclusivement à ces confirmations. Elle n'apparaît nulle part ailleurs dans l'interface.
- Annuler doit toujours être atteignable aussi facilement que l'action destructive elle-même — jamais plus petit, jamais en dessous visuellement.

### Portée de cette règle : uniquement le contenu difficile à recréer

La confirmation par feuille ne s'applique qu'aux pertes de contenu **coûteuses à refaire** : une photo, une note vocale, un devis déjà envoyé. Pour les données métier facilement recréables (une ligne de prestation, un matériel, un texte de formulaire), on privilégie la vitesse :

- La suppression est immédiate, sans feuille de confirmation.
- La ligne disparaît avec une transition discrète (fondu + réduction de hauteur, ~180ms) pour que la disparition reste compréhensible.
- Un **toast avec « Annuler »** apparaît quelques secondes (`UndoToast`, `src/components/atlas/UndoToast.tsx`) — fond `ink`, texte `cream`, bouton Annuler en `rust`. Il se referme seul, ou sur nouvelle suppression le remplace.

Règle de décision : si perdre l'élément coûte du temps ou est irremplaçable (média, envoi déjà effectué) → feuille de confirmation. Si l'élément se retape en quelques secondes → suppression immédiate + `UndoToast`.

## Principes d'expérience (à appliquer à chaque nouvel écran)

Avant de coder un écran, on répond toujours à :

1. Quel est l'objectif principal de cet écran ?
2. Quelle est l'information la plus importante ?
3. Quel est le parcours naturel du regard ?
4. Quelle est l'action principale que l'utilisateur doit effectuer ?
5. Peut-on supprimer un élément inutile ?
6. Peut-on réduire le nombre de clics ?
7. Peut-on rendre l'écran plus simple ?

Un seul bouton principal par écran. Les actions secondaires restent visibles mais discrètes. L'interface ne doit jamais demander un temps de réflexion — si un écran présente plusieurs choix de poids égal, on cherche à en distinguer un comme l'action naturelle suivante.

## Processus de validation

1. Expliquer le parcours utilisateur de l'écran.
2. Expliquer les choix UX (en réponse aux 7 questions ci-dessus).
3. Réaliser une maquette (écran isolé sous `/design/...`, capture Playwright).
4. Attendre la validation.
5. Seulement ensuite, intégrer l'écran dans l'application réelle.
