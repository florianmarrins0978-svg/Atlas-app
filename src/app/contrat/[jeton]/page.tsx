import { lireContratParJeton } from "@/server/repositories/contrats-entretien";
import { colors, font, surPlein, voile } from "@/lib/design-tokens";
import { avecCivilite } from "@/lib/civilite";
import { enEuros } from "@/lib/euros";
import { mensualites, passagesDeLaPrestation, periodeEnLettres, totauxDuContrat } from "@/lib/contrats-entretien";
import BoutonTelechargerDocument from "@/components/atlas/BoutonTelechargerDocument";
import ReponseContrat from "./ReponseContrat";
import { EcranDeRetour, TeteDeLettre } from "@/components/atlas/LettreDuClient";
import IconeTrait from "@/components/atlas/IconeTrait";
import { garderLaPage } from "@/server/garde-page";

// LA PAGE DU CONTRAT, telle que le CLIENT la reçoit par son lien.
//
// **Les couleurs d'origine, comme le devis et le compte rendu** (`ARCHITECTURE.md`
// §248, sa décision du 4 septembre 2026) : ce qui part chez le client ne suit
// pas la charte de l'artisan.
//
// `force-dynamic` est impératif : une mise en cache exposerait le contrat d'un
// client à un autre visiteur.
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function PageContratClient({ params }: { params: Promise<{ jeton: string }> }) {
  await garderLaPage();
  const { jeton } = await params;
  const lu = await lireContratParJeton(jeton);

  // Lien inconnu et contrat effacé donnent le même message : distinguer les
  // deux apprendrait à un visiteur au hasard qu'un jeton a existé.
  if (!lu) {
    return (
      <EcranDeRetour
        signe="sablier"
        ton="or"
        titre="Ce lien n'est plus valable"
        texte="Contactez votre artisan pour en recevoir un nouveau."
      />
    );
  }

  const { contrat } = lu;
  const totaux = totauxDuContrat(contrat.prestations, contrat.periode, contrat.tauxTva);
  const mensuel = mensualites(totaux.totalTtc, contrat.periode.dureeMois);

  /* Par la porte des documents, jamais un lien posé à la main : sur iPhone un
     lien direct PEINT le PDF au lieu de le ranger (`test-tous-les-pdf`). En
     plein, le même mot que « Télécharger mon devis » (3 octobre 2026). Il
     reste sur l'écran de retour : le client qui rouvre son lien le lendemain
     doit retrouver la pièce qu'il vient d'accepter. */
  const telecharger = (enRetour: boolean) => (
    <BoutonTelechargerDocument
      fichier={`/contrat/${encodeURIComponent(jeton)}/pdf`}
      nom="contrat-d-entretien.pdf"
      dataAtlas="telecharger-contrat"
      className={`${enRetour ? "mt-6 min-h-[52px]" : "mt-3 min-h-12"} flex w-full items-center justify-center gap-2.5 rounded-full text-center text-[16px] font-semibold`}
      style={{ backgroundColor: colors.plein, color: surPlein }}
    >
      <IconeTrait nom="telecharger" taille={19} epaisseur={1.8} />
      Télécharger mon contrat
    </BoutonTelechargerDocument>
  );
  const signature = (
    <>
      <b className="font-semibold" style={{ color: colors.ink }}>{lu.entrepriseNom}</b>, contrat d&apos;entretien
    </>
  );
  const retourAccepte = (
    <EcranDeRetour
      signe="coche"
      ton="vert"
      repere="reponse-contrat-faite"
      titre="Contrat accepté"
      texte="Les passages sont fixés d'un mois à l'autre selon la météo."
      enDessous={telecharger(true)}
      signature={signature}
    />
  );

  /* **Une réponse donnée se montre à la place de la page** : on ne répond
     qu'une fois (le dépôt le tient), et le client qui rouvre son SMS vient
     vérifier ce qu'il a dit. Les mêmes écrans que le devis. */
  if (contrat.statut === "accepte") return retourAccepte;
  if (contrat.statut === "refuse") {
    return (
      <EcranDeRetour
        signe="coche"
        ton="or"
        repere="reponse-contrat-faite"
        titre="Réponse enregistrée"
        texte="Vous avez refusé ce contrat."
        signature={signature}
      />
    );
  }

  const nombrePassages = contrat.prestations.reduce((n, p) => n + passagesDeLaPrestation(p, contrat.periode), 0);
  const nombrePrestations = contrat.prestations.length;

  /* **L'ESSENTIEL ICI, LE DÉTAIL DANS LE PDF — sa remarque du 1er novembre
     2026 :** *« si le contrat fait 20 pages, faut pas tout mettre »*. La page
     déroulait chaque prestation avec son prix : vingt lignes à faire défiler
     avant de trouver où répondre. Elle se lit désormais comme le devis : le
     total, ce qu'il couvre en une ligne, et le contrat entier à télécharger
     (planche `appli/soignee/client-recoit.html`). */
  return (
    <ReponseContrat
      jeton={jeton}
      retourAccepte={retourAccepte}
      retourRefuse={
        <EcranDeRetour
          signe="coche"
          ton="or"
          repere="reponse-contrat-faite"
          titre="Réponse enregistrée"
          texte="Votre réponse est transmise à votre artisan."
          signature={signature}
        />
      }
    >
      <>
          <TeteDeLettre titre="Contrat d'entretien" nom={lu.entrepriseNom} />
          <p className="mt-1.5 text-[14.5px] leading-[1.4]" style={{ color: colors.inkSoft }}>
            <b className="font-semibold" style={{ color: colors.ink }}>{lu.entrepriseNom}</b>, pour{" "}
            {avecCivilite(lu.clientNom, lu.clientCivilite ?? undefined)}
          </p>
          <p className="mt-px text-[14.5px] leading-[1.4]" style={{ color: colors.inkSoft }}>
            {periodeEnLettres(contrat.periode)}
            {contrat.reconduit ? ", reconduit à son terme." : "."}
          </p>

          <section className="mt-4 rounded-md p-[18px]" style={{ backgroundColor: colors.card }}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[17px] leading-tight" style={{ fontFamily: font.display }}>
                Total TTC
              </span>
              <span className="whitespace-nowrap text-[27px] leading-none tabular-nums" style={{ fontFamily: font.display, letterSpacing: "-0.01em" }}>
                {enEuros(totaux.totalTtc)}
              </span>
            </div>
            <p className="mt-0.5 text-[13.5px] leading-snug tabular-nums" style={{ color: colors.inkSoft }}>
              {nombrePrestations} prestation{nombrePrestations > 1 ? "s" : ""}, {nombrePassages} passage
              {nombrePassages > 1 ? "s" : ""}. {enEuros(totaux.totalHt)} HT et {enEuros(totaux.totalTva)} de TVA à{" "}
              {Number(contrat.tauxTva).toLocaleString("fr-FR")}&nbsp;%.
            </p>
            {telecharger(false)}
          </section>

          {/* Comment il paie, et quand l'artisan vient : la seule phrase qui
              engage autre chose que le total, sur une plage dorée. */}
          <p className="mt-4 rounded-md px-4 py-[13px] text-[14.5px] leading-[1.45]" style={{ backgroundColor: voile(colors.or, 0.13), color: colors.ink }}>
            {contrat.facturation === "mois"
              ? `Vous réglez ${enEuros(mensuel.montant)} TTC par mois, le 1er de chaque mois.`
              : "Chaque passage est facturé une fois fait. Un passage qui n'a pas lieu n'est pas facturé."}{" "}
            Les passages sont fixés d&apos;un mois à l&apos;autre selon la météo.
          </p>
      </>
    </ReponseContrat>
  );
}
