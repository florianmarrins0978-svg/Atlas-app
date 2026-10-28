import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import BoutonAssistant from "@/components/atlas/BoutonAssistant";
import { colors, font } from "@/lib/design-tokens";
import { checkUp, echeanceProche, jourComplet, jourEnMots, tailleLisible } from "@/lib/pour-mon-comptable";
import { getCurrentCtx } from "@/server/session-ctx";
import { listerDossiers } from "@/server/repositories/dossiers-comptables";
import { facturesRecuesLibres, ticketsLibres, type TicketDeLaLigne } from "@/server/repositories/pour-mon-comptable";
import { verificationsDesDossiers, type VerificationDuDossier } from "@/server/repositories/verification-comptable";
import { facturesARapprocher } from "@/server/banque/questions";
import type { FactureARapprocher } from "@/lib/rapprochement-bancaire";
import { carteDeLaLigne, facturesAffichees, type ARegarder } from "../a-regarder";
import MesDossiers, { type DossierAffiche } from "./MesDossiers";
import { jourIso } from "@/lib/jour";
import { garderLaPage } from "@/server/garde-page";
import VeilleDesNouvelles from "@/components/atlas/VeilleDesNouvelles";
import { MOT_DE_LA_CONCLUSION, TON_DE_LA_CONCLUSION } from "@/lib/attestation-comptable";
import { etatDuRetour, lignesAReprendre, messageAuComptable } from "@/lib/retour-comptable";

export const dynamic = "force-dynamic";

/**
 * MES DOSSIERS JUSTIFIÉS — écran 5 de `appli/pour-mon-comptable.html`.
 *
 * Ses demandes du 24 octobre 2026 : un menu Année pour retrouver un dossier,
 * le bilan du comptable rangé avec lui, la garde de dix ans DITE en tête, et
 * prévenir trois mois avant qu'un dossier ne soit effacé.
 */
export default async function PageMesDossiers() {
  await garderLaPage();
  const ctx = await getCurrentCtx();
  const aujourdhui = jourIso(new Date());
  const [dossiers, verifications, factures, enAttente] = await Promise.all([listerDossiers(ctx), verificationsDesDossiers(ctx), facturesRecuesLibres(ctx), facturesARapprocher(ctx)]);
  const verificationDe = new Map(verifications.map((v) => [v.dossierId, v]));
  // Les tickets encore libres, pour proposer celui du même montant à côté d'un
  // rejet : seulement s'il y a des rejets, la lecture couvre toute la garde.
  const avecRejets = verifications.filter((v) => v.rejets.length > 0);
  const tickets: TicketDeLaLigne[] = avecRejets.length ? await ticketsLibres(ctx, "2000-01-01", aujourdhui) : [];

  const affiches: DossierAffiche[] = dossiers.map((d) => ({
    id: d.id,
    nom: `Du ${jourComplet(d.du)} au ${jourComplet(d.au)}`,
    annee: Number(d.au.slice(0, 4)),
    detail: `Rangé le ${jourComplet(jourIso(d.arreteLe))}, gardé jusqu’au ${jourComplet(d.gardeJusquAu)}`,
    taille: tailleLisible(d.tailleOctets),
    echeance: echeanceProche(d.gardeJusquAu, aujourdhui) ? jourComplet(d.gardeJusquAu) : null,
    verification: verificationAffichee(verificationDe.get(d.id), tickets, enAttente),
    attestation: attestationAffichee(verificationDe.get(d.id)),
    retour: retourAffiche(verificationDe.get(d.id), d),
    bilans: d.bilans.map((b) => ({ id: b.id, nature: b.nature, nom: b.fichierNom ?? (b.nature === "pdf" ? "Bilan, PDF" : "Bilan, photo"), ajoute: jourComplet(jourIso(b.ajouteLe)) })),
  }));

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-16">
        <EnTeteEcran
          retour={{ href: "/termines/comptable", libelle: "Retour au dossier en cours" }}
          action={<BoutonAssistant />}
          actionPlacee="retour"
          assistant={false}
          titre="Mes dossiers justifiés"
        />
        <p className="mx-6 mt-2 text-[15px] leading-[1.45]" style={{ color: colors.inkSoft }}>
          Gardés dix ans avec leur bilan, puis effacés.
        </p>
        {/* **Le travail du comptable arrive sans qu'il recharge** : sa capture du
            27 octobre 2026 montrait « 0 sur 60 » sur une page ouverte avant
            que le comptable ne coche. Le même veilleur que l'accueil relit
            l'écran au retour, puis toutes les trente secondes. */}
        <VeilleDesNouvelles />
        <MesDossiers dossiers={affiches} factures={facturesAffichees(factures)} />
      </div>
    </div>
  );
}

