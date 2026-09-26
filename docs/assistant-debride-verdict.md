# L'assistant débridé : le verdict

26 septembre 2026. Branche `claude/is-this-normal-6jbxjy`. **Pas encore sur
`main`** : la batterie n'a pas été jouée, sur ta consigne. Rien ne change chez
toi tant qu'elle n'est pas passée.

## Ce que tu as vu

1. « Huguette Groupiron » : *« Il faut au moins un mot du libellé ou un nom de
   client »*, puis *« problème technique, réessayez »*.
2. « Comment je supprime un client ? » : *« L'assistant est momentanément
   indisponible »*, puis *« Je n'ai pas pu appeler l'outil
   RechercherModeEmploi »*, rechargement compris.
3. Refermer l'assistant : il fallait viser une croix minuscule.
4. Ta question : *« pourquoi on dirait qu'il est bridé ? »*

## Le verdict, point par point

| Ce qui le bridait | Verdict | Ce qui est fait | Le fichier |
|---|---|---|---|
| Il ne connaissait pas le nom des champs de 18 outils sur 21 | **défaut réel** | les champs se lisent dans la définition de chaque outil | `src/server/ai/providers/llm/schema-outils.ts` |
| Il ne lisait qu'une recherche par tour | **défaut réel** | il en fait plusieurs d'un coup | `interface.ts`, `anthropic.ts`, `openai.ts`, `assistant-service.ts` |
| Un outil appelé deux fois faisait tomber toute la question | **défaut réel, trouvé en cherchant** | chaque recherche garde son identifiant | les mêmes |
| Ses réponses étaient coupées vers 700 mots | **défaut réel** | quatre fois plus de place | `anthropic.ts`, `openai.ts` |
| Il ne voyait ni les factures, ni les paiements, ni les impayés | **oubli** | outil `LireFactures` | `src/server/ai/tools/lire-factures.ts` |
| Il ne voyait ni l'équipe, ni les absences | **oubli** | outil `LireEquipes` | `lire-equipes.ts` |
| Il ne voyait pas les rappels | **oubli** | outil `LireRappels` | `lire-rappels.ts` |
| Il ne voyait pas les diagnostics | **oubli** | outil `LireDiagnostics` | `lire-diagnostics.ts` |
| La croix pour fermer | **ton choix : la A** | toucher le gris ferme, croix ronde de 44 px | `src/components/atlas/AssistantSidebar.tsx` |

## Ce qui a été corrigé en cours de route

**Mon premier diagnostic était faux.** Je t'avais dit que « momentanément
indisponible » venait sans doute d'une page restée ouverte pendant un
redémarrage. En relisant le code, j'ai trouvé une cause plus sûre : quand
l'assistant se reprenait après une erreur, il rappelait le même outil sous le
même identifiant, et Anthropic refuse ce doublon. Toute la question tombait
alors. C'est corrigé, et un test le prouve : il échoue sur l'ancien code.

**En regardant l'écran, un défaut que personne n'avait vu.** Une fois le
panneau réduit pour laisser le gris visible, le bouton d'envoi sortait de
l'écran : le champ de saisie refusait de rétrécir. Le même défaut aurait
touché tout téléphone de moins de 384 px. Corrigé, et regardé sur trois
largeurs : 320, 390 et 430 px.

## Ce qui a été fait autrement

**Pas « tout dans sa mémoire » à chaque question.** Lui donner toutes tes
données d'un coup serait lent, cher, et il s'y perdrait. Chaque partie de
l'application a maintenant son outil de lecture, et il va chercher ce dont il
a besoin.

**Les montants ne sortent jamais de sa tête.** Le reste dû et le total
viennent de l'écran « En attente », au centime. Un modèle qui additionne
trente montants se trompe, et c'est ce chiffre qu'on répète au client.

**Un diagnostic n'est jamais « confirmé » par lui.** L'outil lui donne ce qu'il
faut pour confirmer (une analyse en laboratoire, par exemple), comme l'écran.

## Ce qui a été refusé, et pourquoi

| Refusé | Ce que ça aurait coûté |
|---|---|
| Le laisser écrire seul | ta règle du 26 août : il prépare, c'est toi qui appuies |
| Retirer le filtre « hors métier » | ta demande du 26 août ; il laisse passer toutes les questions de métier essayées |
| Lui donner les accès et les rôles des comptes | c'est de la sécurité, pas du métier : à décider par toi |

## Les chiffres

Aucune batterie, sur ta consigne. Joués ici, dans mon conteneur, un par un :

| Suite | Résultat |
|---|---|
| `test-schema-outils` | vert (rouge sur 18 outils avant) |
| `test-appel-fournisseurs-ia` | vert (5 rouges sur l'ancien code) |
| `test-assistant-lit-factures-db` | vert, 6 cas, dont l'isolation entre entreprises |
| `test-assistant-lit-equipes-rappels-diagnostics-db` | vert, 6 cas, dont l'isolation |
| `test-assistant-se-corrige`, `test-ia-02-assistant`, `test-assistant-explique-l-appli`, `test-assistant-perimetre` | verts |
| `test-agent-gestes`, `test-ia-03` à `test-ia-08`, `test-analyse-dictee`, `test-copier-ligne-devis` | verts |
| `test-diagnostic-base`, `test-rappels-db` | verts |
| types, lint, pas de pansement, pas de code mort, couches | verts |

## Ce qui reste ouvert

| Quoi | Qui |
|---|---|
| La batterie complète, puis l'envoi sur `main` | **toi** : dis quand la lancer |
| Une vraie conversation avec l'IA : ce poste n'a pas de clé | **toi**, sur ton espace, une fois livré : « Huguette Groupiron », « qui me doit de l'argent », « qui est absent la semaine prochaine » |
