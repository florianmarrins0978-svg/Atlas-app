import { chantierEnCours, getStatutAffiche, statutLabel, type ChantierStatut } from "@/lib/chantier-etat";
import { ongletDuChantier } from "@/lib/onglet-chantier";
import { libelleDateRelative } from "@/lib/date-relative";
import { colors, font } from "@/lib/design-tokens";
import StatusIcon from "@/components/atlas/StatusIcon";
import BrancheEucalyptus from "@/components/atlas/BrancheEucalyptus";
import { MotAtlas, SceauAtlas } from "@/components/atlas/MarqueAtlas";
import Link from "next/link";
import { auth } from "@/auth";
import { getCurrentCtx } from "@/server/session-ctx";
import { listerChantiersPourAffichage } from "@/server/repositories/chantiers";
import { notificationsPatron, envoisCaducs } from "@/server/repositories/envois-devis";
import Notifications from "./Notifications";
import ListeChantiers from "./ListeChantiers";
import AnnonceTransmission from "@/components/atlas/AnnonceTransmission";

// Données réelles, propres à l'entreprise courante : jamais de pré-rendu statique.
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// L'écran d'accueil, refait le 9 août 2026 d'après la maquette du patron.
//
// **Ce qui commande toutes les mesures ci-dessous : la finesse.** Sa consigne
// tient en une phrase — « minimaliste, luxueux, haut de gamme, comparable à une
// excellente application iOS » — et en une liste de refus : pas de grosses
// bordures, pas d'ombres lourdes, pas de cartes épaisses, pas d'aspect tableau
// de bord. Concrètement, et c'est ce qui se relit dans le code :
//
//   - les traits font 1 px, les accents de bord 2 px ;
//   - les ombres portent une opacité de 4 à 6 %, jamais plus ;
//   - les rayons restent entre 14 et 18 px — au-delà, la carte devient un
//     galet et l'écran perd sa tenue ;
//   - le texte secondaire descend à 12,5 px : sur un téléphone, il situe, il ne
//     se lit pas.
//
// **Rien n'est écrit en dur.** Les noms, les statuts, les dates, le compteur
// viennent tous de la base — la maquette ne fixe que la présentation.
// ─────────────────────────────────────────────────────────────────────────────

/** Les états qui ATTENDENT un geste du patron : ils portent l'or, pas le vert. */
const ETATS_EN_ATTENTE: ChantierStatut[] = ["devis_retourne", "devis_a_corriger", "a_relancer", "devis_caduc"];

function Chevron() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke={colors.chevron}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0"
      aria-hidden="true"
    >
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

