import type { Ctx } from "./context";
import { creerChantier, planifierChantier } from "./chantiers";
import { porterChantierDansAgenda } from "./agenda-apple";
import { nomDuChantier } from "@/lib/nom-chantier";
import type { JourIso } from "@/lib/disponibilites";
import type { QuandPoser } from "@/lib/planning-jour";

/**
 * POSER UN CLIENT SUR UN JOUR, SANS DEVIS — le geste, écrit une seule fois.
 *
 * **Deux portes y mènent, et une seule façon de poser.** « Un client » depuis
 * le planning (`poserUnClientAction`, sa demande du 10 septembre 2026) part du
 * jour et retrouve ou crée la fiche ; « Le prévoir » depuis la fiche d'un
 * client (l'hivernage, sa planche du 5 novembre 2026) part du client et choisit
 * le jour. Ce qui suit ne dépend ni de l'une ni de l'autre : le nom du
 * chantier, sa durée, sa place, l'agenda. Deux rédactions de ces quatre gestes
 * auraient divergé au premier ajout (`CLAUDE.md` §3).
 *
 * **La durée naît AVEC le chantier** : `planifierChantier` la lit pour savoir
 * combien de demi-journées poser, et un chantier sans durée vaudrait la
 * journée entière, donc « Matin » prendrait aussi l'après-midi.
 *
 * **Les gardes restent aux portes** : ce fichier ne sait pas qui appelle, et ne
 * doit pas le savoir. Chaque action vérifie l'écriture sur le planning avant
 * d'arriver ici.
 */
export async function poserLeClientSurLeJour(
  ctx: Ctx,
  client: { id: string; nom: string; adresse: string | null },
  jour: JourIso,
  quand: QuandPoser,
  marque?: { nature: "hivernage"; travaux: string[] }
) {
  // **Le nom du chantier ne s'invente pas ici** : `nomDuChantier` le fabrique
  // pour toute l'application.
  const chantier = await creerChantier(ctx, {
    nom: nomDuChantier({ nomClient: client.nom, adresseChantier: client.adresse, jour }),
    adresseChantier: client.adresse ?? undefined,
    clientId: client.id,
    dureeDemiJournees: quand === "journee" ? 2 : 1,
    nature: marque?.nature,
    travauxALaMain: marque?.travaux,
  });
  await planifierChantier(ctx, chantier.id, jour, {
    demi: quand === "apres_midi" ? "apres_midi" : "matin",
  });
  await porterChantierDansAgenda(ctx, chantier.id);
  return chantier;
}
