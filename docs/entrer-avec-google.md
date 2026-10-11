# Entrer avec Google : ce qu'il reste à faire, et par qui

**Qui : vous.** Personne d'autre ne peut le faire — cela se crée depuis un
compte Google, et cela engage votre entreprise auprès de Google.

**Ce que ça coûte : rien.** Une quinzaine de minutes, une fois.

---

## Pourquoi les boutons ne s'affichent pas

L'écran de connexion est fini, et il est exactement celui de la maquette. Les
boutons **Google** et **Apple** n'apparaissent que lorsque les clés de chaque
marque sont posées sur votre espace de travail.

C'est délibéré : un bouton qui ne peut pas aboutir est pire qu'un bouton
absent. On appuie, on tombe sur une page d'erreur, et l'on croit
l'application cassée — le pire endroit pour ça étant le seul écran qu'on voit
avant d'être entré.

| | |
|---|---|
| **Google** | gratuit — les quatre étapes ci-dessous |
| **Apple** | **compte développeur payant, 99 $/an.** Le bouton reste absent tant qu'il n'existe pas |

---

## Les quatre étapes, chez Google

1. **console.cloud.google.com** → créer un projet (ou reprendre celui de
   l'agenda, si vous l'avez déjà ouvert).
2. **Écran de consentement** : type « Externe », le nom de l'application, votre
   adresse d'assistance. Rien d'autre pour l'instant.
3. **Identifiants → Créer → ID client OAuth → Application Web.**
4. Dans **URI de redirection autorisés**, coller l'adresse que votre espace
   affiche au démarrage. Elle ressemble à :

   ```
   https://<votre-espace>-3000.app.github.dev/api/auth/callback/google
   ```

   **Elle s'affiche toute faite** dans le terminal de votre espace, au
   démarrage, juste après la ligne « IA ». Copiez-la de là plutôt que de la
   retaper : Google la compare au caractère près, et un caractère de travers
   donne un refus qui ne dit pas pourquoi.

Google rend alors deux valeurs : un **ID client** et un **secret client**.

---

## Où les coller

Le fichier **`.env.local`**, à la racine du projet, dans votre espace de
travail. Les deux lignes y sont déjà, vides :

```
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
```

Collez après le signe `=`, enregistrez, puis **rechargez la page de
l'éditeur**. Au démarrage suivant, le terminal dit « Entrer avec Google :
branché », et les deux boutons sont sur l'écran de connexion.

**Les deux lignes, ou aucune.** Un identifiant sans son secret ne mène nulle
part : le bouton reste absent tant que les deux ne sont pas remplies.

---

## Ce qui se passe ensuite, et qui peut surprendre

**Entrer par Google ne crée pas de compte Atlas.** Qui appuie sur Google sans
avoir de compte ici est envoyé sur la création de compte, son adresse déjà
remplie. C'est voulu : un compte créé au vol n'aurait ni entreprise, ni forme
juridique, ni TVA — le premier devis serait impossible à émettre, et vous le
découvririez devant un client.

**Tant que Google n'a pas validé l'application**, l'accès reste limité à une
centaine de comptes de test. Cela suffit largement pour vous et vos essais ;
cela ne suffira pas le jour où Atlas sert d'autres artisans. C'est le point 8
de [`A-FAIRE.md`](A-FAIRE.md), et il demande des semaines — à ouvrir bien
avant de commercialiser.

---

**Ce qui n'a pas pu être vérifié d'ici, et qui doit l'être par vous :** les
libellés exacts de la console Google. Le réseau de l'environnement de
développement refuse les pages de Google, donc ces quatre étapes viennent de
la documentation, pas d'un écran regardé. Si un intitulé diffère, c'est la
console qui a raison.