/**
 * Où en est son comptable, et ses rejets en cartes de réponse : les mêmes
 * gestes que dans le dossier en cours. Un rejet auquel il répond change la
 * justification de la ligne, qui revient au comptable « corrigée ».
 */
function verificationAffichee(v: VerificationDuDossier | undefined, tickets: TicketDeLaLigne[], enAttente: FactureARapprocher[]): DossierAffiche["verification"] {
  if (!v || !v.envoye) return { texte: null, rejets: [] };
  const rejets = v.rejets.map(({ ligne: l, note }): ARegarder => {
    const choix = checkUp([{ id: l.id, jour: l.jour, montant: l.montant }], tickets.map((t) => ({ id: t.id, dateAchat: t.dateAchat, totalTtc: t.totalTtc }))).get(l.id);
    const ids = choix?.genre === "relie" ? [choix.ticketId] : choix?.genre === "choix" ? choix.ticketIds : [];
    return carteDeLaLigne(l, tickets.filter((t) => ids.includes(t.id)), enAttente, note);
  });
  return { texte: `Vérifié par votre comptable : ${v.verifiees} sur ${v.total}`, rejets };
}

/**
 * L'attestation signée, rangée avec son dossier (sa planche du 27 octobre 2026) :
 * la conclusion et le jour. Périmée, elle le dit : un verdict ou une
 * justification ont bougé depuis la signature.
 */
function attestationAffichee(v: VerificationDuDossier | undefined): DossierAffiche["attestation"] {
  const a = v?.attestation;
  if (!a) return null;
  return {
    id: a.id,
    ton: TON_DE_LA_CONCLUSION[a.conclusion],
    detail: `${MOT_DE_LA_CONCLUSION[a.conclusion]}, signée le ${jourEnMots(jourIso(a.signeLe))}`,
    perimee: !a.aJour,
  };
}

/**
 * Le renvoi à corriger du comptable (sa planche du 27 octobre 2026), à la
 * place qu'il occupe : sous son compte. Tant qu'un rejet reste, la demande et
 * son mot ; plus aucun rejet, « Tout est corrigé » et de quoi le prévenir
 * depuis SA messagerie : rien ne part sans son appui.
 */
function retourAffiche(v: VerificationDuDossier | undefined, d: { du: string; au: string }): DossierAffiche["retour"] {
  const r = v?.retour;
  if (!v || !r) return null;
  const etat = etatDuRetour({ renvoyeLe: r.renvoyeLe, attestationSigneeLe: v.attestation?.signeLe ?? null, rejets: v.rejets.length, corrigees: v.corrigees });
  if (etat === "demande") {
    return { etat, titre: `Correction demandée le ${jourEnMots(jourIso(r.renvoyeLe))}`, message: r.message, texte: lignesAReprendre(v.rejets.length) };
  }
  if (etat === "corrige") {
    const m = messageAuComptable(d);
    return { etat, mailto: `mailto:${r.email ?? ""}?subject=${encodeURIComponent(m.objet)}&body=${encodeURIComponent(m.corps)}` };
  }
  return null;
}
