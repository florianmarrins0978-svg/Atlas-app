"use client";

import { useCallback, useState } from "react";
import { colors } from "@/lib/design-tokens";
import Robinet3D from "./Robinet3D";
import type { Poste } from "@/lib/arrosage/postes";
import { DOSSIER_PHOTOS_ROBINET, ROBINET, roleEn3D, type Depart, type PieceDuRobinet, type RoleEn3D } from "@/lib/arrosage/robinet";

/**
 * LE MONTAGE AU ROBINET, PIÈCE SOUS PIÈCE — éclaté comme la nourrice, sa
 * demande du 18 octobre 2026 : la double sortie en haut, puis sous UNE de ses
 * sorties le programmateur, le raccord, le tuyau.
 *
 * **L'axe de vissage.** Chaque photo dit où tombe son filetage (`axe`, en
 * fraction de sa largeur, mesuré sur la photo), et ce point se pose sur l'axe
 * commun de la pile, à 60 px du bord. Centrer les photos ne suffisait pas : une
 * photo carrée ou une sortie décalée tombait à côté (*« aligne-moi tous les
 * raccords »*).
 *
 * Chaque étage se touche, se change ou se supprime comme toute autre pièce :
 * les postes sont ceux que la liste compte (`postes.ts`), le menu et la liste
 * disent la même chose. Le manque de voies se lit SOUS le programmateur, là où
 * il regarde (*« une voie, et en dessous 4 réseaux »*).
 *
 * Le fond de la pile reste blanc quelle que soit la charte, comme celui de la
 * nourrice : les photos sont détourées sur blanc et fondues en `multiply`.
 *
 * **Depuis le 23 novembre 2026, la pile se montre en 3D** (`Robinet3D`, sa
 * planche `appli/arrosage-robinet-3d.html`, son « Parfait, code ça »), et la
 * liste dessous, sans photos, reste ce qu'on touche. La pile en photos ne sert
 * plus que de repli, sur l'appareil qui ne sait pas afficher la 3D : elle porte
 * alors elle-même ses pièces à toucher, comme avant.
 */
export default function MontageAuRobinet({
  postes,
  depart,
  nez,
  manque,
  onPiece,
}: {
  /** Les postes du départ, dans l'ordre de la pile : double sortie, programmateur, raccord, tuyau, puis les pièces ajoutées. */
  postes: Poste[];
  depart: Depart;
  nez: boolean;
  /** La phrase du manque de voies, sous le programmateur, ou rien. */
  manque: string | null;
  onPiece: (p: Poste) => void;
}) {
  const [repli, setRepli] = useState(false);
  const surPrete = useCallback((oui: boolean) => setRepli(!oui), []);
  const double = postes.some((p) => p.cle === "am:double");
  // Une pièce supprimée reste dans la pile, grisée dans la 3D comme dans la liste.
  const retirees = postes.filter((p) => p.retiree).map((p) => roleEn3D(p.cle)).filter((r): r is RoleEn3D => r !== null);
  const etages = (photos: boolean) => postes.map((p, i) => <Etage key={p.cle} p={p} premier={i === 0} photos={photos} depart={depart} nez={nez} manque={manque} onPiece={onPiece} />);
  return (
    <div data-atlas="montage-robinet">
      <Robinet3D
        nez={nez}
        double={double}
        retirees={retirees}
        depart={depart}
        onPrete={surPrete}
        repli={
          <div className="mt-[10px] rounded-[16px] px-3 py-[14px]" style={{ backgroundColor: "#ffffff", boxShadow: `inset 0 0 0 1px ${colors.line}` }}>
            {etages(true)}
          </div>
        }
      />
      {!repli && <div className="mt-3">{etages(false)}</div>}
    </div>
  );
}

/**
 * Un étage de la pile, qui se touche : sa photo posée sur l'axe de vissage (la
 * pile en photos), ou son seul nom sous la 3D. Le nom, la référence et le manque
 * de voies sont les mêmes dans les deux.
 */
