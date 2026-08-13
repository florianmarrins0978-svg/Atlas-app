# Atlas — Système de design

Structure validée le 27/07/2026 ; **identité visuelle remplacée le 03/08/2026**
par celle d'Arborea (voir plus bas). Ce document est la référence pour tout
nouvel écran. On ne remet plus en question l'identité visuelle elle-même —
seule l'expérience (parcours, hiérarchie, densité d'information) se construit
écran par écran à partir d'ici.

**La source de vérité des valeurs est `src/lib/design-tokens.ts`**, pas ce
document : les couleurs y ont été relevées au navigateur sur le site publié
d'Arborea, jamais approchées à l'œil. Si les deux divergent, le fichier a
raison et ce document se corrige. Composants partagés :
`src/components/atlas/`.

## Palette (une seule couleur d'accent)

Relevée sur Arborea — l'application avait dérivé vers une identité terre cuite
qui lui était propre pendant que les maquettes gardaient celle du patron. Les
deux ont été comparées le 3 août 2026, et **l'application reprend Arborea**.

| Rôle | Jeton | Valeur | Usage |
|---|---|---|---|
| Fond de page | `cream` | `#f5f3ee` | derrière tout écran |
| Fond de carte | `card` | `#faf9f5` | cartes, lignes de liste |
| Texte principal | `ink` | `#1c1c1a` | titres, contenu |
| Texte de second plan | `inkSoft` | `#4a4a44` | chapôs |
| Texte secondaire | `muted` | `#8a8578` | meta, sous-titres |
| **Accent (unique)** | `rust` | `#2f3b2f` | bouton principal, libellés de statut, icônes actives, navigation active |
| Accent, second niveau | `rustDeep` | `#4f5f4c` | survol |
| Fond teinté accent | `rustTint` | `#ece9e1` | avatars d'icône |
| Vert clair | `sage` | `#7d9a6d` | bordure de survol, encarts d'information |
| Séparateurs | `line` | `rgba(28,28,26,0.12)` | bordures fines |

Le jeton d'accent s'appelle `rust` alors qu'il porte désormais le vert pin :
soixante fichiers l'employaient, et le renommer dans le même lot aurait mêlé un
changement d'identité à un changement mécanique, chacun masquant les erreurs de
l'autre.

Aucune autre couleur n'est introduite. Le statut ne se distingue jamais par une
couleur différente — toujours par une icône, jamais par plusieurs teintes.

**Une exception, délibérée : les documents que le client reçoit.** Devis et
facture gardent la terre cuite (`couleursDocument.accent`, `#B25A2E`), choisie
et maintenue par le patron le 3 août. Un devis n'est pas un écran : c'est la
pièce que son client garde, imprime et signe, et elle porte sa propre teinte.

## Typographie

- **Playfair Display** (`font.display`, classe `.font-display`) — titres de page et noms de chantier. C'est l'élément qui capte le regard en premier.
- **Inter** (`font.body`) — tout le reste : meta, boutons, navigation, corps de texte.
- **Petites capitales** (constante `smallCaps` : 11px, `tracking-[0.18em]`, couleur accent) — pour tout libellé de statut ou eyebrow. Jamais de pastille colorée pleine.

Les deux polices sont rapatriées au *build* par `next/font` et servies depuis
notre propre origine : la politique de sécurité (`default-src 'self'`)
interdirait de les charger chez Google.

Les tailles de texte sont fixes et ne se réinventent pas d'un écran à l'autre : 36px pour un titre de page, 20-22px pour un titre de carte, 14px pour le texte courant, 11px pour les libellés.

## Composants

