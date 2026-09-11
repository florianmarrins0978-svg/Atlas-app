# La facture téléchargée s'ouvrait blanche — ce qui a été trouvé

**11 septembre 2026.** Troisième capture sur le même geste : *« lorsque je
télécharge la facture je ne peux toujours pas la lire »*.

---

## Ce qui a été mesuré, et avec quoi

| Ce qui a été regardé | Le verdict |
|---|---|
| Le fichier est-il abîmé ? | **Non.** Recomposé ici à l'identique (64 ko, même poids que le vôtre) |
| Un lecteur indépendant l'ouvre-t-il ? | **Oui**, trois : `pypdf`, `qpdf`, et PDFium — le moteur de Chrome |
| Le document est-il dessiné ? | **Oui**, entier : en-tête, tableau, totaux, mention légale |
| Le fichier est-il conforme à la norme ? | **NON** — et c'est là qu'est le défaut |

## Le défaut

Depuis le 8 septembre, vos documents embarquent une vraie typographie. Le
fichier de police est écrit dans le PDF **sans dire combien il pèse**.

La norme du format (ISO 32000-1, tableau 127) l'exige : l'entrée s'appelle
`/Length1`, et c'est ce qu'un lecteur regarde avant de charger la police. La
bibliothèque qui compose nos PDF ne l'écrit jamais — vérifié, aucune occurrence
dans tout son code.

| Le lecteur | Ce qu'il fait |
|---|---|
| Chrome, Acrobat | il mesure le fichier lui-même, et affiche |
| **un lecteur strict** | il refuse la police |

Tout le texte du document emploie cette police. Refusée, il ne reste que la
page — blanche, sans message. **La typographie est arrivée le 8 septembre ; la
première page blanche, le 10.**

## Ce qui a été fait

`src/server/pdf/polices-embarquees.ts` pose l'entrée entre la composition et le
scellé du document, avec la longueur **mesurée** du fichier de police — jamais
estimée. Un contrôle la vérifie sur les cinq typographies et rougit si elle
disparaît (`scripts/test-polices-embarquees.ts`).

## Ce qui N'EST PAS prouvé

**Que c'était votre panne.** Ce poste n'a aucun moteur Apple, et les trois
moteurs qu'il a sont justement ceux qui se passent de l'entrée : ils affichaient
déjà le document AVANT la correction. Ce qui est établi : l'entrée manquait, la
norme l'exige, elle est maintenant juste.

**Deux factures identiques vous ont été envoyées** — une avant, une après. Les
ouvrir tranche en dix secondes ce qu'aucun contrôle d'ici ne peut dire.

Si les deux sont blanches, la piste suivante n'est pas le fichier mais son
trajet : le mandataire de l'espace de travail, ou la protection anti-retouche
posée le 31 août — qu'aucun lecteur d'Apple n'a jamais été vu ouvrir ici.

## Ce que cela ne répare pas

**Vos factures déjà arrêtées.** Le lien du client sert le fichier composé au
moment de l'arrêt, jamais un document refait — c'est ce qui garantit que votre
client garde exactement la pièce reçue. Tout ce qui a été composé entre le 8 et
le 11 septembre reste sans l'entrée, F2026-000007 comprise.

Les recomposer est possible et donnerait le même document au pixel près. Mais ce
sont des pièces comptables : **c'est vous qui décidez**, et rien n'a été touché.

## Ce qui avait été dit le 10 septembre, et qui était faux

*« Le type annoncé colle au fichier enregistré, iOS ne reconnaît plus un PDF. »*
La correction (ne plus mentir sur le type d'un fichier) reste juste et utile,
mais elle n'a pas réparé la page blanche — votre capture d'aujourd'hui le
prouve.