function Etage({
  p,
  premier,
  photos,
  depart,
  nez,
  manque,
  onPiece,
}: {
  p: Poste;
  premier: boolean;
  photos: boolean;
  depart: Depart;
  nez: boolean;
  manque: string | null;
  onPiece: (p: Poste) => void;
}) {
  const seize = depart === 16 || depart === "16s";
  const fiche = ficheDe(p.cle, depart);
  const hauteur = p.changee ? 60 : fiche?.hauteur ?? 60;
  const axe = p.changee ? 0.5 : fiche?.axe ?? 0.5;
  const photo = p.changee ? p.photo : fiche ? `${DOSSIER_PHOTOS_ROBINET}${fiche.photo}` : p.photo;
  const sousTitre = p.changee
    ? "changée"
    : p.cle === "am:pe"
      ? nez ? "jusqu’au réseau, à mesurer" : p.q ? `jusqu’à la nourrice, ${p.q} m` : "jusqu’à la nourrice, à mesurer"
      : fiche?.sansReference ? "Réf. du fournisseur" : `Réf. ${p.ref}`;
  return (
    <button
      type="button"
      onClick={() => onPiece(p)}
      data-atlas="etage-robinet"
      data-cle={p.cle}
      data-etat={p.retiree ? "retiree" : p.changee ? "changee" : "proposee"}
      className="grid min-h-[44px] w-full items-center gap-[10px] border-0 bg-transparent p-0 text-left"
      style={{ gridTemplateColumns: photos ? "150px 1fr" : "1fr", marginTop: premier ? 0 : 8, font: "inherit", color: "inherit", cursor: "pointer" }}
      aria-label={p.nom}
    >
      {photos && (
        <span className="relative block" style={{ height: hauteur, opacity: p.retiree ? 0.35 : 1, filter: p.retiree ? "grayscale(1)" : undefined }}>
          <span className="absolute top-0 block h-full" style={{ left: 60, transform: `translateX(${-axe * 100}%)` }}>
            {p.cle === "am:pe" && !p.changee ? (
              <Tube seize={seize} />
            ) : photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- pansement assumé : next/image n’a rien à optimiser sur une photo de pièce servie telle quelle depuis public/, une photo de pièce, servie telle quelle
              <img src={photo} alt="" className="block h-full w-auto" style={{ mixBlendMode: "multiply" }} />
            ) : (
              <span className="block whitespace-nowrap text-[11px]" style={{ color: colors.muted }}>photo à venir</span>
            )}
          </span>
        </span>
      )}
      <span className="text-[13px] leading-[1.35]" style={{ color: colors.inkSoft }}>
        <b className="block font-semibold" style={{ color: p.retiree ? colors.alert : colors.ink, textDecoration: p.retiree ? "line-through" : undefined }}>
          {p.nom}
        </b>
        {sousTitre}
        {p.cle === "am:prog" && manque && (
          <span className="mt-1 block font-semibold" style={{ color: colors.alert }} data-atlas="manque-de-voies">
            {manque}
          </span>
        )}
      </span>
    </button>
  );
}

/** La fiche de la pile pour une clé du départ : sa photo debout, son axe, sa hauteur. */
function ficheDe(cle: string, depart: Depart): PieceDuRobinet | null {
  if (cle === "am:double") return ROBINET.double;
  if (cle === "am:prog") return ROBINET.programmateur;
  if (cle === "am:raccord") return ROBINET.raccord[depart];
  return null;
}

/**
 * Le tuyau, dessiné : un PEHD noir à bande bleue, ou le Ø16 plus fin et tout
 * noir. Ce sont les couleurs du tube lui-même, posé sur le blanc de la pile,
 * pas celles de la charte : il se dessine comme une photo se montre.
 */
function Tube({ seize }: { seize: boolean }) {
  return (
    <span
      className="block h-full rounded-[3px]"
      style={{ width: seize ? 9 : 14, background: seize ? "#1f1f1f" : "linear-gradient(90deg,#2b2d31 0 30%,#2f7fd6 30% 42%,#2b2d31 42% 100%)" }}
      aria-hidden="true"
    />
  );
}
