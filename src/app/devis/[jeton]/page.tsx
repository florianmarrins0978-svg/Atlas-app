import { lireParJeton } from "@/server/repositories/envois-devis";
import { aujourdHuiIso } from "@/server/repositories/envois-devis";
import FormulaireReponse from "./formulaire";
import { jourLisible } from "@/lib/jour";
import NumeroDeDocument from "@/components/atlas/NumeroDeDocument";
import { avecCivilite } from "@/lib/civilite";
import BoutonTelechargerDevis from "./BoutonTelechargerDevis";

// Seule page publique du produit : consultée sans compte, depuis un lien reçu
// par SMS ou e-mail (docs/AGENT.md §2.2 bis).
//
// `force-dynamic` est impératif : une mise en cache exposerait le devis d'un
// client à un autre visiteur, et figerait des disponibilités qui changent.
export const dynamic = "force-dynamic";

// Un lien de devis n'a rien à faire dans un moteur de recherche.
export const metadata = { robots: { index: false, follow: false } };

const euros = (montant: string) =>
  `${Number(montant).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

function Cadre({
  titre,
  texte,
  enDessous,
}: {
  titre: string;
  texte: string;
  enDessous?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#F4EFE8] p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm">
        <h1 className="text-[18px] font-semibold text-ink" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
          {titre}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink/70">{texte}</p>
        {enDessous}
      </div>
    </div>
  );
}

export default async function PageDevisClient({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const envoi = await lireParJeton(jeton);

  // Lien inconnu et lien expiré donnent le même message : distinguer les deux
  // apprendrait à un visiteur au hasard qu'un jeton a existé.
  if (!envoi || envoi.expire) {
    return (
      <Cadre
        titre="Ce lien n'est plus valable"
        texte="Contactez votre artisan pour en recevoir un nouveau."
      />
    );
  }

  // Écran de retour : le client revient souvent pour vérifier la date qu'il a
  // retenue. La lui redonner ici lui évite de rappeler son artisan pour ça.
  if (envoi.reponse === "acceptee") {
    return (
      <Cadre
        titre="Devis accepté"
        texte={
          envoi.dateRetenue
            ? `Intervention prévue le ${jourLisible(envoi.dateRetenue)}. Votre artisan vous recontactera si besoin.`
            : "Votre réponse a bien été enregistrée."
        }
        /* **Son devis reste à portée, même une fois accepté** — sa demande du
           31 août 2026 : *« lorsque le client a accepté le devis et qu'il
           revient sur la page via le SMS il n'a plus accès à son devis, or il
           doit encore pouvoir le télécharger s'il a oublié de le faire »*.
           Cet écran ne portait aucun geste : le lien reçu par SMS devenait un
           cul-de-sac le jour même de l'accord, et il fallait rappeler
           l'artisan pour obtenir la pièce qu'on venait de signer. */
        enDessous={<BoutonTelechargerDevis jeton={envoi.jeton} />}
      />
    );
  }
  if (envoi.reponse === "refusee") {
    return (
      <Cadre
        titre="Réponse enregistrée"
        texte="Vous avez indiqué ne pas donner suite à ce devis."
      />
    );
  }
  // Le client qui revient sur son lien doit retrouver où en est SA demande.
  // Sans cet écran, il verrait « ce lien n'est plus valable » ou un formulaire
  // à remplir de nouveau, et croirait sa correction perdue.
  if (envoi.reponse === "correction") {
    return (
      <Cadre
        titre="Correction demandée"
        texte="Votre artisan a reçu votre message. Il corrigera le devis et vous en enverra une nouvelle version."
      />
    );
  }

  const d = envoi.devis;

  /* **TOUT DOIT TENIR DANS UN ÉCRAN — sa demande du 31 août 2026 :** *« je veux
     que le choix de la date qui arrive au client par SMS tienne sur une seule
     page ! Il ne doit pas avoir à scroll pour voir toutes les infos »*.

     Ce que cela commande ici : des marges resserrées, aucune phrase qui
     explique le champ d'à côté, et rien de décoratif. La mesure est tenue par
     `scripts/test-devis-client-e2e.ts`, sur son écran de 390 × 664 — sans quoi
     la page regrossit au premier ajout, et personne ne le voit. */
  return (
    <div className="min-h-dvh bg-[#F4EFE8] px-4 py-2">
      <div className="mx-auto flex w-full max-w-md flex-col gap-1">
        <header className="rounded-2xl bg-white p-3 shadow-sm">
          {/* Le nom de l'entreprise sur la MÊME ligne que le numéro : il occupait
              la sienne, pour trois mots que l'œil lit de toute façon d'un bloc
              avec le titre. Dix-huit pixels rendus à l'écran. */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h1
              className="text-[19px] font-semibold text-ink"
              style={{ fontFamily: "ui-serif, Georgia, serif" }}
            >
              Devis n° <NumeroDeDocument valeur={d.numeroCommercial} />
            </h1>
            <p className="shrink-0 text-[12px] uppercase tracking-wider text-ink/45">{d.entrepriseNom}</p>
          </div>
          {/* **La même civilité que partout ailleurs** (`src/lib/civilite.ts`).
              Le client lit « Bonjour Mr. Martins » dans le message qui lui
              apporte ce lien : trouver « Pour Martins » en tête de la page
              qu'il ouvre juste après ferait douter qu'elle lui soit
              destinée. */}
          {d.clientNom && (
            <p className="mt-0.5 text-[14px] text-ink/70">Pour {avecCivilite(d.clientNom, d.clientCivilite)}</p>
          )}
          {d.adresseChantier && <p className="text-[13px] text-ink/50">{d.adresseChantier}</p>}

          <dl className="mt-2 border-t border-black/10 pt-1.5 text-[14px]">
            <div className="flex justify-between text-ink/60">
              <dt>Total HT</dt>
              <dd className="tabular-nums">{euros(d.totalHt)}</dd>
            </div>
            <div className="flex justify-between text-ink/60">
              <dt>TVA ({Number(d.tauxTva)} %)</dt>
              <dd className="tabular-nums">{euros(d.totalTva)}</dd>
            </div>
            <div className="flex justify-between text-[16px] font-semibold text-ink">
              <dt>Total TTC</dt>
              <dd className="tabular-nums">{euros(d.totalTtc)}</dd>
            </div>
          </dl>

          {/* Le détail des prestations a quitté cette page, à la demande du
              patron. Il vit dans le PDF, et ce lien y mène : sans lui, le
              client accepterait un total sans pouvoir consulter ce qu'il paie
              — son accord porte pourtant sur le contenu exact, et un devis de
              travaux doit détailler chaque prestation.

              Le patron pensait le PDF joint au mail. Il ne l'est pas : le
              partage n'envoie que du texte, et un `mailto:` ne peut porter
              aucune pièce. Le client ne reçoit qu'un lien — celui-ci. */}
          <a
            href={`/devis/${envoi.jeton}/pdf`}
            target="_blank"
            rel="noopener"
            className="mt-2 block text-[13px] text-ink/50 underline underline-offset-4"
          >
            Voir le devis complet (PDF)
          </a>
        </header>

        <FormulaireReponse envoi={envoi} aujourdHui={aujourdHuiIso()} />

        {/* La mention de preuve, ramenée à une ligne : elle disait la même
            chose en trois, sur un écran qui doit tenir d'un seul tenant. */}
        <p className="text-center text-[11px] leading-snug text-ink/40">
          Votre accord est horodaté et conservé avec le devis.
        </p>
      </div>
    </div>
  );
}
