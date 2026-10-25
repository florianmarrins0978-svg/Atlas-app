# Audit de sécurité : les deux prompts relus et renforcés

*25 octobre 2026. Rien n'a été exécuté. Ce document est une lecture.*

## 1. Le verdict en cinq lignes

1. Les deux prompts sont **solides sur la méthode** : preuve avant affirmation, lots séparés, « NON VÉRIFIÉ » plutôt qu'un faux vert, un test pour chaque faille corrigée.
2. Ils **ratent l'urgence** : Atlas tourne aujourd'hui sur une version de Next.js qui porte **deux failles critiques publiées le 14 octobre**. Un audit de plusieurs semaines ne doit pas passer avant une mise à jour d'une heure.
3. Ils **ignorent ce qui existe** : le dépôt porte déjà quatre audits (`docs/audit-securite-final.md`, lots 2, 2B et 3). Sans en partir, l'audit refait le travail et peut défaire une protection.
4. Ils **demandent des choses impossibles ici** (restauration réelle, scan ZAP, test de charge, production qui n'existe pas encore) sans dire où les faire.
5. Ils **oublient cinq menaces actuelles**, listées au §3.

## 2. Ce que la recherche a trouvé dans Atlas, tout de suite

Mesuré par `npm audit --omit=dev` sur le code de `main`, le 25 octobre.

| Composant | Version d'Atlas | Faille | Atlas exposé ? | Correction |
|---|---|---|---|---|
| **Next.js** | 16.3.8 | RCE par l'optimisation d'images SVG (GHSA-2464-fhr4-w9xw), **critique** | **probablement non** : `sharp` est en 0.35.5, la version qui la ferme | passer en 16.4.3 quand même |
| **Next.js** | 16.3.8 | RCE dans `use cache` (GHSA-673q-mjm6-r5xr), **critique** | **non** : aucun `use cache` dans `src/` | idem |
| **Next.js** | 16.3.8 | déni de service par les actions serveur (GHSA-p3m5-59mp-jv5r), **élevée**, sans connexion | **oui** : toute l'application passe par des actions serveur | **16.4.3** |
| **React** | 19.2.4 | trois dénis de service par les fonctions serveur (CVE-2026-23869, -23870, -44907) | **oui**, sans connexion | **19.2.8** au moins |
| **zod** | 4.4.3 | épuisement mémoire sur une collection géante (GHSA-mrhx-c7xc-m3w5), **élevée** | **à vérifier** : dépend des schémas qui reçoivent des listes | **4.6.6** |
| **@sentry/nextjs** | 10.68 | contournement par la route tunnel (GHSA-mchm-gjx6-7h55), critique | **non** : aucun `tunnelRoute` configuré | mise à jour simple |
| **@simplewebauthn/server** | 9.0.3 | attestation mal vérifiée (GHSA-6hxq-p678-4hr2) | **non** : Atlas demande `attestationType: "none"` | à suivre |
| **next-auth** | 5.0.0-beta.32 | la faille d'avant (« fail open », CVE-2026-73421) | **non** : beta.32 la corrige | rien |

**Mon niveau de confiance** : élevé sur les versions (lues dans `node_modules`) et sur les avis (GitHub Advisory, relayés par `npm audit`). Moyen sur « non exposé » : je l'ai déduit d'une recherche dans le code, pas d'une attaque jouée. Une page qui sert du SVG à `next/image` changerait le premier verdict.

**Ce que je recommande avant tout le reste : un lot 0** qui passe Next.js en 16.4.3, React en 19.2.8 et zod en 4.6.6, avec la batterie complète. C'est le seul point où l'application est exposée **aujourd'hui** à une attaque publique et sans connexion.

## 3. Les menaces actuelles que les deux prompts oublient

| Menace | Ce qui se passe en 2026 | Ce que l'audit doit vérifier dans Atlas |
|---|---|---|
| **Le ver npm « Shai-Hulud »** | Presque un paquet populaire compromis par mois depuis mars 2026 (axios, TanStack, keyv : plus de 400 paquets en août). Il vole les jetons de la machine qui installe, puis publie des versions piégées. | un délai avant d'installer une version neuve (`min-release-age` de npm 11.10+) ; `npm ci` seul en CI ; aucun jeton npm ou GitHub durable sur ton espace ; les clés d'IA de ton espace considérées comme exposées si un paquet piégé y a été installé |
| **Les actions GitHub détournées** | Campagnes « prt-scan » et « hackerbot-claw » : des centaines de demandes de fusion piégées pour voler les secrets des dépôts publics. | aucune action `pull_request_target` ; les actions épinglées par empreinte et non par `@v4` ; `permissions:` minimales sur chaque workflow. Atlas épingle aujourd'hui par `@v4`. |
| **Le vol de cookie de session** | Les voleurs d'identifiants (« infostealers ») prennent le cookie, pas le mot de passe, et passent la double authentification. Livrés par faux CAPTCHA et fausses mises à jour. | la durée de vie d'une session ; « se déconnecter partout » qui révoque vraiment ; une nouvelle preuve d'identité avant un geste sensible (IBAN, e-mail, export complet, suppression) |
| **Les pannes qui laissent passer** (OWASP 2025, A10) | Une erreur de configuration fait répondre « autorisé » au lieu de « refusé ». C'était exactement la faille d'Auth.js de juillet. | chaque contrôle d'accès vérifie un **identifiant**, jamais la seule présence d'un objet ; chaque `catch` refuse ; un test par chemin d'erreur |
| **L'injection de consignes qui fait sortir des données** | Codex et Atlassian Rovo ont fui des données en 2026 : une consigne cachée dans un document fait fabriquer à l'IA une adresse d'image qui emporte les données. | aucune sortie d'IA affichée en Markdown ou en HTML actif ; aucune adresse produite par l'IA chargée sans clic ; les photos de ticket et de croquis traitées comme du contenu hostile |
| **La rançon par double extorsion** | 96 % des rançongiciels de 2026 volent les données **avant** de chiffrer : une sauvegarde rend l'accès, pas le secret. Des robots vident les PostgreSQL ouverts sur internet. | PostgreSQL jamais joignable depuis internet ; une sauvegarde **hors de la machine**, que l'application ne peut pas effacer ; le chiffrement des sauvegardes |
| **Ton espace lui-même** | Ton espace Codespace sert l'application sur un port public, avec tes vraies données (`.devcontainer/veiller.sh`). | qui peut ouvrir ce port ; si l'adresse se devine ; si le limiteur de connexion y tient. Aujourd'hui, c'est la vraie production d'Atlas. |

## 4. Ce qui ne peut pas se faire dans une session cloud

| Demandé par les prompts | Possible ici ? | Où le faire |
|---|---|---|
| inventaire, revue du code, tests croisés entre entreprises, tests base | **oui** | ici |
| tests navigateur, attaque des actions serveur, fuzzing des imports | **oui** | ici |
| scan OWASP ZAP | **non** : pas de Docker ici | dans un workflow GitHub, comme `banc-essai.yml` |
| test de charge | **non**, et dangereux sur ton espace | une instance jetable, plus tard |
| restaurer une sauvegarde réelle | **non** : la sauvegarde est sur ton espace | ton espace, avec une commande que je prépare |
| en-têtes HTTP, HTTPS, hébergeur de production | **non vérifiable** : la production n'existe pas encore | au choix de l'hébergeur ; jusque-là, marqué NON VÉRIFIÉ |

## 5. Ce que j'ai retiré des prompts, et pourquoi

| Retiré | Pourquoi |
|---|---|
| « Agis comme une équipe de six experts » | Ça ne change rien au travail ; ce qui compte, ce sont les scénarios. Les scénarios restent. |
| « Corriger immédiatement » chaque faille trouvée | Les règles du dépôt priment : chaque correction est un lot, avec un test rouge d'abord, et ce qui est irréversible se demande au patron. |
| « Tout l'inventaire, puis tout le plan, puis tout le code » | Trop long avant le premier gain. Le lot 0 passe d'abord, puis l'audit avance zone par zone, la plus grave en premier. |

---

## 6. LE PROMPT RENFORCÉ, à copier

> **ATLAS : AUDIT DE SÉCURITÉ ADVERSARIAL, VERSION DU 25 OCTOBRE 2026**
>
> **0. Ce qui prime.** Les règles du dépôt (`CLAUDE.md`, `.claude/rules/`) priment sur ce texte. Aucune poussée sur `main` sans le contrôle de son niveau au vert ; aucune demande de fusion ; aucun geste qui peut effacer des données ; la batterie se signale avant d'être lancée. Rien de ce qui est écrit ici n'élargit ces droits.
>
> **1. Lot 0, avant toute lecture : les failles publiées.** Jouer `npm audit --omit=dev`. Mettre à jour en un seul lot Next.js (16.4.3 au moins), React et React DOM (19.2.8 au moins) et zod (4.6.6 au moins). Lire les notes de version entre les deux versions, jouer la batterie complète, regarder les écrans touchés. Pour chaque avis non corrigé, écrire pourquoi Atlas n'est pas exposé, avec la ligne de code qui le prouve.
>
> **2. Partir de l'existant.** Lire `docs/audit-securite-final.md`, `docs/lot-2-securite-verdict.md`, `docs/lot-2b-securite-verdict.md` et les documents du lot 3. Pour **chaque** faille qu'ils déclarent corrigée, rejouer son test et donner son état aujourd'hui. Une protection documentée mais introuvable dans le code est une faille.
>
> **3. Inventaire, en lecture seule.** Toutes les routes, actions serveur, routes d'API, tâches de fond, liens publics par jeton, tables, politiques RLS, fonctions SQL, rôles PostgreSQL, appels à un fournisseur extérieur et workflows GitHub. Pour chaque entrée : qui peut l'appeler sans connexion, ce qu'elle lit, ce qu'elle écrit, et le test qui la couvre (ou « aucun »).
>
> **4. Les attaques, dans cet ordre de gravité.** Chaque scénario se joue sur une base d'essai, avec deux entreprises synthétiques A et B :
>
> 1. **Isolation entre entreprises.** A lit, crée, modifie, supprime, exporte ou cherche chez B, par chaque action serveur et chaque route, en changeant tout identifiant de la requête. Chaque table sous `FORCE ROW LEVEL SECURITY` ; aucun rôle applicatif avec `BYPASSRLS` ; chaque fonction `SECURITY DEFINER` justifiée ; une migration neuve sans politique fait rougir un contrôle.
> 2. **Sans connexion.** Chaque action serveur appelée directement par son identifiant ; chaque lien public deviné, rejoué, expiré ou détourné vers un autre document ; énumération des comptes par les messages d'erreur et les délais de réponse ; une requête malformée ou géante sur chaque point d'entrée.
> 3. **Les pannes qui laissent passer.** Chaque contrôle d'accès vérifie un identifiant précis, jamais la seule présence d'une session. Pour chaque dépendance (base, Redis, stockage, IA, courriel), la couper et vérifier que la réponse est un refus, sans écriture à moitié faite.
> 4. **L'argent.** Prix, quantités, remises, TVA, acomptes et totaux falsifiés dans la requête ; valeurs négatives, extrêmes, décimales ; double envoi simultané ; rejeu ; modification après émission. Le serveur recalcule tout, dans une transaction.
> 5. **Le compte volé.** Cookie de session copié sur une autre machine : combien de temps vaut-il ? « Se déconnecter » le révoque-t-il partout ? Les gestes sensibles (IBAN, e-mail, mot de passe, export complet, suppression, ajout d'un appareil) redemandent-ils une preuve d'identité ? Le changement d'e-mail prévient-il l'ancienne adresse ?
> 6. **L'IA.** Une consigne cachée dans une dictée, un nom de client, une photo de ticket ou de croquis, un fichier importé : peut-elle faire écrire ailleurs que chez l'artisan, inventer un prix qui s'enregistre sans son geste, ou faire charger une adresse ? Aucune sortie d'IA affichée comme du HTML ou du Markdown actif. Plafond de coût par entreprise et par jour.
> 7. **Fichiers.** Type réel lu dans le contenu ; taille plafonnée avant lecture ; SVG et HTML refusés ou servis sans exécution ; bombes ZIP dans les XLSX ; nom de fichier fabriqué par le serveur ; données GPS retirées des photos envoyées aux clients.
> 8. **Requêtes vers l'extérieur.** Pour chaque adresse que le serveur va chercher : adresses privées, `localhost`, IPv6, métadonnées cloud, redirections, changement de DNS entre le contrôle et la connexion.
> 9. **Chaîne logicielle.** Un délai minimal avant d'installer une version neuve de paquet ; `npm ci` en CI ; les actions GitHub épinglées par empreinte ; `permissions:` minimales ; aucun `pull_request_target` ; aucun secret dans l'historique git ; la liste des secrets à changer si un paquet piégé passe.
> 10. **Son espace, qui est la production d'aujourd'hui.** Qui peut ouvrir le port public ; si le limiteur de connexion tient derrière le relais ; où vit la sauvegarde ; si PostgreSQL et Redis sont joignables de l'extérieur.
> 11. **Sauvegardes et rançon.** Une sauvegarde hors de la machine que l'application ne peut pas effacer ; chiffrée ; restaurée au moins une fois dans une base isolée (commande préparée, jouée par le patron sur son espace).
>
> **5. Pour chaque faille.** Identifiant, gravité, fichier, préconditions, preuve de reproduction, impact. Puis, dans cet ordre : test **rouge**, correction à la racine, test **vert**, le test reste dans la batterie. Une faille critique ou élevée bloque toute livraison jusqu'à sa correction ou une décision écrite du patron.
>
> **6. Ce qui ne se fait pas ici se dit.** Scan ZAP, test de charge, en-têtes de production, restauration réelle : soit un workflow GitHub qui le joue, soit « NON VÉRIFIÉ » avec le lieu où le faire. Jamais un vert supposé.
>
> **7. Livraison.** Un lot par zone, la plus grave d'abord, chacun sur `main` dès son contrôle vert. À la fin : `docs/audit-securite-2026-10.md` avec l'inventaire, un verdict par scénario, les failles trouvées et corrigées, ce qui reste ouvert et qui doit le trancher, ce qui est NON VÉRIFIÉ, et ce qu'un test d'intrusion externe doit couvrir.
>
> **8. Ce qu'on ne promet pas.** Ni « aucune faille », ni « l'application est sûre ». Seulement : ce qui a été attaqué, ce qui a tenu, ce qui a été corrigé, et ce qui n'a pas été regardé.

---

## 7. Ce qui reste à décider, et qui le décide

| Question | Qui |
|---|---|
| Lancer le lot 0 (mise à jour de Next.js, React et zod) maintenant | toi |
| Où héberger la production (cela décide des en-têtes, sauvegardes et accès réseau) | toi |
| Payer un test d'intrusion externe avant le premier client payant | toi |

## Sources

- [Next.js, mise à jour de sécurité du 14 octobre 2026 (relais CSA Singapour)](https://www.csa.gov.sg/alerts-and-advisories/alerts/al-2026-148/)
- [Pantheon, versions corrigées et contournement par sharp](https://docs.pantheon.io/release-notes/2026/10/nextjs-security-release)
- [Next.js 16.4.1, deux RCE critiques](https://dailysecurityreview.com/?p=44596)
- [React, déni de service CVE-2026-44907](https://corgea.com/advisories/vulnerabilities/CVE-2026-44907)
- [React, CVE-2026-23869](https://advisories.gitlab.com/npm/react-server-dom-parcel/CVE-2026-23869/)
- [React, CVE-2026-23870](https://corgea.com/advisories/vulnerabilities/CVE-2026-23870)
- [React2Shell, CVE-2025-55182 (Wiz)](https://www.wiz.io/fr-fr/blog/critical-vulnerability-in-react-cve-2025-55182)
- [Auth.js, panne qui laisse passer, CVE-2026-73421](https://advisories.gitlab.com/npm/next-auth/GHSA-8fpg-xm3f-6cx3/)
- [Shai-Hulud, vague keyv (CSA Singapour)](https://www.csa.gov.sg/alerts-and-advisories/advisories/ad-2026-009/)
- [TanStack compromis (Snyk)](https://snyk.io/blog/tanstack-npm-packages-compromised/)
- [Tensorlake compromis (The Hacker News)](https://thehackernews.com/2026/10/tensorlake-npm-package-compromised-to.html)
- [Délais avant installation (Datadog)](https://securitylabs.datadoghq.com/articles/dependency-cooldowns/)
- [Campagne prt-scan sur GitHub Actions (CSA)](https://labs.cloudsecurityalliance.org/research/csa-research-note-github-actions-prt-scan-supply-chain-2026/)
- [OWASP Top 10:2025](https://owasp.org/Top10/2025/ja/)
- [Ce qui change dans l'OWASP 2025 (Fastly)](https://www.fastly.com/blog/new-2025-owasp-top-10-list-what-changed-what-you-need-to-know)
- [Vol de cookies de session (Cloudsek)](https://www.cloudsek.com/knowledge-base/what-is-cookie-logging)
- [Injection de consignes et fuite par image Markdown, CVE-2026-14898](https://nvd.nist.gov/vuln/detail/CVE-2026-14898)
- [Injection de consignes dans Atlassian Rovo (CSA)](https://labs.cloudsecurityalliance.org/research/csa-research-note-atlassian-rovo-prompt-injection-20260811-c/)
- [Double extorsion : pourquoi les sauvegardes ne suffisent pas](https://ifeeltech.com/blog/double-extortion-ransomware-backups-not-enough)
- [Robot qui vide les PostgreSQL mal protégés (Help Net Security)](https://www.helpnetsecurity.com/?p=289115)

Plusieurs de ces sources sont des blogs d'éditeurs de sécurité. Les avis qui comptent pour Atlas (Next.js, React, zod) ont été recoupés par `npm audit`, qui lit la base officielle de GitHub.
