# Lot du 20 novembre 2026 : le prix d'une pièce, la marge en pour cent, les fournisseurs

Sur `main` le 20 novembre 2026. Batterie jouée une seule fois pour tout le lot, comme il l'a demandé.

## Ce qui est livré

| Point | Verdict | Où |
|---|---|---|
| Le nom du partenaire retiré de la ligne du devis | fait | `src/lib/feuille-main-oeuvre.ts`, `ARCHITECTURE.md` §592 |
| La marge en %, 0 % sans marge, case vide « Marge à donner » | fait, sans migration (la base garde le coefficient) | `src/lib/prix-achat.ts`, §593 |
| Le prix d'une pièce dans la recherche de Ce que je paie | fait | §593 |
| Sous une ligne tapée à la main, ses prix d'achat, le moins cher d'abord | fait (migration 0188) | §593 |
| « ml » à côté de « m » | fait | `auMetreLineaire` |
| Planche 1 : un fournisseur se crée depuis son devis | fait (migration 0189) | §594 |
| Planche 2 : le fournisseur reste écrit sous une ligne dictée | fait | §595 |
| Le commercial voit les prix d'achat sur le devis qu'il rédige | fait | `peutGererDevis`, §593 |

Le client ne voit jamais un fournisseur : ni sur le PDF, ni sur sa page, ni dans l'export de ses données. Les mentions ont été vérifiées sous trois rôles. Le patron et le commercial les voient. Le salarié ne voit rien.

## Ce qui a été fait autrement, et pourquoi

- **La mention du fournisseur n'est jamais prise depuis l'écran.** Le serveur la recalcule lui-même. Un navigateur ne peut donc pas écrire un faux fournisseur sous une ligne.
- **Trouvé en codant.** Le devis dicté chiffrait des sacs de terreau au prix du ciment, parce que le mot « sac » comptait autant que « terreau ». Les mots d'emballage ne suffisent plus à rapprocher deux pièces.

## La batterie

| Étape | Résultat |
|---|---|
| Types, lint, mémoire, construction, connexion derrière un proxy | vert |
| Suites base | 1 rouge |
| Suites navigateur | 216 sur 217 |

Les deux rouges cherchaient encore le nom du partenaire sur la ligne, alors que ce lot le retire, à sa demande. Le produit était juste. Ce sont ces deux contrôles qui ont été corrigés : ils vérifient maintenant que le nom n'apparaît pas. Les rouges et leur rencontre ont été rejoués : 612 sur 612, verts.

## Ce qui reste ouvert

- **Le fournisseur peut être nommé à tort, au micro.** Cela arrive quand sa grille donne, au centime près, le même prix que l'achat avec la marge. Le cas est rare et décrit dans §595. Il est à trancher par nous, si le cas se présente.
- **La lecture réelle de l'en-tête d'un devis fournisseur n'a pas pu être vérifiée ici,** faute de clé d'IA. Elle est à essayer sur ton espace : dépose le devis d'un fournisseur dans Ce que je paie.
