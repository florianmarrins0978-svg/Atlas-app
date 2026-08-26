import { z } from "zod";
import type { Outil } from "./types";
import { listerChantiersPourAffichage } from "../../repositories/chantiers";
import { filtrerClientsParNom, normaliserPourRecherche } from "@/lib/recherche-client";

/**
 * Trouver un chantier par le nom de son client — **l'outil qui manquait**.
 *
 * **Sa question du 25 août 2026 :** *« Peux-tu me ressortir le premier devis de
 * M. Bernard ? »* L'assistant a répondu qu'il n'avait *« aucun chantier
 * ouvert »* et lui a demandé d'aller ouvrir la fiche lui-même. Sa réaction :
 * *« c'est justement ça que je veux qu'il soit capable de faire »*.
 *
 * **Le défaut n'était pas dans le modèle, il était dans l'outillage.** Tous les
 * outils de l'assistant partent du chantier COURANT (`ContexteOutil.chantierId`),
 * celui d'où l'on a ouvert le panneau. Ouvert depuis la liste, ce chantier est
 * nul, et chacun refuse tour à tour : il n'avait aucun moyen d'aller de « M.
 * Bernard » vers un dossier.
 *
 * **La règle de recherche est CELLE DE L'ÉCRAN**, pas une seconde façon de
 * comparer deux noms (`src/lib/recherche-client.ts`). Elle ignore la casse et
 * les accents, cherche n'importe où dans la ligne, et accepte les mots dans le
 * désordre — trois pièges tirés de sa propre liste de clients. En écrire une
 * autre ici, c'est promettre à l'assistant de trouver ce que l'écran ne trouve
 * pas, ou l'inverse (`CLAUDE.md` §3).
 *
 * **Et il cherche AUSSI dans le nom du chantier.** Il dit « le chantier de la
 * mairie » aussi souvent qu'il dit un nom de client, et l'assistant doit suivre
 * sa façon de parler plutôt que la colonne où c'est rangé.
 */
export const rechercherChantier: Outil = {
  nom: "RechercherChantier",
  description:
    "Trouve un ou plusieurs chantiers par le nom du client ou le nom du chantier, dans toute " +
    "l'entreprise. À employer dès qu'une question nomme quelqu'un ou quelque chose sans qu'un " +
    "chantier soit ouvert — les autres outils ont alors besoin de l'identifiant qu'il rend.",
  schema: z.object({
    nom: z
      .string()
      .min(1)
      .describe("Le nom cherché, tel que le patron l'a écrit : « Bernard », « mairie »…"),
  }),
  async executer({ ctx }, parametres) {
    const { nom } = parametres as { nom: string };
    const tous = await listerChantiersPourAffichage(ctx);

    // Deux passes plutôt qu'une condition à rallonge : le nom du CLIENT
    // d'abord, parce que c'est ainsi qu'il désigne un dossier neuf fois sur
    // dix ; le nom du chantier ensuite, sans jamais rendre deux fois le même.
    const parClient = filtrerClientsParNom(
      tous.filter((c) => c.clientNom).map((c) => ({ ...c, nom: c.clientNom! })),
      nom
    );
    const mots = normaliserPourRecherche(nom).split(" ").filter(Boolean);
    const parChantier = tous.filter(
      (c) =>
        !parClient.some((d) => d.id === c.id) &&
        mots.every((mot) => normaliserPourRecherche(c.nom ?? "").includes(mot))
    );

    const trouves = [...parClient, ...parChantier];
    if (trouves.length === 0) {
      // **On rend le vide en le DISANT, jamais une erreur.** Un outil qui lève
      // laisse le modèle inventer une explication ; une réponse qui dit « rien
      // ne s'appelle ainsi » le laisse proposer la bonne suite — redemander
      // l'orthographe, ou lister ce qui existe.
      return { trouves: [], phrase: `Aucun chantier ni client ne porte le nom « ${nom.trim()} ».` };
    }

    return {
      trouves: trouves.slice(0, 10).map((c) => ({
        chantierId: c.id,
        chantierNom: c.nom,
        clientNom: c.clientNom ?? null,
        adresse: c.adresseChantier ?? null,
        // La date du dernier geste : c'est elle qui distingue deux chantiers du
        // même client, et c'est ce qu'il regarde pour dire « celui d'avant ».
        derniereActivite: c.majAt instanceof Date ? c.majAt.toISOString().slice(0, 10) : null,
      })),
      // Dit quand la liste a été coupée : sans cela, l'assistant affirmerait
      // qu'il n'y en a que dix.
      ...(trouves.length > 10 ? { autresNonListes: trouves.length - 10 } : {}),
    };
  },
};
