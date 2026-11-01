import { lireParJeton } from "@/server/repositories/envois-devis";
import { aujourdHuiIso } from "@/server/repositories/envois-devis";
import FormulaireReponse from "./formulaire";
import { jourLisible, joursEnToutesLettres } from "@/lib/jour";
import NumeroDeDocument from "@/components/atlas/NumeroDeDocument";
import { avecCivilite } from "@/lib/civilite";
import { colors, font, surPlein } from "@/lib/design-tokens";
import { EcranDeRetour, TeteDeLettre } from "@/components/atlas/LettreDuClient";
import IconeTrait from "@/components/atlas/IconeTrait";
import BoutonTelechargerDevis from "./BoutonTelechargerDevis";
import BoutonTelechargerDocument from "@/components/atlas/BoutonTelechargerDocument";
import { garderLaPage } from "@/server/garde-page";

// Seule page publique du produit avec celle de la facture : consultée sans
// compte, depuis un lien reçu par SMS ou e-mail (docs/AGENT.md §2.2 bis).
//
// ─────────────────────────────────────────────────────────────────────────────
// **AUX COULEURS D'ATLAS — 8 septembre 2026, sur sa demande.** Après la page de
// la facture : *« on va le modifier aussi comme la facture »*.
//
// **Ce que la lecture a trouvé, et qu'aucune capture ne montrait.** Cette page
// écrivait ses couleurs EN DUR — `bg-[#F4EFE8]`, `bg-white`, `#2F3B2F`,
// `#B5502F` —, ce que `CLAUDE.md` §3 interdit depuis toujours. Deux
// conséquences, invisibles à l'œil :
//
//   · elle portait encore le **terre cuite `#B5502F`**, la couleur abandonnée
//     le 3 août 2026, sur le refus et le cadre de rétractation ;
//   · son bouton d'acceptation portait `#2F3B2F`, le vert des TEXTES, au lieu
//     du vert des boutons qu'il a tranché le 3 septembre (`colors.plein`).
//
// Cinq semaines d'identité manquée, faute d'être passée par les jetons. Elle y
// passe désormais, et suivra ce qui vient.
//
// **Ce n'est PAS sa charte d'écran** : une page de client ne reçoit aucune
// variable (`layout.tsx`, `estPageDuClient`), et les jetons retombent sur leur
// repli — la charte d'Arborea, qui EST l'identité d'Atlas. Un devis ne part pas
// en noir chez le client parce que l'artisan a choisi « Nuit ».
//
// `force-dynamic` est impératif : une mise en cache exposerait le devis d'un
// client à un autre visiteur, et figerait des disponibilités qui changent.
export const dynamic = "force-dynamic";

// Un lien de devis n'a rien à faire dans un moteur de recherche.
export const metadata = { robots: { index: false, follow: false } };