- **Bouton principal** (`PrimaryButton`) : pleine largeur, fond accent plein, coins arrondis `rounded-2xl`, toujours à la même position dans la page (juste sous l'en-tête). Un seul bouton principal par écran. Désactivé, il prend `line` sur `muted` — jamais l'accent en transparence.
- **Icône de statut** (`StatusIcon`) : avatar circulaire 44px, fond `rustTint`, icône fine (trait 1.8px) en `rust`. Le statut se lit à l'icône, pas à la couleur.
- **Carte** : coins arrondis `radius.card` (16px), ombre presque invisible (`cardShadow`) **teintée de vert pin et non de gris neutre**, jamais de bordure visible.
- **Navigation basse** (`AtlasBottomNav`) : identique sur tous les écrans qui la comportent, 4 onglets (Chantiers, Planning, Terminés, Réglages), icône + libellé, accent = actif. La liste est fixe et ne dépend pas de l'état des données : un onglet qui apparaît et disparaît déplace les trois autres sous le doigt.
- **Chevron** : seule affordance de navigation vers l'intérieur d'une carte — gris discret, jamais coloré.

## Feuilles de confirmation — deux patrons, une seule coquille

Toute feuille de confirmation utilise la coquille partagée `BottomSheet` (`src/components/atlas/BottomSheet.tsx` : fond, feuille arrondie 26px, poignée). Le contenu et la hiérarchie des boutons changent selon l'intention de l'action.

### Patron n°1 — Confirmation d'action destructive

**Périmètre réduit le 10 août 2026 : il ne sert plus à supprimer.** Toute
suppression passe désormais par le retrait et son tiroir (voir plus bas), et
garder les deux ferait demander deux fois. Ce patron reste pour ce qui n'est
pas une suppression mais engage quand même : **remplacer une note vocale**, par
exemple, qui ouvre un nouvel enregistrement sans rien détruire au moment du
geste — il n'y a donc rien qu'un tiroir puisse retenir.

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

## Retirer — le geste unique, sur tout ce qui se supprime

*Retenu par le patron le 10 août 2026 sur maquette, et posé partout le soir
même. `ARCHITECTURE.md` §48 pour le détail, `docs/INTEGRER-ORIGINE.md` §4 pour
le dessin.*

Il y avait **trois** mécaniques de suppression — glissement et corbeille rouge,
croix nue, panneau de confirmation. Il n'y en a plus qu'une :

1. le **texte** de la ligne glisse vers la gauche (le fond, la date et le fil
   ne bougent pas), et se dissout au bord plutôt que d'être tranché ;
2. **« Retirer »** se découvre, en capitales espacées, couleur d'attente ;
3. la ligne **tombe**, le décompte de l'écran suit ;
4. un **tiroir** s'ouvre entre le contenu et le bas de page : « Retiré à
   l'instant — Annuler ». Il pousse le contenu, il ne le recouvre jamais.

**La sécurité a changé de place, et c'est le cœur du geste** : d'une
confirmation AVANT à une réversibilité APRÈS.

### Les trois règles à ne pas défaire

- **Rien n'est écrit tant que le tiroir est ouvert.** Un média met son fichier
  en file de purge dans la même transaction que sa suppression : écrire au
  moment du geste rendrait « Annuler » menteur — la ligne reviendrait, le
  fichier non. *Une annulation qui ne rend rien est pire que pas d'annulation.*
- **« Annuler » vise le DERNIER retrait.** Un libellé unique pointant toujours
  la même ligne rendrait la première quand on retire la deuxième.
- **Un refus se lit.** Ce qui ne peut pas être retiré — un chantier facturé —
  découvre son MOTIF à la place du bouton. Un geste sans effet ressemble à une
  panne.

### Les pièces

| Pièce | Ce qu'elle porte |
|---|---|
| `LigneRetirable` | le glissement, la chute, le refus. Remplace `AnimatedRow` et `CarteGlissante` |
| `TiroirDesRetires` | le tiroir — un par écran, en fin de colonne |
| `useRetraits` | le délai, la pile des retraits, l'écriture différée |

`colors.alert` (`#9C3B2E`) ne sert plus qu'à ce qui reste vraiment destructif
et sans retour — elle n'apparaît nulle part ailleurs.

**Une exception, assumée :** les photos. Une vignette carrée dans une grille de
trois n'est pas une ligne, et y faire glisser un texte qui n'existe pas n'a
aucun sens. Elles gardent le mot, la couleur, le tiroir et l'écriture différée,
et se retirent depuis la visionneuse — là où on les regarde.

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
