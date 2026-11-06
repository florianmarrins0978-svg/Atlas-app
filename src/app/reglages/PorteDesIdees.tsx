import Link from "next/link";
import { colors, font, radius } from "@/lib/design-tokens";
import { NOM_DES_IDEES } from "@/lib/idees";
import EtatEcrit from "@/components/atlas/reglages/EtatEcrit";
import PastilleIcone from "@/components/atlas/reglages/PastilleIcone";
import Picto from "@/components/atlas/reglages/Picto";

/**
 * **Les deux portes des idées, en bas des Réglages** — sa planche du
 * 5 novembre 2026 : sous Moi, juste au-dessus de Se déconnecter, chacune sur sa
 * plage. Elles ne règlent rien, elles s'adressent à Atlas : c'est pourquoi
 * elles ne sont pas dans un paquet.
 *
 * « Une idée pour l'appli » est pour TOUT LE MONDE, le salarié compris.
 * « Les idées reçues » n'est que pour l'éditeur ; la page elle-même refuse tout
 * autre compte (`notFound`), parce qu'une adresse se tape.
 */
export default function PorteDesIdees({
  editeur,
  ideeFaite,
}: {
  /** `null` pour qui n'est pas l'éditeur : sa ligne n'existe pas. */
  editeur: { nouvelles: string | null } | null;
  /** « Votre idée est dans l'appli », quelques jours après qu'elle est faite. */
  ideeFaite: boolean;
}) {
  return (
    <div className="mt-[28px] flex flex-col gap-3 px-[26px]">
      {editeur && (
        <Porte href="/reglages/idees-recues" picto="email" nom="Les idées reçues" dataAtlas="porte-idees-recues">
          {editeur.nouvelles && <EtatEcrit ton="or">{editeur.nouvelles}</EtatEcrit>}
        </Porte>
      )}
      <Porte href="/reglages/idee" picto="ampoule" nom={NOM_DES_IDEES} dataAtlas="porte-idee">
        {ideeFaite && <EtatEcrit ton="vert">Votre idée est dans l&apos;appli</EtatEcrit>}
      </Porte>
    </div>
  );
}

function Porte({
  href,
  picto,
  nom,
  dataAtlas,
  children,
}: {
  href: string;
  picto: "ampoule" | "email";
  nom: string;
  dataAtlas: string;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      data-atlas={dataAtlas}
      className="flex min-h-[72px] w-full items-center gap-[14px] px-[18px] py-[14px]"
      style={{ background: colors.card, borderRadius: radius.card }}
    >
      <PastilleIcone>
        <Picto nom={picto} />
      </PastilleIcone>
      <span className="min-w-0 flex-1">
        <span className="block text-[19px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
          {nom}
        </span>
        {children && <span className="mt-1.5 block">{children}</span>}
      </span>
      <span
        aria-hidden="true"
        className="h-2 w-2 rotate-45"
        style={{ flex: "none", borderRight: `1.5px solid ${colors.or}`, borderTop: `1.5px solid ${colors.or}` }}
      />
    </Link>
  );
}
