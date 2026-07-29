import { z } from "zod";
import type { Outil } from "./types";
import { getChantier } from "../../repositories/chantiers";
import { getClient } from "../../repositories/clients";
import { listerPhotos } from "../../repositories/photos";

export const lireInformationsChantier: Outil = {
  nom: "LireInformationsChantier",
  description: "Lit les informations générales du chantier courant (nom, adresse, client, jalons, nombre de photos).",
  schema: z.object({}),
  async executer({ ctx, chantierId }) {
    if (!chantierId) return { erreur: "Aucun chantier dans le contexte courant." };
    const chantier = await getChantier(ctx, chantierId);
    if (!chantier) return { erreur: "Chantier introuvable." };
    const client = chantier.clientId ? await getClient(ctx, chantier.clientId) : null;
    const photos = await listerPhotos(ctx, chantierId);
    return {
      nom: chantier.nom,
      adresseChantier: chantier.adresseChantier,
      client: client ? { nom: client.nom, telephone: client.telephone, adresse: client.adresse } : null,
      dureePrevue: chantier.dureePrevue,
      tailleEquipe: chantier.tailleEquipe,
      informationsVerifiees: !!chantier.informationsVerifieesAt,
      prixValide: !!chantier.prixValideAt,
      devisGenere: !!chantier.devisGenereAt,
      devisEnvoye: !!chantier.devisEnvoyeAt,
      datePlanifiee: chantier.datePlanifiee,
      nombrePhotos: photos.length,
    };
  },
};
