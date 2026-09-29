# Le message du devis

29 septembre 2026. Branche `claude/message-du-premier-envoi`, **pas sur `main`**.

## Ce que tu as demandé

> « Vérifie vraiment que si je décoche la possibilité de laisser le client me proposer une date, le message qu'il voit ne contient pas la mention : si aucune des dates proposées… »

> « Garde avec la date, tu peux coder ça. Modifie aussi les messages pré-écrits dans les paramètres, faut que ça soit le message par défaut celui-là. »

## Ce qui a été vérifié, dans un vrai navigateur

| Case « autre date » décochée | Avant | Maintenant |
|---|---|---|
| la page du devis du client | juste | juste |
| le SMS ou l'e-mail | **faux** : la phrase partait | corrigé |

**Trouvé en vérifiant** : au premier envoi, ton client recevait toujours le texte d'Atlas, **même si tu avais écrit le tien dans Réglages**. Seule la relance le prenait. Corrigé.

## Ce que ton client lit maintenant

> Bonjour Mme Larousse,
>
> Voici votre devis. Vous pouvez le consulter et choisir votre date d'intervention. Et si aucune des dates proposées ne vous convient, vous pouvez en proposer une autre. Tout se fait sur cette page :
>
> https://…
>
> Ce lien est valable 45 jours, jusqu'au vendredi 13 novembre. Passé ce délai, vous ne pourrez plus répondre depuis ce lien : il faudra appeler Eden Nature.
>
> Bien à vous,
> Eden Nature

Case décochée, la phrase « Et si aucune des dates… » disparaît.

## Dans Réglages

| | |
|---|---|
| le message par défaut du devis | c'est celui du dessus |
| la phrase « autre date » et la ligne des 45 jours | en doré, comme ce qu'Atlas remplit tout seul |
| la ligne des 45 jours | ne peut pas être retirée, comme le lien |
| ton message déjà réécrit | mis à jour tout seul : la phrase « autre date » suit la case si tu l'avais gardée mot pour mot, et la ligne des 45 jours s'ajoute sous le lien |

**Ce que la mise à jour ne fait pas** : si tu avais reformulé la phrase « autre date » avec tes mots, elle reste telle quelle. C'est ton texte.

## Les preuves

| Contrôle | Résultat |
|---|---|
| `test-message-sans-autre-date-e2e` : deux devis envoyés à l'écran, case cochée puis décochée | **rouge sur l'ancien code**, vert maintenant |
| `test-message-du-premier-envoi-e2e` : ton message dans Réglages, puis « Envoyer le devis » | **rouge sur l'ancien code**, vert maintenant |
| `test-migration-0115-base-habitee` : la mise à jour de tes messages, sur une base qui en contient | vert, et vu **rouge** contre une migration vide |
| `test-message-au-client`, `test-envoi-client`, `test-transmission`, `test-suivi-devis`, `test-barre-enregistrer` | verts |
| `test-message-client`, `test-lien-cliquable`, `test-etat-envoi`, migrations, types, lint, pansements, code mort, couches, tirets, flèches | verts |
| l'écran Réglages, regardé | les morceaux dorés passent à la ligne proprement |

**Corrigé noir sur blanc** : un ancien test exigeait qu'aucun « pourrez » n'apparaisse dans le message. Ta phrase des 45 jours en contient un, à juste titre. Le test garde sa règle sur la phrase qui propose la date, et seulement là.

## Ce qui n'a pas été fait

**La batterie entière**, tu l'as interdite. Le lot est de niveau 3 (une migration, et le devis) : elle est obligatoire avant `main`.

## Ce qui reste ouvert

| Question | Qui tranche |
|---|---|
| Quand jouer la batterie pour le mettre sur `main` | toi |
