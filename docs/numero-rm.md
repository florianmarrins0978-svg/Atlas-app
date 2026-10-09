# Le numéro RM sur le devis et la facture

*9 octobre 2026. Sa question : « comment les utilisateurs vont pouvoir remplir
ces champs ? », puis son choix B sur la planche `appli/numero-rm.html`.*

## En cinq lignes

1. **Un champ « Répertoire des métiers » dans Mon entreprise**, sous le SIRET.
   Facultatif, jamais réclamé.
2. **Rempli, il s'imprime tel qu'écrit après le SIRET**, sur la même ligne :
   « SIRET 12345678900012, RM 33 ». Sur le devis, la facture et l'avoir.
3. **Vide, rien ne change** : pas de virgule seule, pas de rappel.
4. **Une pièce partie garde sa mention** si elle change ensuite, comme le SIRET.
5. **Batterie complète à jouer** (le lot touche la base), puis fusion sur
   `main` à demander.

## Verdict, point par point

| Point | Verdict | Où |
|---|---|---|
| Le champ dans Mon entreprise | fait, enregistré et relu après rechargement, regardé à l'écran | `src/app/reglages/identite/IdentiteClient.tsx` |
| L'impression « SIRET …, RM 33 » | fait, regardé sur un vrai devis | `ligneSiret`, `src/server/pdf/document-commun.ts` |
| Figée sur le devis et la facture | fait | migration `0128_numero_rm.sql` |
| L'avoir | suit la facture, sans code de plus | `donneesFacture` |
| Vide ou effacé : rien ne s'imprime | fait | `test-numero-rm-sur-les-pieces-db` |

## Ce qui a été fait autrement, et pourquoi

| | |
|---|---|
| **Texte libre, pas « RM » calculé** | aucun texte trouvé ne dit quelle mention un artisan porte depuis le RNE (2023). Imprimer « RM » et le département d'office affirmerait une règle non vérifiée sur chaque pièce de chaque utilisateur |
| **Sans SIRET, la mention garde sa ligne** | elle ne disparaît pas avec lui. Le SIRET reste de toute façon exigé avant l'envoi |

## Ce qui n'a pas été fait, délibérément

| | Pourquoi |
|---|---|
| La fiche de chantier et la lettre de mise en demeure | non demandées ; la loi ne vise que le devis et la facture |
| Rendre le champ obligatoire | une société, un commerçant ou une micro-entreprise de services n'en ont pas : leurs devis seraient bloqués pour rien |

## Les contrôles

| | Résultat |
|---|---|
| `test-numero-rm-sur-les-pieces-db` (base, sous `atlas_app`) | **rouge** avant `ligneSiret` (3 sur 5), **vert** après (5 sur 5) |
| Types, lint, tirets, pansements | verts |
| L'écran Mon entreprise | champ visible sous le SIRET, saisie enregistrée et relue |
| Un vrai devis en PDF | « SIRET 12345678900012, RM 33 » sous le courriel |
| **La batterie complète** | **à jouer** : niveau 3, le lot ajoute trois colonnes |

## Ce qui reste ouvert

| Question | Qui |
|---|---|
| La mention exacte qu'un artisan doit écrire depuis 2023 | sa chambre des métiers ; le champ libre accepte la réponse telle quelle |
| La fusion sur `main` | **lui** |
