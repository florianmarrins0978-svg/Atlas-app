# Le test d'intrusion du 27 octobre 2026 — en clair

## Ce qu'on a fait

On a essayé de pirater Atlas, pour de vrai. Pas en lisant le code pour dire « ça a l'air bien » —
en créant deux fausses entreprises, A et B, et en essayant, depuis le compte de A, de lire les
clients, les devis, les factures, les photos de chantier de B. C'est exactement ce qui se
passerait si un artisan malveillant, ou quelqu'un qui aurait volé un mot de passe, essayait
d'espionner un autre artisan sur Atlas.

## Ce qu'on a trouvé

**Une vraie faille, et elle est corrigée.**

La page qui envoie les photos et les enregistrements vocaux aux artisans avait un trou : dans
certaines conditions particulières, une entreprise aurait pu recevoir la photo d'un chantier d'une
autre entreprise.

**Bonne nouvelle : ce n'était pas exploitable aujourd'hui, sur l'application que vous utilisez.**
Les conditions qui l'auraient rendu possible n'existent pas encore chez vous — elles n'arriveraient
que si quelqu'un configurait mal votre futur hébergement, ou se trompait sérieusement en
maintenance. Mais le principe de base de ce genre d'application, c'est d'avoir **deux serrures**
sur chaque porte, pas une seule — comme on l'avait déjà fait pour le logo de l'entreprise après un
problème similaire en août. Ici, il manquait la deuxième serrure sur les photos et les
enregistrements vocaux. Elle est posée maintenant.

## Ce qu'on a vérifié, et qui tient bon

- **Les clients, devis, factures, chantiers** d'une entreprise ne sont jamais visibles par une
  autre. Testé sur des dizaines de cas différents, pas seulement sur l'écran principal.
- **L'argent** (les paiements de facture) ne peut pas être détourné ou mélangé entre deux
  entreprises, même en forçant la main au système avec des données fabriquées.
- **La connexion** : voler une session (le petit fichier qui garde quelqu'un connecté) ne donne pas
  un accès éternel — se déconnecter coupe vraiment l'accès, partout.
- **L'assistant IA intégré** à Atlas ne peut rien écrire tout seul dans vos données : il propose,
  vous confirmez.
- **Les mots de passe et secrets techniques** ne sont plus écrits en clair dans le code source,
  là où quelqu'un pourrait les lire sur GitHub.

## Ce qui reste à faire, et qui n'est pas urgent

- Une vérification de fond sur d'anciennes données, pour être certain à 100 % qu'aucune ligne
  ancienne ne lie par erreur deux entreprises entre elles (un contrôle neuf empêche déjà que ça se
  reproduise ; il reste à vérifier que ça n'existait pas déjà avant).
- Certains tests ne peuvent se faire que sur un vrai hébergement en production, qui n'existe pas
  encore — ils attendront ce moment-là.

## Ce qu'on vous demande de retenir

On ne vous dira jamais qu'une application est « inviolable » — personne ne peut le garantir
honnêtement. Ce qu'on peut dire : on a essayé, sérieusement, de faire sortir les données d'une
entreprise vers une autre, on a trouvé un vrai trou, on l'a réparé et on a posé un garde-fou pour
qu'il ne revienne jamais sans qu'on le voie.

*Détail technique complet, pour un développeur : `docs/audit-securite-2026-10-27-redteam.md`.*
