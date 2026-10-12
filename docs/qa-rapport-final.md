# Campagne QA : rapport final de charge (12 octobre 2026)

À coller dans une nouvelle session pour reprendre à froid. Fait suite à `docs/qa-rapport-2026-10-12-batterie.md` (batterie navigateur 180/183, non rejouée ici).

## En une phrase

**L'application tient 50 utilisateurs simultanés confortablement (p95 0,4 s) et décroche à 100 (p95 3,1 s), sans aucune erreur ni aucune fuite entre entreprises. Ce qui sature, c'est le processeur du serveur Node, qui ne travaille que sur un seul cœur.** Ce n'est ni la base, ni la mémoire, ni les connexions.

## Où on en est

- Dossier `Atlas-qa`, branche `qa/campagne`, code fusionné de `main` au commit `d042d9b7`
- **Rien n'est poussé.** Aucun fichier de `src/` n'a été modifié.
- Ni le dossier `atlas-app` (et ses copies `-s2`, `-s3`, `-s4`) ni le port 5432 n'ont été touchés.

## Conditions de mesure

| | |
|---|---|
| Application | version bâtie (`npm run build`), servie par `npx next start` sur le port 3000 |
| Base | QA, port 55432, rôle **`atlas_app`** du `.env` (vérifié dans `pg_stat_activity` : 10 connexions, toutes `atlas_app`). RLS et séparation entre entreprises actives, comme en vrai |
| Réglages ajoutés au lancement | `ATLAS_PROFIL=banc` (sans lui, `next start` refuse de démarrer : pas de clé d'IA facturée ici) et `AUTH_TRUST_HOST=true`. Aucun ne touche à la base |
| Pool de connexions | `DATABASE_POOL_MAX` absent, donc la valeur par défaut : **10** |
| Machine | un seul PC Windows, 12 cœurs logiques. k6 tourne sur la même machine que le serveur |
| Données | 20 entreprises créées par la fonction du produit (`creerSonCompte`), chacune avec 30 clients et 30 chantiers dont 15 au planning |
| Sessions | 20 **vraies** connexions, faites dans un vrai navigateur (formulaire, acceptation des conditions). Chaque utilisateur virtuel reprend la session de l'une des 20 entreprises |

**Ce que fait chaque utilisateur virtuel**, en boucle, avec 1 à 3 s de lecture entre deux écrans :

| Famille | Écrans | Part |
|---|---|---|
| listes | `/` (chantiers), `/clients`, `/termines` | 50 % |
| planning | `/planning` | 30 % |
| PDF | facture d'exemple, fiche de chantier | 20 % |

Chaque palier : 30 s de montée, 60 s de tenue, 30 s de repos. Règle d'arrêt : erreurs > 5 % **ou** p95 > 3 s, sur l'ensemble des écrans.

## Résultats par palier

| Utilisateurs | Requêtes/s | p95 global | Erreurs | p95 listes | p95 planning | p95 PDF | Fuites entre entreprises |
|---|---|---|---|---|---|---|---|
| 10 | 4,4 | 80 ms | 0 % | 85 ms | 85 ms | 81 ms | 0 |
| 50 | 20,8 | 393 ms | 0 % | 433 ms | 413 ms | 259 ms | 0 |
| **100** | **26,4** | **3 101 ms** | 0 % | **3 365 ms** | 2 653 ms | 518 ms | 0 |
| 200, 500, 1000 | non joués : arrêt au palier 100, comme convenu | | | | | | |

Médianes et p99 :

| Utilisateurs | Médiane globale | p99 global | Médiane listes | Médiane planning | Médiane PDF |
|---|---|---|---|---|---|
| 10 | 39 ms | 111 ms | 41 ms | 42 ms | 31 ms |
| 50 | 107 ms | 535 ms | 131 ms | 122 ms | 86 ms |
| 100 | 943 ms | 3 756 ms | 1 801 ms | 1 569 ms | 272 ms |

Aucun contrôle en échec sur les trois paliers (679, 3 229 puis 4 095 contrôles réussis).

## Où ça décroche, et pourquoi

**Palier 100.** Le p95 global passe à 3,1 s (listes 3,4 s). Les erreurs restent à 0 % : rien ne casse, tout ralentit.

| Piste | Ce qu'on a mesuré | Verdict |
|---|---|---|
| **Processeur du serveur** | 7,2 % de la machine à 50 utilisateurs, 8,3 % à 100. Sur 12 cœurs, 8,3 % = **un cœur entier** | **cause probable** |
| Débit | 20,8 → 26,4 requêtes/s quand les utilisateurs doublent : le serveur ne sert plus plus vite, il fait la queue | confirme le plafond |
| Base de données | requêtes actives : 0,3 en moyenne, 2 au plus. Attentes de verrou : **0** | pas la cause |
| Connexions à la base | jamais toutes occupées en même temps par des requêtes actives | pas la cause |
| Mémoire | 750 Mo en moyenne, stable entre 50 et 100 utilisateurs | pas la cause |
| k6 lui-même | moins de 3 % du processeur | ne fausse pas la mesure |

**Lecture.** Node.js exécute le JavaScript sur un seul fil. Le rendu des écrans côté serveur occupe ce fil environ 35 à 40 ms par page. Au-delà d'environ 25 pages par seconde, les demandes attendent leur tour. Les listes et le planning, les plus lourds à dessiner, attendent le plus. Les PDF restent rapides : leur fabrication coûte moins de rendu.

**Un signe à surveiller, sans conclusion.** Les connexions « ouvertes en transaction mais inactives » montent avec la charge : 3 en moyenne à 50 utilisateurs, 7 à 100 (jusqu'à 17). Cela colle à un fil saturé : une transaction ouverte attend que Node ait le temps de la poursuivre. **Pas prouvé** : il faudrait un profil du serveur pour l'établir.

## Ce qu'il faudrait changer

Par ordre d'effet attendu :

1. **Faire tourner plusieurs processus Node.** Un seul processus n'utilise qu'un cœur sur 12. Plusieurs instances derrière un répartiteur (ou plusieurs conteneurs) multiplient le débit à peu près par le nombre de cœurs. C'est le levier principal. Il faut alors **régler `DATABASE_POOL_MAX` par instance** pour que le total reste sous la limite de PostgreSQL.
2. **Mesurer où part le temps de rendu** des listes et du planning (`node --cpu-prof` pendant un palier à 50). Ce sont les écrans les plus coûteux. Une requête trop large ou un calcul refait à chaque page se verrait là.
3. **Vérifier la durée des transactions** ouvertes par `withEntreprise` sous charge (voir le signe ci-dessus). Une transaction qui englobe du calcul garde une connexion pendant que le fil est occupé ailleurs.
4. **Ne pas monter le pool de connexions seul** : la base n'est pas le goulot aujourd'hui. Le monter sans multiplier les processus ne changerait rien.

## Limites de cette mesure

- **Une seule machine** pour le serveur, la base et k6 : en production, le réseau ajoute de la latence et la base est ailleurs.
- **Seul le HTML** des écrans est demandé, pas les fichiers JavaScript, CSS et images (ils seraient servis par un CDN en vrai).
- **20 sessions pour 100 utilisateurs** : plusieurs utilisateurs virtuels partagent une même session, comme un artisan ouvert sur deux appareils. La connexion elle-même (limitée à 5 tentatives par quart d'heure) n'est pas chargée.
- **Les gestes d'écriture** (créer un devis, déplacer un chantier) ne sont pas mesurés : seulement la lecture et les PDF.
- **L'IA est coupée** (`ATLAS_PROFIL=banc`) : la dictée et la rédaction de devis ne sont pas dans la mesure.

## Séparation entre entreprises, sous charge

Elle a tenu sur les trois paliers : **0 fuite**.

- Chaque liste et chaque planning doivent montrer les chantiers de l'entreprise connectée et **aucun** d'une autre. Le contrôle a été vérifié avant la mesure : 60 noms propres sur `/` et `/clients`, 32 sur `/planning`. Une page vide ne passe donc pas pour « isolée ».
- La fiche PDF d'un chantier d'une **autre** entreprise est demandée à chaque passage : toujours refusée (404).

## Comment rejouer

```powershell
# base QA allumée (docker ps : atlas-qa-postgres et atlas-qa-redis Up), qa:preuve 15/15
$o="$env:TEMP\claude\qa-charge"
npx tsx --env-file=.env qa/charge/preparer-comptes.ts $o 20      # rejouable, reprend les comptes existants
npm run build
$env:ATLAS_PROFIL="banc"; $env:AUTH_TRUST_HOST="true"
Start-Process npx.cmd -ArgumentList "next","start","-p","3000" -PassThru   # noter le PID
npx tsx qa/charge/connecter.mts $o                                # ouvre les 20 sessions
powershell -File qa/charge/jouer-paliers.ps1 $o <PID du serveur>
taskkill /PID <PID du serveur> /T /F                              # à la fin
```

| Fichier | Rôle |
|---|---|
| `qa/charge/preparer-comptes.ts` | crée les 20 entreprises et leurs données par les fonctions du produit, refuse toute base autre que 55432 sous `atlas_app` |
| `qa/charge/connecter.mts` | ouvre les vraies sessions dans un navigateur |
| `qa/charge/scenario.js` | le scénario k6 (familles, contrôles d'isolation) |
| `qa/charge/surveiller.ps1` | relève processeur, mémoire et état de la base toutes les 2 s |
| `qa/charge/jouer-paliers.ps1` | enchaîne les paliers et s'arrête au décrochage |

Les sorties brutes (résumés k6, relevés de ressources, sessions) sont dans `%TEMP%\claude\qa-charge\`, hors dépôt. `sessions.json` contient des cookies de session de comptes de test : il ne doit pas entrer dans le dépôt.

## Ce qui a été corrigé en route

- Le premier lancement des paliers n'a rien mesuré : PowerShell coupait un argument de k6 en deux. Corrigé dans `jouer-paliers.ps1`. Un k6 qui ne démarre pas s'y signale désormais comme « échec du script », et non plus comme « 100 % d'erreurs ».
- Le premier passage de `connecter.mts` s'arrêtait sur l'écran des conditions générales. L'acceptation est maintenant faite comme par un utilisateur : cocher, puis « Continuer ».

## Prochaines étapes

1. Profiler le serveur pendant un palier à 50 utilisateurs (`node --cpu-prof`) pour savoir ce qui coûte dans les listes et le planning.
2. Rejouer les paliers avec 2 ou 4 processus Node pour confirmer que le débit monte avec eux.
3. Ajouter au scénario des gestes d'écriture (créer un chantier, planifier).
4. Restes de la campagne : `test-devis-client-e2e.ts` (P3, `QA_FINDINGS.md` §3), les deux suites impossibles à mesurer sous Windows, et rien n'est encore poussé (accord du patron requis).
