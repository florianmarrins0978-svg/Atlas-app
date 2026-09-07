"use server";

import { exigerEcran } from "@/server/garde-action";
import { getCurrentCtx } from "@/server/session-ctx";
import { getChantier, reprendreChantier } from "@/server/repositories/chantiers";
import { trouverOuCreerClient, mettreAJourClient, type CanalClient } from "@/server/repositories/clients";
import { nomDuChantier } from "@/lib/nom-chantier";
import type { Civilite } from "@/lib/civilite";
import { jourIso } from "@/lib/jour";
import { revalidatePath } from "next/cache";

/**
 * Enregistrer les coordonnées d'un chantier QUI EXISTE.
 *
 * **Sa demande du 17 août 2026 :** *« lorsque s'affiche Adresse non renseignée,
 * je puisse cliquer dessus et que ça m'amène sur la page […] rien de plus, rien
 * de moins »*. L'écran d'arrivée est celui de la création
 * (`FormulaireNouveauChantier`), rouvert sur un chantier existant — et cette
 * action est le second chemin qu'il lui fallait, `creerChantierAction` ne
 * sachant qu'insérer.
 *
 * **CE QUI EST REPRIS DE LA CRÉATION, MOT POUR MOT, ET POURQUOI IL LE FAUT.**
 * Trois règles vivent dans `creerChantierAction` et se retrouvent ici à
 * l'identique — le canal sans sa coordonnée, l'adresse du client qui reprend
 * celle du chantier, le nom déduit. Les réécrire autrement ferait deux écrans
 * qui enregistrent différemment la même saisie ; le patron, lui, verrait une
 * application qui « ne garde pas pareil » selon la porte d'entrée.
 *
 * **UN REFUS SE REND EN VALEUR, JAMAIS EN EXCEPTION.** Le message d'une
 * exception levée par une action serveur n'atteint jamais son écran : Next.js
 * le remplace en production par un identifiant opaque, et son banc sert une
 * version bâtie (`AGENTS.md`). Ce qui peut être refusé se dit donc en clair.
 */
export type ReprendreChantierInput = {
  nomClient?: string;
  civilite?: Civilite;
  telephone?: string;
  email?: string;
  canal?: CanalClient;
  adresseChantier?: string;
  adresseClient?: string;
};

export type ResultatReprise =
  | { ok: true }
  | { ok: false; raison: string };

export async function reprendreChantierAction(
  chantierId: string,
  data: ReprendreChantierInput
): Promise<ResultatReprise> {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/chantiers", "corriger les coordonnées du client");

  try {
    const chantier = await getChantier(ctx, chantierId);
    if (!chantier) {
      return { ok: false, raison: "Ce chantier n'existe plus. Revenez à la liste." };
    }

    const nomClient = data.nomClient?.trim();
    const telephone = data.telephone?.trim() || undefined;
    const email = data.email?.trim() || undefined;

    // Un canal sans la coordonnée correspondante est un cul-de-sac : l'envoi
    // s'annoncerait possible puis échouerait au dernier moment. Même règle
    // qu'à la création.
    const canal =
      data.canal === "sms" && telephone
        ? "sms"
        : data.canal === "email" && email
          ? "email"
          : undefined;

    // « Si différente de l'adresse du chantier » — alors identique par défaut.
    // C'est ce que l'écran promet sous ce champ, et le patron l'a lu ainsi.
    const adresseDuClient = data.adresseClient?.trim() || data.adresseChantier?.trim() || undefined;

    let clientId: string | null | undefined;
    if (nomClient) {
      if (chantier.clientId) {
        // **On MET À JOUR, on ne recrée pas.** Recréer laisserait derrière un
        // client orphelin, et les devis déjà partis pointent sur celui-ci.
        await mettreAJourClient(ctx, chantier.clientId, {
          nom: nomClient,
          civilite: data.civilite ?? null,
          telephone: telephone ?? null,
          email: email ?? null,
          canalCommunication: canal ?? null,
          adresse: adresseDuClient ?? null,
        });
      } else {
        // **Le cas de sa capture : un chantier SANS client du tout.** C'est le
        // nom qui crée la fiche — sans lui, aucun client n'est rattaché.
        //
        // **RETROUVÉ PLUTÔT QUE RECRÉÉ, et c'est SA règle du même jour :**
        // *« si c'est monsieur Martins et qu'on a déjà une fiche client
        // monsieur Martins, le devis, la facture s'ajoute à la fiche de
        // monsieur Martins »* (`ARCHITECTURE.md` §122). Passer par `creerClient`
        // ici aurait fabriqué le doublon que l'autre porte vient précisément
        // d'apprendre à éviter — et le patron aurait vu deux fiches Martins
        // selon qu'il a rempli le chantier à sa création ou après coup.
        const { client } = await trouverOuCreerClient(ctx, {
          nom: nomClient,
          civilite: data.civilite,
          telephone,
          email,
          canalCommunication: canal,
          adresse: adresseDuClient,
        });
        clientId = client.id;
      }
    }

    // **LE NOM SE RECALCULE, SINON LA LIGNE NE CHANGE PAS.** C'est le défaut
    // qu'il a signalé : « Chantier du lundi 17 août » est le nom fabriqué faute
    // de client ET d'adresse. Le laisser tel quel corrigerait la donnée partout
    // sauf à l'endroit d'où il est parti.
    //
    // **La date employée est celle de la CRÉATION du chantier**, jamais
    // aujourd'hui : un chantier ouvert le 17 et repris le 20 ne doit pas se
    // renommer « Chantier du jeudi 20 août ». Il ne se reconnaîtrait plus.
    const nom = nomDuChantier({
      nomClient,
      civilite: data.civilite,
      adresseChantier: data.adresseChantier,
      jour: jourIso(chantier.createdAt),
    });

    const repris = await reprendreChantier(ctx, chantierId, {
      nom,
      adresseChantier: data.adresseChantier,
      clientId,
    });
    if (!repris) {
      return { ok: false, raison: "Ce chantier n'existe plus. Revenez à la liste." };
    }

    // L'accueil porte la ligne qu'il vient de corriger : sans cela il
    // retrouverait « Adresse non renseignée » après avoir enregistré, et
    // croirait le geste sans effet.
    revalidatePath("/");
    // **Cet écran-ci, et plus la fiche du chantier** (4 septembre 2026,
    // `ARCHITECTURE.md` §254) : `/chantiers/[id]` ne rend plus qu'une
    // redirection, et revalider une redirection ne rafraîchit rien.
    revalidatePath(`/chantiers/${chantierId}/coordonnees`);
    return { ok: true };
  } catch (erreur) {
    // **Rendre le défaut bavard AVANT de le corriger** (`AGENTS.md`) : sans
    // cette ligne, un refus de la base se présenterait au patron comme un
    // « réessayez » que personne ne pourrait expliquer.
    console.error("[coordonnées] chantier non repris", erreur);
    return { ok: false, raison: "Impossible d'enregistrer pour l'instant. Réessayez." };
  }
}
