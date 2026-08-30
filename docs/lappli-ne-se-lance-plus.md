# « L'appli ne se lance plus » — nuit du 30 au 31 août 2026

## Ce qui se passait

**Ton espace tournait, Atlas tournait dedans, et ton téléphone n'atteignait
rien.** Ce n'était ni le code, ni la construction, ni la mémoire : c'est
l'adresse publique qui ne menait plus à l'application. GitHub avait perdu ton
port 3000, et rien ne s'en apercevait.

Le téléchargement que Safari te proposait au lieu de la page, c'est exactement
ça : un refus de GitHub, sans contenu. Un navigateur enregistre ce qu'il ne sait
pas afficher.

## Ce que tu as à faire demain

**Rallume ton espace** — github.com/codespaces. C'est tout.

Le veilleur corrigé redemandera le port tout seul. S'il ne revient toujours pas,
et seulement dans ce cas : onglet **PORTS** de l'éditeur → clic droit sur la
ligne 3000 → la retirer → « Transférer un port » → 3000.

## Ce qui a été corrigé

**Le port n'était demandé qu'une fois.** Ton espace demandait l'ouverture du
port au démarrage ; dès que GitHub répondait « c'est fait », il n'y revenait
plus de la session. Or « c'est fait » ne veut pas dire « ça marche encore » : le
port peut se perdre en cours de route, et c'est ce qui s'est produit.

Il **remesure** maintenant, toutes les cinq minutes, depuis l'adresse que tu
tapes sur ton téléphone. S'il ne s'atteint plus, il redemande.

**Ta fiche d'état se contredisait**, aussi, sur deux lignes voisines : « le
serveur ne répond pas » juste au-dessus de « c'est le port ». Elle t'envoyait
régler une visibilité qui n'aurait rien réparé. Elle nomme désormais la seule
cause mesurée — et le téléchargement que tu vois.

## Ce qui a été vérifié, plutôt que supposé

| | |
|---|---|
| le code de `main` se construit | **oui**, ici, sans une erreur |
| ta construction | **interrompue**, pas cassée : ni mémoire ni disque en cause |
| le correctif du veilleur | **joué pour de bon**, pas relu : un vrai veilleur, un vrai serveur, une sonde qui refuse |

Rien n'était cassé dans l'application.

## Ce que j'avais d'abord dit, et qui était incomplet

Ta fiche de 23 h 46 (heure de Paris) montrait un espace sans serveur, figée
depuis 82 minutes : j'en ai conclu un espace éteint. C'était vrai de cet
instant-là, et ça ne l'était plus une heure plus tard, quand la fiche est
repartie en montrant un espace debout et un port perdu. C'est cette seconde
lecture qui a donné la vraie cause.

## Ce qui n'est pas réparé, et qui ne peut pas l'être

Un espace GitHub se met en veille tout seul après un moment sans activité.
**L'application ne peut pas rester debout pendant que tu dors.** Ce banc sert à
essayer ; ce n'est pas un hébergement.

Ce que tu peux régler toi-même si les mises en veille te gênent : GitHub →
Settings → Codespaces → « Default idle timeout », jusqu'à quatre heures. Cela ne
couvre pas une nuit, mais cela évite qu'il s'éteigne pendant que tu es sur un
chantier.

Et si le relais a perdu le port pour de bon, la remesure le constate mais ne
sait pas le réenregistrer : c'est le geste de l'onglet PORTS ci-dessus.

## Où c'est écrit dans le dépôt

- `ARCHITECTURE.md` §215 — le raisonnement complet et les pièges
- `HANDOVER.md` — la signature « téléchargement au lieu de la page »
- `scripts/port-joignable.mjs`, `.devcontainer/veiller.sh` — la remesure
- `scripts/test-port-remesure.ts`, `scripts/test-verdict-port.ts`,
  `scripts/test-ouvrir-port.ts` — les contrôles, vus rouges contre l'ancienne
  version avant d'être crus
