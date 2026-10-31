# Le relevé du 29 octobre, sur `main`

Ses réponses du 29 octobre : « 7 oui et oui pour les 2 / 1 oui / 2 en rouge / 3 oui / 4 fait rien / 5 le A / 6 oui », puis le 31 : « j'aimais bien que l'icône du filtre soit sur la même ligne que la barre de recherche ».

Poussé sur `main` le 31 octobre 2026, commit `ec0a53bc`.

## Un verdict par point

| Point | Verdict | Où |
|---|---|---|
| 7. Attestation du comptable | le PDF signé part joint au courriel du patron, et une copie au comptable ; l'écran nomme qui l'a reçue | `src/server/attestation-comptable.ts`, `src/server/courriel/brevo.ts` |
| 1. Abonnement | « Attention au mot » sans encadré bleu | `AbonnementClient.tsx` |
| 2. Crédits IA | la carte et sa pastille ; épuisé en rouge | `CreditsIA.tsx` |
| 3. Photo | « Annuler » dans la feuille | `FichePhoto.tsx` |
| 4. Fondations | rien, comme demandé | |
| 5. Voir le dossier | A : la taille et le nombre de lignes (« 774 Ko, 60 lignes ») | `MesDossiers.tsx` |
| 6. Vos clients soignée | cartes « Vos partenaires » et « Services publics », lettres, initiales, pastille « dus », import en bas | `src/app/clients/`, `src/lib/ligne-du-client.ts` |
| Filtre | revenu sur la ligne de la recherche, en son seul signe : avec le mot « Filtre », la phrase de la loupe se coupait | `BoutonFiltre.tsx` (`signeSeul`) |

## Fait autrement, et pourquoi

- Le Filtre n'a plus son mot : sur un téléphone de 360 px, « Chercher un nom, un titre, un montant » ne tenait pas à côté de lui. Le signe porte « Filtre » pour la lecture vocale.
- Sous 380 px, le petit dessin des cartes « Vos partenaires » disparaît : « partenaires » touchait la flèche. Trouvé en regardant l'écran.

## La batterie

| Contrôle | Résultat |
|---|---|
| Types, lint, construction, mémoire, connexion | verts |
| Suites base | 541 / 541 |
| Suites navigateur | 202 / 203 |
| Le rouge | `test-poser-une-date-e2e`, rouge aussi sur `main` (fin de mois) : pas ce lot |

## Ce qui reste

| | Qui |
|---|---|
| L'en-tête de Vos clients (l'assistant sur la ligne du retour) | lui |
| Le chemin de Chromium en dur dans le dépôt | un lot d'outillage |
| La suite « Poser une date » qui rougit en fin de mois | une session |
