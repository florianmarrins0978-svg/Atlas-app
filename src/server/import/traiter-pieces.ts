import type { Ctx } from "../repositories/context";
import {
  facturesSansHtCherche,
  noterHtCherche,
  noterIllisible,
  noterLecture,
  noterObjetCherche,
  pdfSansObjetCherche,
  prendrePiecesALire,
} from "../repositories/pieces-importees";
import { getEntreprise } from "../repositories/entreprises";
import { lireObjet } from "../storage";
import { logger } from "../logger";
import { extraireTexte, lireLeHt, lirePiece } from "./lire-piece";
import { lireChampsDuTexte } from "../../lib/import-pieces";
import { pourLeCompteDe } from "../ai/compteur";

/**
 * LA LECTURE EN ARRIÈRE-PLAN — sans file de travail, et c'est délibéré.
 *
 * Atlas n'a pas de planificateur en production (`docs/DEPLOIEMENT-PURGE.md`).
 * La lecture part donc de `after()` : chaque pièce reçue, et chaque coup d'œil
 * de l'écran sur l'état de l'envoi, relance cette boucle une fois la réponse
 * partie. Le serveur continue de lire quand le téléphone est fermé : c'est ce
 * qui permet d'écrire « vous pouvez fermer l'appli ».
 *
 * **Une seule boucle par entreprise et par serveur** : cent pièces reçues ne
 * lancent pas cent boucles, la première ramasse ce que les suivantes apportent.
 * Une boucle tuée en route (serveur redémarré) laisse ses pièces « en lecture » :
 * `prendrePiecesALire` les reprend après dix minutes, au prochain coup d'œil.
 */
const enCours = new Set<string>();

/** Quatre pièces à la fois : l'IA répond en secondes, le texte en millisecondes. */
const PAR_TOUR = 4;

export async function traiterPiecesEnAttente(ctx: Ctx): Promise<number> {
  if (enCours.has(ctx.entrepriseId)) return 0;
  enCours.add(ctx.entrepriseId);
  let lues = 0;
  try {
    // Le nom de son entreprise, que l'en-tête de ses pièces imprime : jamais
    // celui du client (`lireChampsDuTexte`). Lu une fois pour tout l'envoi.
    const artisan = (await getEntreprise(ctx))?.nom ?? null;
    for (;;) {
      const lot = await prendrePiecesALire(ctx, PAR_TOUR);
      if (lot.length === 0) break;
      await Promise.all(
        lot.map(async (p) => {
          try {
            const octets = new Uint8Array(await lireObjet(p.fichierCle));
            // Lancée par `after()`, la lecture n'a plus de requête pour dire
            // qui paie l'IA : on le pose (`compteur.ts`), sinon la production
            // refuse l'appel.
            await noterLecture(ctx, p.id, await pourLeCompteDe(ctx, () => lirePiece(octets, artisan)));
          } catch (err) {
            logger.error("Pièce importée illisible", { piece: p.id, erreur: err instanceof Error ? err.message : String(err) });
            await noterIllisible(ctx, p.id);
          }
          lues++;
        })
      );
    }
  } finally {
    enCours.delete(ctx.entrepriseId);
  }
  return lues;
}

/**
 * Combien de PDF une ouverture de fiche relit au plus : 80 ms chacun. Un client
 * qui en aurait davantage voit les suivants à l'ouverture d'après.
 */
const OBJETS_PAR_OUVERTURE = 30;

/**
 * Les PDF importés AVANT que l'objet se lise (migration 0161) n'ont que leur
 * numéro sur la fiche. Sa remarque du 3 novembre 2026, sur son devis Beseme :
 * *« objet et titre, c'est la même chose »*. Chacun se relit UNE fois, au
 * texte seul : jamais l'IA, qu'il paierait pour un titre.
 */
export async function chercherLesObjets(ctx: Ctx, clientId: string): Promise<void> {
  for (const p of await pdfSansObjetCherche(ctx, clientId, OBJETS_PAR_OUVERTURE)) {
    let objet: string | null = null;
    try {
      objet = lireChampsDuTexte(await extraireTexte(new Uint8Array(await lireObjet(p.fichierCle)))).objetLu;
    } catch (err) {
      // Un PDF illisible ne se relira pas à chaque ouverture : il garde son numéro.
      logger.warn("Objet d'une pièce importée illisible", { piece: p.id, erreur: err instanceof Error ? err.message : String(err) });
    }
    await noterObjetCherche(ctx, p.id, objet);
  }
}

/** Combien de factures une visite de Mon année relit au plus : l'IA répond en secondes. */
const HT_PAR_VISITE = 10;
const htEnCours = new Set<string>();

/**
 * LE HT DES FACTURES IMPORTÉES AVANT LUI (migration 0176), cherché une fois.
 * Sa question du 8 novembre 2026 : *« la limite, comment on peut corriger ce
 * problème ? »* ; Mon année ne compte une facture importée qu'en HT, et
 * l'import ne lisait que le TTC.
 *
 * Le modèle de `chercherLesObjets`, à une différence près, et c'est la sienne :
 * l'IA lit aussi, pour les scans et les mises en page que le texte ne dit pas
 * (*« tu peux les lire avec l'IA aussi »*), sur ses crédits (`pourLeCompteDe`).
 * Lancé par `after()` depuis Mon année : dix par visite, une seule boucle par
 * entreprise et par serveur.
 */
export async function chercherLesHt(ctx: Ctx): Promise<void> {
  if (htEnCours.has(ctx.entrepriseId)) return;
  htEnCours.add(ctx.entrepriseId);
  try {
    for (const p of await facturesSansHtCherche(ctx, HT_PAR_VISITE)) {
      try {
        const ht = await pourLeCompteDe(ctx, async () => lireLeHt(new Uint8Array(await lireObjet(p.fichierCle))));
        await noterHtCherche(ctx, p.id, ht);
      } catch (err) {
        // Non marquée : une panne passagère (l'IA, le stockage) ne la laisse pas
        // sans HT pour toujours. Elle se relira à la visite suivante.
        logger.warn("HT d'une facture importée pas encore lu", { piece: p.id, erreur: err instanceof Error ? err.message : String(err) });
      }
    }
  } finally {
    htEnCours.delete(ctx.entrepriseId);
  }
}
