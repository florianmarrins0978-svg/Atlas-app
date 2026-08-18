import { lireRapportParJeton } from "@/server/repositories/passages-entretien";
import { libelleMinutes } from "@/lib/passage-entretien";
import { parFamilles } from "@/lib/prestations-entretien";
import { jourLisible } from "@/lib/jour";
import { couleursDocument } from "@/lib/design-tokens";

// Le compte rendu de passage, tel que le CLIENT le reçoit.
//
// **Ce qu'il remplace : une signature.** Sa question du 16 août 2026 — *« pour
// les signatures, on peut faire des signatures électroniques ? »* — puis son
// constat : *« s'il n'est pas là, on ne peut pas le faire signer. »* C'est le
// cas ordinaire d'un entretien : on tond pendant que le client est au travail.
// La preuve est donc l'horodatage et l'empreinte du contenu, comme pour
// l'acceptation d'un devis — plus solide qu'un trait au doigt, et qui n'exige
// personne sur place.
//
// **Seul ce qui a été FAIT s'affiche** (sa décision « B ») — et le tri est fait
// en base : ce qui n'a pas été fait n'arrive même pas dans ce HTML.
//
// `force-dynamic` est impératif : une mise en cache exposerait le rapport d'un
// client à un autre visiteur.
export const dynamic = "force-dynamic";

// Un compte rendu de passage n'a rien à faire dans un moteur de recherche.
export const metadata = { robots: { index: false, follow: false } };

function Cadre({ titre, texte }: { titre: string; texte: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#F4EFE8] p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm">
        <h1
          className="text-[18px] font-semibold"
          style={{ fontFamily: "ui-serif, Georgia, serif", color: couleursDocument.encre }}
        >
          {titre}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed" style={{ color: couleursDocument.etiquette }}>
          {texte}
        </p>
      </div>
    </div>
  );
}

export default async function PageRapportClient({
  params,
}: {
  params: Promise<{ jeton: string }>;
}) {
  const { jeton } = await params;
  const rapport = await lireRapportParJeton(jeton);

  // Lien inconnu et rapport effacé donnent le même message : distinguer les
  // deux apprendrait à un visiteur au hasard qu'un jeton a existé.
  if (!rapport) {
    return (
      <Cadre
        titre="Ce lien n'est plus valable"
        texte="Contactez votre artisan pour en recevoir un nouveau."
      />
    );
  }

  const familles = parFamilles(rapport.faites);

  return (
    <div className="min-h-dvh bg-[#F4EFE8] px-5 py-8">
      <div
        className="mx-auto w-full max-w-md rounded-2xl bg-white px-6 py-7 shadow-sm"
        data-atlas="rapport-entretien"
        style={{ color: couleursDocument.encre }}
      >
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: couleursDocument.etiquette }}
        >
          Compte rendu de passage
        </p>
        <h1 className="mt-2 text-[21px]" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
          {rapport.entrepriseNom}
        </h1>
        <p className="mt-1 text-[14px]" style={{ color: couleursDocument.etiquette }}>
          {jourLisible(rapport.jour)}
          {rapport.clientNom ? ` · ${rapport.clientNom}` : ""}
        </p>

        <div className="mt-6">
          {familles.map((groupe) => (
            <section key={groupe.famille} className="mt-5 first:mt-0">
              <h2
                className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: couleursDocument.etiquette }}
              >
                {groupe.famille}
              </h2>
              <ul className="mt-2">
                {groupe.lignes.map((l) => (
                  <li key={l.libelle} className="flex gap-2 py-[5px] text-[15px] leading-[1.4]">
                    <span aria-hidden="true" style={{ color: couleursDocument.etiquette }}>
                      ✓
                    </span>
                    <span>{l.libelle}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {rapport.minutes !== null && (
          <p
            className="mt-6 border-t pt-4 text-[14px]"
            style={{ borderColor: "rgba(28,28,26,0.12)", color: couleursDocument.etiquette }}
          >
            Temps passé&nbsp;: <b style={{ color: couleursDocument.encre }}>{libelleMinutes(rapport.minutes)}</b>
          </p>
        )}

        {rapport.observations && (
          <div
            className="mt-4 rounded-xl px-4 py-3 text-[14px] leading-[1.6]"
            style={{ backgroundColor: "#F7F5F0" }}
          >
            {rapport.observations}
          </div>
        )}

        <p className="mt-6 text-[11.5px] leading-[1.6]" style={{ color: couleursDocument.etiquette }}>
          Envoyé le{" "}
          {rapport.envoyeLe.toLocaleString("fr-FR", {
            dateStyle: "long",
            timeStyle: "short",
            timeZone: "Europe/Paris",
          })}
          . Ce compte rendu est figé&nbsp;: il ne peut plus être modifié.
        </p>
      </div>
    </div>
  );
}
