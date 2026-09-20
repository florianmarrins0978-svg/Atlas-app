# La première ligne du devis, ouverte d'avance — 20 septembre 2026

**Ta demande :** *« Quand j'ouvre la page du devis il doit avoir une ligne
d'ouverte déjà, je dois pas avoir besoin de cliquer sur ajouter une ligne. »*

## Ce qui est fait

| | |
|---|---|
| **la ligne t'attend** | sur tout devis en brouillon qui n'a encore aucune ligne : tu écris directement |
| **elle ne s'écrit qu'au premier mot** | poser le doigt sur une case puis la quitter n'enregistre rien |
| **elle ne s'ouvre pas** | sur un devis parti, sur un devis déjà rempli, ni pendant qu'une dictée est reprise |

Fichiers : `src/lib/ligne-ouverte-devis.ts` (la règle),
`src/app/chantiers/[id]/devis-complet/DevisCompletClient.tsx` (l'écran).

## Ce qui a été refusé, et ce que ça évitait

**Écrire la ligne vide en base à l'ouverture** — une ligne de code, et la panne
du 7 août revenait : *« le devis ne comporte aucune ligne, gros bug »*. Trois
endroits de l'application lisent « aucune ligne » comme « la dictée n'a pas
encore tourné ». Une ligne vide posée d'office leur aurait menti, et ta dictée
suivante n'aurait plus rien écrit sur ce devis.

## Deux défauts trouvés avant de te livrer

1. **Le prix se perdait.** La rangée changeait d'identifiant au moment où la
   ligne s'enregistrait : la case où tu écris disparaissait sans rendre ce que
   tu venais de taper. Devis à 0,00 €, et la facture d'après avec son bouton
   « Envoyer » éteint. Corrigé à la racine ; trois suites le voyaient rouge.
2. **Deux lignes se croisaient.** Appuyer sur « + Ajouter une ligne » avant
   d'avoir écrit inversait l'ordre des deux lignes au rechargement — l'ordre que
   ton client lit. Corrigé.

Les deux ont d'abord été **vus rouges**, puis corrigés, et les contrôles restent.

## La batterie

| | |
|---|---|
| Types, Lint, Atelier, Construction, Mémoire, IA | ✅ |
| Suites base de données | **398/399** (1 non mesurable ici) |
| Suites navigateur | **162/163** |
| Connexion derrière un proxy | ✅ |

**Le seul rouge : `test-repartir-du-client-e2e`, et il n'est pas de ce lot.**
Rejoué dos à dos sur la base de `main` et sur le lot : **vert des deux côtés**.
Il ne tombe que dans la batterie entière, quand le serveur est chargé, et la
piste est écrite dans `TODO.md` — c'est la suite qui attend une adresse au lieu
d'attendre l'écran.

## Ce qui reste à décider

**La fusion sur `main`.** Le lot est poussé sur sa branche
`claude/devis-pre-open-line-d7urm1` ; tant qu'il n'est pas sur `main`, ton
espace ne le verra pas.
