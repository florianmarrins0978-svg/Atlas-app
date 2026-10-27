# Comment j'ai essayé de pirater Atlas — le récit complet

## Pourquoi j'ai fait ça

Tu m'as demandé de me mettre à la place d'une personne malveillante qui a un compte normal sur
Atlas pour son entreprise, et qui essaie d'aller voir ou de modifier les informations d'une autre
entreprise qui n'est pas la sienne — ses clients, ses devis, ses factures, ses photos de chantier.
Le but : trouver les trous avant qu'un vrai pirate ne les trouve.

## Comment j'ai procédé, étape par étape

**1. J'ai préparé un terrain d'essai, séparé de tes vraies informations.**
Je n'ai jamais touché à ta vraie application ni à tes vraies données. J'ai monté, sur une machine
de travail à part, une copie du logiciel avec une réserve de données entièrement fausses — un peu
comme un mannequin d'entraînement pour les pompiers : on s'exerce sur une maison qu'on peut brûler
sans risque.

**2. J'ai créé deux fausses entreprises.**
Une entreprise « A », avec un compte normal, et une entreprise « B », avec ses propres clients, son
propre chantier, sa propre photo. Les deux sont complètement indépendantes, comme deux clients
différents d'Atlas qui ne se connaissent pas.

**3. Je me suis connecté comme l'entreprise A, et j'ai essayé d'atteindre ce qui appartient à B.**
Pas en lisant les instructions du logiciel pour deviner si ça marcherait — en essayant pour de
vrai, avec une vraie connexion, comme le ferait quelqu'un sur son téléphone. J'ai essayé de :
- lire la liste des clients de B ;
- ouvrir les devis et les factures de B ;
- voir les photos et les enregistrements vocaux des chantiers de B ;
- modifier ou effacer des informations de B ;
- créer de nouvelles informations qui se seraient rattachées à B sans son accord ;
- toucher à l'argent de B (ses paiements, ses factures).

**4. J'ai rejoué plus de cinq cents petites vérifications déjà existantes dans l'application.**
Beaucoup de ces vérifications avaient déjà été écrites par de précédents travaux, justement pour
s'assurer que deux entreprises ne se mélangent jamais. Plutôt que de faire confiance à ce qui était
écrit, je les ai toutes rejouées pour de vrai, une par une, pour voir si elles tenaient encore.

**5. J'ai suivi le chemin de l'argent, pas à pas.**
Quand un client paie une facture, j'ai vérifié, ligne par ligne dans le fonctionnement du logiciel,
qu'il était impossible de faire croire qu'un paiement de l'entreprise B appartenait à l'entreprise
A, même en fabriquant une demande truquée.

**6. J'ai testé l'assistant qui écoute et qui répond.**
L'assistant intégré à Atlas (celui qui aide à préparer un devis à la voix, par exemple) ne doit
jamais écrire quoi que ce soit tout seul dans les données d'un artisan sans qu'il ait dit oui. Je
l'ai vérifié.

**7. J'ai testé la connexion et la déconnexion.**
Si quelqu'un vole la session de connexion d'un artisan (un peu comme voler le trousseau de clés
qu'il laisse dans sa poche), est-ce que se déconnecter coupe vraiment l'accès ? Oui, vérifié.

**8. J'ai regardé comment le logiciel est fabriqué et mis en ligne.**
Pas seulement l'application elle-même, mais aussi les outils qui servent à la construire et à la
publier, pour voir si quelqu'un de mal intentionné pourrait s'y glisser au moment de la fabrication
plutôt que d'attaquer l'application directement.

**9. J'ai vérifié qu'aucun mot de passe technique n'était visible publiquement.**
Deux petits secrets techniques (pas tes mots de passe, des clés internes au logiciel) étaient
écrits en clair dans le dossier du projet, visible par n'importe qui qui aurait regardé. Je l'ai
corrigé.

## Ce que j'ai trouvé, et ce qui est réparé

**Un vrai problème, trouvé en essayant pour de vrai, pas en lisant le code.**

La partie du logiciel qui envoie les photos de chantier et les enregistrements vocaux avait un
défaut : dans certaines conditions bien particulières, elle aurait pu envoyer à l'entreprise A une
photo qui appartenait à l'entreprise B, au lieu de refuser.

Je l'ai découvert en faisant exactement ce scénario : connecté comme A, j'ai demandé la photo de B,
et je l'ai reçue — alors que, pour une autre information du même genre (le logo de l'entreprise),
le refus arrivait bien.

**Ce n'était pas dangereux aujourd'hui, sur ton application réelle.** Les conditions qui auraient
permis ce problème n'existent que dans certaines situations particulières, qui ne sont pas celles
de ton application telle qu'elle tourne actuellement. Mais ce genre de protection doit toujours
avoir une deuxième barrière de sécurité en plus de la première, un peu comme une porte avec deux
serrures plutôt qu'une — exactement ce qu'on avait déjà fait pour le logo après un problème
similaire trouvé en août. Ici, cette deuxième serrure manquait pour les photos et les
enregistrements vocaux.

**C'est corrigé**, et j'ai ajouté une vérification permanente qui refusera désormais tout
changement de code qui referait apparaître ce défaut sans qu'on le voie.

**Les deux petits secrets techniques visibles publiquement** sont également corrigés : ils sont
maintenant générés automatiquement et gardés privés, au lieu d'être écrits en clair dans le projet.

## Ce qu'une autre de tes sessions avait déjà réglé, pendant que je travaillais

Sans qu'on le sache l'un de l'autre, une autre session que tu avais lancée en même temps que moi
travaillait sur une partie des mêmes sujets. Elle a déjà réglé, de son côté :
- un verrouillage supplémentaire sur les liens entre certaines informations de différentes
  entreprises ;
- la décision, réfléchie et justifiée, de NE PAS faire expirer certains liens envoyés par e-mail
  (un contrat, un compte-rendu de visite), parce que ça empêcherait un client de retrouver
  son propre document plus tard ;
- un renforcement des outils de fabrication et de publication du logiciel.

Son travail et le mien ont été réunis en un seul ensemble cohérent, sans rien garder en double.

## Ce qui reste à faire

**Une vérification de fond sur les anciennes informations**, pour être certain à cent pour cent
qu'aucune information créée il y a longtemps ne mélange déjà deux entreprises par erreur. Le
nouveau verrou empêche que ça se reproduise à l'avenir ; il reste à vérifier que ça n'existait pas
déjà avant, dans les informations les plus anciennes.

**Des vérifications qu'on ne peut faire que lorsque l'application sera vraiment installée chez un
hébergeur réel**, ce qui n'est pas encore le cas aujourd'hui : la façon dont l'accès à internet sera
protégé, par exemple.

**Un essai avec une vraie intelligence artificielle connectée.** Sur la machine où j'ai travaillé,
je n'avais pas la clé d'accès à l'intelligence artificielle réelle. J'ai vérifié que le
fonctionnement était sûr en lisant comment il est construit, mais je n'ai pas pu le faire tourner
pour de vrai avec une vraie conversation.

## En résumé

J'ai essayé, sérieusement et pour de vrai, de faire passer des informations d'une entreprise vers
une autre sur Atlas. J'ai trouvé un vrai problème, je l'ai réparé, et j'ai posé un garde-fou pour
qu'il ne revienne pas sans qu'on le voie. Tout le reste de ce que j'ai essayé a tenu bon. Je ne te
dirai jamais que l'application est totalement impossible à pirater — personne ne peut le garantir
honnêtement — mais elle est aujourd'hui plus solide qu'avant cette vérification.
