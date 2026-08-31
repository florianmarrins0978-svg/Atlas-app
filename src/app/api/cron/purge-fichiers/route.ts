import { NextResponse } from "next/server";
import { purgerFichiersEnAttente } from "@/server/repositories/fichiers";
import { purgerPreuvesPerimees } from "@/server/preuve-recente";
import { purgerAudiosTranscrits, purgerPhotosDiagnostic } from "@/server/repositories/retention";
import { noterPurgeReussie } from "@/server/journal-purge";
import { getEnv } from "@/server/env";
import { logger } from "@/server/logger";
import { idRequeteValideOuGenere, executerAvecContexte } from "@/server/request-context";

export const dynamic = "force-dynamic";

// Point d'entrée destiné à être appelé par un planificateur externe (cron du
// fournisseur d'hébergement, GitHub Actions schedule, etc.) — jamais exposé
// publiquement sans secret. Comparaison en longueur constante pour éviter une
// attaque par mesure de temps.
function secretValide(requeteSecret: string | null, attendu: string): boolean {
  if (!requeteSecret || requeteSecret.length !== attendu.length) return false;
  let diff = 0;
  for (let i = 0; i < attendu.length; i++) {
    diff |= requeteSecret.charCodeAt(i) ^ attendu.charCodeAt(i);
  }
  return diff === 0;
}

export async function POST(request: Request) {
  const requestId = idRequeteValideOuGenere(request.headers.get("x-request-id"));
  return executerAvecContexte({ requestId }, async () => {
    const env = getEnv();
    if (!env.cronSecret) {
      logger.error("Tentative d'appel de la purge planifiée sans CRON_SECRET configuré");
      return NextResponse.json({ erreur: "Non configuré." }, { status: 503 });
    }

    const secretRecu = request.headers.get("x-cron-secret");
    if (!secretValide(secretRecu, env.cronSecret)) {
      logger.warn("Tentative d'appel de la purge planifiée avec un secret invalide ou absent");
      return NextResponse.json({ erreur: "Non autorisé." }, { status: 401 });
    }

    try {
      // L'ordre compte : on met d'abord en file les audios dont la
      // transcription est acquise, puis on vide la file. Sans quoi ils
      // attendraient un tour de planificateur de plus — soit un jour de
      // conservation en trop, à chaque exécution.
      const { audiosPurges } = await purgerAudiosTranscrits();
      // Même raisonnement, et même place dans l'ordre : les photos de
      // diagnostic échues entrent en file AVANT qu'on la vide, sinon elles
      // attendent une exécution de plus.
      const { photosPurgees } = await purgerPhotosDiagnostic();
      const nombrePurges = await purgerFichiersEnAttente();
      /**
       * **Les preuves de ré-authentification périmées, ici et nulle part
       * ailleurs.** Elles ne valent plus rien après dix minutes — l'expiration
       * est vérifiée à la LECTURE, et rien de la sécurité ne dépend de cette
       * ligne. Elle empêche seulement une table de grossir d'une ligne par
       * session et par personne, sans que rien ne les retire.
       *
       * **Aucun rouage neuf n'a été bâti pour cela** : cette purge existait, elle
       * tourne déjà, et une ligne suffit. Sans elle, la fonction était du code
       * mort qu'on aurait présenté comme un nettoyage effectif.
       */
      const preuvesPurgees = await purgerPreuvesPerimees();

      /**
       * **ON NOTE LE SUCCÈS ICI, ET NULLE PART AILLEURS.**
       *
       * Cette ligne est à l'intérieur du `try`, après tout le travail, et
       * surtout **pas dans un `finally`** : un horodatage écrit malgré l'échec
       * dirait « la purge tourne » pendant que rien n'est purgé. C'est le faux
       * vert le plus dangereux qui soit, parce qu'il rassure — et c'est
       * exactement ce que `scripts/test-journal-purge-db.ts` vérifie en faisant
       * échouer la purge exprès.
       *
       * Si l'écriture du journal échoue elle-même, la purge est comptée comme
       * échouée : c'est le bon sens du côté fermé. Le ménage a bien eu lieu,
       * mais on ne peut plus le prouver — et une purge qu'on ne sait pas
       * prouver ne vaut pas mieux qu'une purge qui n'a pas eu lieu.
       */
      await noterPurgeReussie({
        fichiersPurges: nombrePurges,
        audiosPurges,
        photosPurgees,
        preuvesPurgees,
      });

      logger.info("Purge planifiée exécutée", { nombrePurges, audiosPurges, photosPurgees });
      return NextResponse.json({ statut: "ok", nombrePurges, audiosPurges, photosPurgees, preuvesPurgees });
    } catch (err) {
      logger.error("Échec de la purge planifiée des fichiers", { erreur: err });
      return NextResponse.json({ erreur: "Échec de la purge." }, { status: 500 });
    }
  });
}
