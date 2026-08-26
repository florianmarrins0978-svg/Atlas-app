import { z } from "zod";
import type { Outil } from "./types";
import { creerChantier as creerChantierEnBase, listerChantiersPourAffichage } from "../../repositories/chantiers";
import { trouverOuCreerClient } from "../../repositories/clients";
import { nomDuChantier } from "@/lib/nom-chantier";
import { filtrerClientsParNom } from "@/lib/recherche-client";

/**
 * Ouvrir une fiche chantier pour un client — **le seul outil qui ÉCRIT**.
 *
 * ─── POURQUOI CETTE EXCEPTION EXISTE, ET CE QU'ELLE NE COUVRE PAS ──────────
 *
 * **Sa demande du 25 août 2026**, sur une capture où l'assistant refuse :
 * *« Crée-moi une nouvelle fiche chantier du nom de Fernandez »* — réponse :
 * *« je ne suis pas en mesure de créer une fiche chantier »*, suivie de trois
 * étapes à faire à la main. Sa réaction : **« Ça aussi il doit pouvoir le
 * faire »**.
 *
 * Jusqu'ici l'assistant ne pouvait qu'écrire des PROPOSITIONS, qu'il confirmait
 * d'un doigt (lot IA-03). Ce mécanisme ne pouvait pas servir ici : une
 * proposition est rangée sous un chantier (`propositions_ia.chantier_id`, non
 * nul), et il s'agit précisément d'en créer un.
 *
 * **L'exception est étroite par construction, et c'est ce qui la rend tenable :**
 *
 * | Ce que cet outil fait | Ce qu'il ne fait pas |
 * |---|---|
 * | ouvre une fiche VIDE pour un client | écrire un prix, une prestation, une durée |
 * | reprend un client existant s'il y en a un | envoyer, valider, facturer quoi que ce soit |
 *
 * Rien n'est inventé : le nom vient de sa phrase. Rien n'est engagé : une fiche
 * vide n'a ni montant ni destinataire, et elle se supprime. Les trois gestes que
 * `CLAUDE.md` §4 réserve à son doigt — envoyer, valider, facturer — restent hors
 * d'atteinte, et le reste des écritures passe toujours par une proposition.
 *
 * ─── DEUX RÈGLES REPRISES, JAMAIS RÉÉCRITES ────────────────────────────────
 *
 * **Un chantier ne se BAPTISE pas** (`src/lib/nom-chantier.ts`, sa demande du
 * 5 août 2026 : *« retire la case nom du chantier »*). Son étiquette se déduit
 * du client, sinon de l'adresse, sinon du jour. « Une fiche du nom de
 * Fernandez » veut donc dire « une fiche pour le client Fernandez » — et le nom
 * affiché sort de la même fonction que l'écran de création.
 *
 * **Le client se cherche avec la règle de l'écran** (`filtrerClientsParNom`) :
 * il dit « Fernandez » là où sa fiche porte « Mr. Fernandez ». Une comparaison
 * stricte ouvrirait un second dossier au même nom, et il se retrouverait avec
 * deux Fernandez sans savoir lequel porte son historique.
 *
 * ─── ET IL PRÉVIENT AVANT DE DOUBLER ───────────────────────────────────────
 *
 * Si ce client a déjà des chantiers, l'outil les rend **sans rien créer**. Un
 * paysagiste repasse chez les mêmes gens : créer d'office ferait deux fiches
 * pour un même jardin, et c'est le genre de désordre qu'on ne défait plus.
 * `confirmerDoublon` est la seconde intention explicite qui débloque.
 */
export const creerChantierOutil: Outil = {
  nom: "CreerChantier",
  description:
    "Ouvre une nouvelle fiche chantier pour un client, quand le patron le demande explicitement " +
    "(« crée une fiche pour X »). Reprend le client s'il existe déjà. Si ce client a déjà des " +
    "chantiers, ne crée rien et les rend : il faut alors demander au patron s'il veut vraiment " +
    "une fiche de plus, puis rappeler avec confirmerDoublon.",
  schema: z.object({
    client: z
      .string()
      .min(1)
      .describe("Le nom du client, tel que le patron l'a dit : « Fernandez », « Mme Renard »…"),
    adresse: z.string().optional().describe("L'adresse du chantier, si le patron l'a donnée."),
    confirmerDoublon: z
      .boolean()
      .optional()
      .describe("À poser seulement après que le patron a confirmé vouloir une fiche de plus pour ce client."),
  }),
  async executer({ ctx }, parametres) {
    const { client, adresse, confirmerDoublon } = parametres as {
      client: string;
      adresse?: string;
      confirmerDoublon?: boolean;
    };
    const nomClient = client.trim();
    if (!nomClient) return { erreur: "Aucun nom de client : rien à ouvrir." };

    if (!confirmerDoublon) {
      const existants = filtrerClientsParNom(
        (await listerChantiersPourAffichage(ctx))
          .filter((c) => c.clientNom)
          .map((c) => ({ ...c, nom: c.clientNom! })),
        nomClient
      );
      if (existants.length > 0) {
        return {
          cree: false,
          motif: "chantiers_existants",
          phrase:
            `${nomClient} a déjà ${existants.length} chantier${existants.length > 1 ? "s" : ""} dans Atlas. ` +
            "Demandez au patron s'il veut vraiment une fiche de plus avant de rappeler avec confirmerDoublon.",
          chantiers: existants.slice(0, 5).map((c) => ({
            chantierId: c.id,
            chantierNom: c.nom,
            adresse: c.adresseChantier ?? null,
          })),
        };
      }
    }

    // **Le client d'abord, et REPRIS s'il existe.** `trouverOuCreerClient` porte
    // déjà le rapprochement : lui confier ce choix évite un second dossier au
    // même nom, et c'est lui qui saura dire s'il a réutilisé une fiche.
    const { client: fiche, reutilise } = await trouverOuCreerClient(ctx, { nom: nomClient });

    // L'étiquette vient de la MÊME fonction que l'écran de création. Composer
    // « Chantier Fernandez » ici donnerait une seconde règle de nommage, et
    // l'écart se verrait dans sa liste (`CLAUDE.md` §3).
    const nom = nomDuChantier({
      nomClient: fiche.nom,
      civilite: fiche.civilite,
      adresseChantier: adresse ?? null,
      // « AAAA-MM-JJ », comme l'attend la règle : c'est le nom de repli quand
      // ni client ni adresse ne le nomment.
      jour: new Date().toISOString().slice(0, 10),
    });

    const chantier = await creerChantierEnBase(ctx, {
      nom,
      clientId: fiche.id,
      ...(adresse ? { adresseChantier: adresse } : {}),
    });

    return {
      cree: true,
      chantierId: chantier.id,
      chantierNom: chantier.nom,
      clientNom: fiche.nom,
      clientReutilise: reutilise,
      // L'adresse de la fiche, pour que la réponse puisse l'y emmener : sans
      // elle, il aurait créé quelque chose qu'il doit ensuite aller chercher.
      lien: `/chantiers/${chantier.id}`,
    };
  },
};