function IconePhoto() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="1.7" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m3 16 5-4 4 3 3-3 6 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function ChantiersPage() {
  const ctx = await getCurrentCtx();
  const [session, chantiers, notifications, caducs] = await Promise.all([
    auth(),
    listerChantiersPourAffichage(ctx),
    notificationsPatron(ctx),
    envoisCaducs(ctx),
  ]);

  // Le prénom, jamais le nom complet : « Bonjour Florian Marrins » sonne comme
  // un courrier administratif. Absent, on n'invente rien — le salut disparaît.
  const prenom = session?.user?.name?.trim().split(/\s+/)[0] ?? null;

  // Le statut est calculé une seule fois, ici : le compteur et la carte doivent
  // dire la même chose, et deux appels séparés finiraient par diverger.
  // **Cette liste ne montre que ce qui reste à préparer.** Un chantier passé au
  // planning vit au planning ; facturé, terminé, ou dont la date est dépassée,
  // il vit dans « Terminés » (`src/lib/onglet-chantier.ts`).
  const avecStatut = chantiers
    .map((c) => ({ ...c, statut: getStatutAffiche(c) }))
    .filter((c) => ongletDuChantier(c) === "chantiers");
  const enCours = avecStatut.filter((c) => chantierEnCours(c.statut)).length;

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-8">
        {/* ── L'en-tête, volontairement bas ─────────────────────────────────
            Il ne porte que la marque et l'accès aux notifications. Le patron a
            retiré la baseline de sa maquette : une accroche répétée à chaque
            ouverture ne dit rien à celui qui se sert de l'outil tous les
            jours, et elle volait vingt pixels au titre. */}
        <header className="flex items-center justify-between px-6 pt-4">
          <div className="flex items-center gap-3">
            <SceauAtlas taille={42} />
            <MotAtlas />
          </div>
          <button
            type="button"
            aria-label="Notifications"
            className="relative flex h-9 w-9 items-center justify-center"
          >
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8.5a6 6 0 1 0-12 0c0 5.5-2 6.8-2 6.8h16s-2-1.3-2-6.8" />
              <path d="M10.5 19.2a2 2 0 0 0 3 0" />
            </svg>
            {notifications.length + caducs.length > 0 && (
              <span
                className="absolute right-0.5 top-0.5 h-[7px] w-[7px] rounded-full"
                style={{ backgroundColor: colors.or, outline: `1.5px solid ${colors.cream}` }}
              />
            )}
          </button>
        </header>

        {/* ── Le titre, et la branche qui l'accompagne ─────────────────────
            `overflow-hidden` n'est pas cosmétique : la branche déborde à
            droite, et sans lui elle ÉLARGIT le document. Mesuré — la barre
            basse faisait 425 px de large sur un écran de 393, et toute la page
            se décalait latéralement au doigt. Le défaut ne se voyait pas sur
            une capture : il se voyait sur la largeur des éléments. */}
        <div className="relative overflow-hidden px-6 pt-5">
          {/* Décorative et rien d'autre : elle passe sous le texte et
              n'intercepte aucun doigt. Discrète — sur un écran ouvert vingt
              fois par jour, un ornement qui se remarque finit par gêner. */}
          <div className="pointer-events-none absolute -right-8 -top-6 select-none" aria-hidden="true">
            <BrancheEucalyptus largeur={196} opacite={0.4} />
          </div>

          {prenom && (
            <p className="relative text-[16px] leading-none" style={{ color: colors.or }}>
              Bonjour {prenom}
            </p>
          )}
          <h1
            className="relative mt-1.5 whitespace-nowrap text-[36px] leading-[1.05]"
            style={{ fontFamily: font.display }}
          >
            Vos chantiers
          </h1>
          <div className="relative mt-3 h-px w-14" style={{ backgroundColor: colors.orClair }} />
          <p className="relative mt-3 text-[13px]" style={{ color: colors.muted }}>
            {enCours} chantier{enCours > 1 ? "s" : ""} en cours
          </p>
        </div>

        {/* Le mot qui accueille le patron au retour de sa messagerie. Placé
            AVANT les notifications : c'est la conséquence du geste qu'il vient
            de faire, pas une information de fond. */}
        <AnnonceTransmission />

        <Notifications initiales={notifications} caducs={caducs} />

        {/* ── L'action principale ───────────────────────────────────────────
            Plus horizontale et plus basse que dans la version précédente : le
            titre tient sur une ligne, le rond descend à 42 px, l'ombre à 12 %.
            « Nouveau chantier » reste le libellé exact — c'est ce que les
            suites de bout en bout cherchent, et ce que le patron lit. */}
        <div className="px-6 pt-4">
          <Link
            href="/chantiers/nouveau"
            className="flex items-center gap-4 px-4 py-4 transition-transform active:translate-y-px"
            style={{
              backgroundColor: colors.rust,
              color: colors.cream,
              borderRadius: 18,
              boxShadow: "0 8px 22px rgba(47,59,47,0.12)",
            }}
          >
            <span
              aria-hidden="true"
              className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-full"
              style={{ border: `1px solid ${colors.orClair}` }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.orClair} strokeWidth="1.6" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <strong
                className="block whitespace-nowrap text-[19px] font-normal leading-tight"
                style={{ fontFamily: font.display }}
              >
                Nouveau chantier
              </strong>
              <span className="mt-1 block text-[12.5px] leading-snug" style={{ color: "rgba(245,243,238,0.72)" }}>
                Créez un chantier et dictez votre note vocale sur place.
              </span>
            </span>
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.orClair}
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="flex-shrink-0"
              aria-hidden="true"
            >
              <path d="M5 12h13M12 6l6 6-6 6" />
            </svg>
          </Link>
        </div>

        {chantiers.length === 0 ? (
          <div className="mt-7 px-6">
            <div
              className="px-5 py-8 text-center"
              style={{ backgroundColor: colors.card, borderRadius: 14, border: `1px solid ${colors.lineSoft}` }}
            >
              <p className="text-[13px]" style={{ color: colors.muted }}>
                Aucun chantier pour l&apos;instant. Créez votre premier chantier pour commencer.
              </p>
            </div>
          </div>
        ) : (
          <>
            <p
              className="px-6 pb-2.5 pt-6 text-[10.5px] font-semibold uppercase"
              style={{ color: colors.muted, letterSpacing: "0.2em" }}
            >
              En cours
            </p>
            <ListeChantiers
              chantiers={avecStatut.map(({ statut, ...c }) => {
                const enAttente = ETATS_EN_ATTENTE.includes(statut);
                const teinte = enAttente ? colors.or : colors.sage;
                return {
                  id: c.id,
                  nom: c.nom,
                  accent: teinte,
                  carte: (
                    <>
                      <StatusIcon statut={statut} size={38} couleur={enAttente ? colors.or : colors.rust} />
                      <div className="min-w-0 flex-1">
                        <span
                          className="text-[10.5px] font-semibold uppercase"
                          style={{ color: teinte, letterSpacing: "0.16em" }}
                        >
                          {statutLabel[statut]}
                        </span>
                        <h2 className="mt-1 truncate text-[18px] leading-tight" style={{ fontFamily: font.display }}>
                          {c.nom}
                        </h2>
                        <p className="mt-0.5 truncate text-[12.5px]" style={{ color: colors.muted }}>
                          {c.adresseChantier ?? c.clientNom ?? "Adresse non renseignée"}
                        </p>
                        <span className="mt-1.5 flex items-center gap-1.5 text-[12px]" style={{ color: colors.muted }}>
                          <IconePhoto /> {c.photosCount} photo{c.photosCount > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex flex-shrink-0 flex-col items-end gap-3 pt-0.5">
                        <span className="whitespace-nowrap text-[12px]" style={{ color: colors.muted }}>
                          {libelleDateRelative(c.majAt)}
                        </span>
                        <Chevron />
                      </div>
                    </>
                  ),
                };
              })}
            />
          </>
        )}

        {/* ── L'équipe ──────────────────────────────────────────────────────
            La maquette la place ici, au pied de la liste. Elle mène aux
            Réglages, où les équipes vivent déjà : inventer un écran pour
            honorer une maquette aurait créé une porte qui ne s'ouvre sur rien. */}
        <div className="px-6 pt-4">
          <Link
            href="/reglages"
            className="flex items-center gap-3 px-4 py-3.5"
            style={{
              backgroundColor: colors.card,
              border: `1px solid ${colors.lineSoft}`,
              borderRadius: 14,
            }}
          >
            <span
              aria-hidden="true"
              className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: colors.rustTint }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={colors.or} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="8" r="3.2" />
                <path d="M2.8 19c0-3.2 2.8-5.2 6.2-5.2s6.2 2 6.2 5.2" />
                <path d="M16.5 6.2a3 3 0 0 1 0 5.6M18 13.8c2 .7 3.4 2.3 3.4 4.4" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block text-[17px] font-normal leading-tight" style={{ fontFamily: font.display }}>
                Équipe
              </strong>
              <span className="mt-0.5 block text-[12.5px]" style={{ color: colors.muted }}>
                Gérez votre équipe et les accès.
              </span>
            </span>
            <Chevron />
          </Link>
        </div>
      </div>
    </div>
  );
}
