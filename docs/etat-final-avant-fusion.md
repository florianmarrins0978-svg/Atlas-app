# Atlas — État final avant fusion

*26 août 2026 · branche `claude/atlas-securite-lot3` · **RIEN N'EST FUSIONNÉ***

---

## 1. Ce qui va être fusionné

**37 commits**, qui portent six lots déjà validés un par un :

| Lot | Ce qu'il ferme |
|---|---|
| **M9** | le condensat du mot de passe hors de portée du rôle applicatif |
| **M10** | les onze alertes de dépendances — Next monté à la main en 16.3.2 |
| **M11** | se prouver à nouveau avant un geste sensible, **plus** un contournement de « me déconnecter partout » trouvé hors brief |
| **M12** | la mise à jour du banc réservée au propriétaire |
| **F1–F13** | sept constats fermés, quatre refusés, deux gardés sans toucher au code |
| **Audio** | le format d'un enregistrement se lit dans ses octets |

**Rien d'autre.** Vérifié fichier par fichier : chacun se rattache à l'un de ces
six lots. `package.json` ne porte que la montée de Next et de son greffon de
lint (M10) — aucune autre dépendance n'a bougé.

**Aucun nettoyage, aucune refonte opportuniste** n'a été glissée dans cette
dernière étape.

---

## 2. Les lots désormais clos

| | Verdict |
|---|---|
| **M9, M10, M11, M12** | **CLOS** |
| **F1–F13** | **CLOS** — F7 décision produit, F10 lot séparé |
| **Audio** | **CLOS** — réserve iPhone levée par un essai réel |

---

## 3. Les fichiers et migrations

### Quatre migrations, toutes additives

| | |
|---|---|
| `0064_secret_authentification.sql` | M9 — trois fonctions `SECURITY DEFINER`, droits par colonne |
| `0065_preuve_recente.sql` | M11 — la table des preuves récentes |
| `0066_preuve_par_le_moteur.sql` | M11 — la preuve ne peut plus être forgée par `atlas_app` |
| `0067_isolation_contexte_vide.sql` | F5 — `corrections_dictee` alignée sur la forme robuste |

**Aucune ne touche de donnée existante.** Aucune ne renomme quoi que ce soit —
c'était le piège de F6, et le refuser était le bon geste.

### Les fichiers de production neufs

| | Lot |
|---|---|
| `src/lib/signature-audio.ts` | Audio — la reconnaissance, sans bibliothèque |
| `src/server/audio-entrant.ts` | Audio — la porte unique |
| `src/lib/identite-session.ts`, `src/lib/preuve-recente.ts` | M11 |
| `src/server/preuve-recente.ts`, `src/server/secret-authentification.ts` | M11, M9 |
| `src/server/source-visiteur.ts` | F9 — sorti de `login/actions.ts`, une seule implémentation |
| `src/app/design/layout.tsx` | F12 — les maquettes gelées hors production |
| `src/app/robots.ts` | F13 |
| `src/components/atlas/DemanderPreuve.tsx` | M11 |

**Quarante-sept fichiers de production** modifiés ou ajoutés au total, plus les
suites et la documentation.

---

## 4. L'état des tests

Dernière batterie complète, jouée sur `145205d` :

| Étape | Résultat |
|---|---|
| `npx tsc --noEmit` | ✅ |
| `npm run lint` | ✅ 0 erreur, 12 avertissements préexistants |
| Construction | ✅ |
| `npm run verifier:memoire` | ✅ |
| Suites base — RLS comprises | ✅ **234 / 234** |
| Suites navigateur | ✅ **110 / 110** |
| `npm run verifier:connexion` | ✅ connexion réelle derrière une origine étrangère |
| `npm audit` | 4 modérées, `drizzle-kit → esbuild`, **dépendance de développement** |

**Aucune batterie n'a été rejouée depuis**, et c'est délibéré : les deux commits
qui suivent ne touchent **aucun fichier de `src/`, `scripts/`, `drizzle/` ni
`package.json`** — vérifié, pas supposé. Seul `verifier:memoire` a été rejoué,
puisque seule la documentation a changé. En fabriquer une batterie complète
aurait coûté vingt minutes pour ne rien apprendre.

**Et l'essai qui compte le plus n'est pas dans ce tableau :** une vraie dictée,
depuis un vrai iPhone, sur son banc — réussie le 26 août 2026.

---

## 5. Ce qui reste ouvert

| | Nature |
|---|---|
| **La QUALITÉ de ce que la dictée produit** | lot séparé, ouvert le 26 août : prestations mal organisées, quantités et unités mal lues, prix historiques incohérents |
| **Trois suites navigateur** rougissent sous la batterie, jamais seules | défaut de contrôle, remède écrit dans `TODO.md` |
| **`ARCHITECTURE.md` porte deux fois §164 et §165** | dette d'une fusion antérieure, déjà sur `main` |
| **`extensionPour` et son repli `.audio`** | supprimés — plus rien à faire |

---

## 6. Les décisions produit encore nécessaires

| | Ce qu'il faut trancher |
|---|---|
| **F7 — RGPD** | qui peut exporter et effacer un client, avec quelle preuve, et ce que devient une facture déjà émise |
| **`/catalogue`** | un salarié doit-il voir le vocabulaire de dictée ? À trancher avec les rôles Salarié / Commercial |
| **F10 — la CSP** | quand ouvrir le lot `nonce` |

---

## 7. Ce qui dépend du futur hébergement

**`ATLAS_PROXY_SAUTS`**, et il faut les deux moitiés :

1. poser la variable au nombre de mandataires de confiance devant Atlas —
   1 pour un hébergeur ordinaire ;
2. s'assurer que ce mandataire **écrase** `x-forwarded-for` au lieu d'y ajouter
   la valeur du client.

**Sans les deux, poser la variable serait pire que ne rien faire** : on ferait
alors confiance à ce que l'attaquant écrit.

Tant qu'elle n'est pas posée, tous les seuils comptés « par source » sont
communs à tout le monde. Le seuil de F9 le sait et **se désactive** dans ce cas
plutôt que de bloquer tous les clients de tous les artisans — c'est ce que la
revue hostile a corrigé avant livraison.

---

## 8. Les défauts de sécurité encore connus

| | Gravité | Pourquoi il reste |
|---|---|---|
| **Aucune sauvegarde** | **le point le plus grave du dépôt** | il ne se règle pas en codant |
| **CSP `unsafe-inline`** | réelle | le retirer sans `nonce` casse l'application (F10) |
| **`/catalogue` sans garde de rôle** | faible — aucun prix, seulement le vocabulaire | décision produit |
| **`cle-appareil` : seuil global** sans `ATLAS_PROXY_SAUTS` | faible, délibéré et documenté | 120/minute, volontairement large |
| **Un fichier reconnu peut être du remplissage** | faible | un vrai en-tête WebM suivi de zéros est un vrai WebM vide. La taille et la cadence restent les défenses |
| **MP3 et AAC** n'ont pas de signature | faible | trois trames enchaînées rendent un faux positif très improbable, pas impossible |

**Aucun défaut d'exécution ni de fuite de données n'est connu à ce jour sur les
chemins couverts par ces six lots.**

---

## 9. La fusion

**Rien n'est fusionné, et rien ne le sera sans votre mot.**

Ce qu'elle demandera, le moment venu : refusionner `main` juste avant de pousser
(il a bougé de plus de cent fichiers et porte une migration neuve), appliquer
les migrations, et **rejouer la batterie entière** — cette fois-là, elle
s'impose.