const euros = (montant: string) =>
  `${Number(montant).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export default async function PageDevisClient({ params }: { params: Promise<{ jeton: string }> }) {
  await garderLaPage();
  const { jeton } = await params;
  const envoi = await lireParJeton(jeton);

  // Lien inconnu et lien expiré donnent le même message : distinguer les deux
  // apprendrait à un visiteur au hasard qu'un jeton a existé.
  if (!envoi || envoi.expire) {
    return (
      <EcranDeRetour
        signe="sablier"
        ton="or"
        titre="Ce lien n'est plus valable"
        texte="Contactez votre artisan pour en recevoir un nouveau."
      />
    );
  }

  // Qui écrit, sous chaque écran de retour : le client qui rouvre son SMS une
  // semaine plus tard doit savoir de quel artisan et de quel devis il s'agit.
  const signature = (
    <>
      <b className="font-semibold" style={{ color: colors.ink }}>{envoi.devis.entrepriseNom}</b>, devis n°{" "}
      <NumeroDeDocument valeur={envoi.devis.numeroCommercial} />
    </>
  );

  // Écran de retour : le client revient souvent pour vérifier la date qu'il a
  // retenue. La lui redonner ici lui évite de rappeler son artisan pour ça.
  if (envoi.reponse === "acceptee") {
    return (
      <EcranDeRetour
        signe="coche"
        ton="vert"
        signature={signature}
        titre="Devis accepté"
        /* **TOUS SES JOURS, pas seulement le premier** — depuis le
           20 septembre 2026, elle en retient autant que le chantier en prend.
           « Intervention prévue le lundi 12 octobre » sur un chantier de quatre
           jours lui redisait un jour sur quatre, et c'est cet écran qu'elle
           rouvre depuis son SMS pour vérifier ce qu'elle a accepté.

           `joursRetenus` est absent sur les réponses d'avant la migration
           0097 : l'écran retombe alors sur la date, comme il l'a toujours
           fait. */
        texte={
          envoi.joursRetenus && envoi.joursRetenus.length > 1
            ? `Intervention prévue ${joursEnToutesLettres(envoi.joursRetenus)}. Votre artisan vous recontactera si besoin.`
            : envoi.dateRetenue
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
      <EcranDeRetour
        signe="coche"
        ton="or"
        signature={signature}
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
      <EcranDeRetour
        signe="crayon"
        ton="or"
        signature={signature}
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
     `scripts/test-devis-client-e2e.ts`, sur son écran de 390 × 664, dans le
     pire cas (deux dates, calendrier ouvert, case de rétractation) — sans
     quoi la page regrossit au premier ajout, et personne ne le voit.

     **La lettre de l'artisan — sa planche du 31 octobre 2026**
     (`appli/soignee/client-recoit.html`) : le numéro en grand titre, ses
     initiales à l'or, puis qui écrit et pour qui. La carte à ombre a laissé
     la place à deux plages, comme dans l'appli. */
  return (
    <div className="min-h-dvh px-[18px] pt-2.5 pb-2" style={{ backgroundColor: colors.cream, color: colors.ink }}>
      <div className="mx-auto flex w-full max-w-md flex-col">
        {/* **PAS D'INTERTITRE « DEVIS » ICI, contrairement à la facture.**
            Retiré le 8 septembre 2026 : quatorze pixels pour un mot que
            « Devis n° » dit déjà, sur un écran qui n'en a aucun à perdre. */}
        <TeteDeLettre titre={<>Devis n° <NumeroDeDocument valeur={d.numeroCommercial} /></>} nom={d.entrepriseNom} taille={24} rond={30} />
        {/* **La même civilité que partout ailleurs** (`src/lib/civilite.ts`).
            Le client lit « Bonjour Mr. Martins » dans le message qui lui
            apporte ce lien : trouver « Pour Martins » en tête de la page
            ferait douter qu'elle lui soit destinée. */}
        <p className="mt-0.5 text-[14px] leading-[1.34]" style={{ color: colors.inkSoft }}>
          <b className="font-semibold" style={{ color: colors.ink }}>{d.entrepriseNom}</b>
          {d.clientNom && <>, pour {avecCivilite(d.clientNom, d.clientCivilite)}</>}
        </p>
        {d.adresseChantier && (
          <p className="text-[14px] leading-[1.34]" style={{ color: colors.inkSoft }}>
            {d.adresseChantier}
          </p>
        )}

        <section className="mt-2 rounded-md px-3 py-[9px]" style={{ backgroundColor: colors.card }}>
          {/* **Le TTC est le chiffre sur lequel il s'engage** : le plus fort de
              la page, en serif. Le hors taxe et la TVA tiennent en une ligne
              dessous, au lieu de deux lignes de détail. */}
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[17px] leading-tight" style={{ fontFamily: font.display }}>
              {d.autoliquidation ? "Total à payer" : "Total TTC"}
            </span>
            <span
              className="whitespace-nowrap text-[27px] leading-none tabular-nums"
              style={{ fontFamily: font.display, letterSpacing: "-0.01em" }}
            >
              {euros(d.totalTtc)}
            </span>
          </div>
          {/* En sous-traitance, la TVA est due par l'entreprise qui le
              sous-traite : pas de détail, la mention du papier suffit. */}
          {!d.autoliquidation && (
            <p className="mt-0.5 text-[13.5px] leading-snug tabular-nums" style={{ color: colors.inkSoft }}>
              {euros(d.totalHt)} HT et {euros(d.totalTva)} de TVA à {Number(d.tauxTva)}&nbsp;%
            </p>
          )}

          {/* **UN VRAI BOUTON, ET EN PLEIN — 8 et 9 septembre 2026.**

              Sa question du 8 septembre : cacher le montant pour obliger à
              télécharger, comme sur la facture. **Refusé** : sur la facture le
              client DOIT déjà l'argent ; ici il DÉCIDE, et un accord donné sans
              voir le prix n'en est pas un — c'est la première chose qu'un
              litige regarderait. Son inquiétude, elle, est traitée : le
              téléchargement cesse d'être invisible.

              « Télécharger », son mot du 31 août : le geste EMPORTE le
              fichier, il ne l'ouvre pas. Le détail des prestations vit dans ce
              fichier et nulle part ailleurs (un `mailto:` ne porte aucune
              pièce). */}
          <BoutonTelechargerDocument
            fichier={`/devis/${envoi.jeton}/pdf`}
            nom="devis.pdf"
            dataAtlas="telecharger-devis"
            className="mt-2 flex min-h-11 w-full items-center justify-center gap-2.5 rounded-full text-center text-[16px] font-semibold"
            style={{ backgroundColor: colors.plein, color: surPlein }}
          >
            <IconeTrait nom="telecharger" taille={19} epaisseur={1.8} />
            Télécharger mon devis
          </BoutonTelechargerDocument>
        </section>

        <FormulaireReponse envoi={envoi} aujourdHui={aujourdHuiIso()} />

        <p className="mt-1 text-center text-[13px] leading-snug" style={{ color: colors.inkSoft }}>
          Votre accord est horodaté et conservé avec le devis.
        </p>
      </div>
    </div>
  );
}
