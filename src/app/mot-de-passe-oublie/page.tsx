import PorteDeNuit from "@/components/atlas/PorteDeNuit";
import EcranMotDePasseOublie from "./EcranMotDePasseOublie";

/**
 * MOT DE PASSE OUBLIÉ — `appli/mot-de-passe-oublie.html`, validée le
 * 24 septembre 2026 : *« très bien, code ça »*.
 *
 * Page publique (`src/lib/chemins-publics.ts`) : on y arrive précisément parce
 * qu'on ne peut pas se connecter. L'adresse tapée sur la porte suit dans
 * l'adresse de la page, pour ne pas la retaper.
 */
export default async function MotDePasseOubliePage({
  searchParams,
}: {
  searchParams: Promise<{ adresse?: string }>;
}) {
  const { adresse } = await searchParams;
  return (
    <PorteDeNuit className="atlas-bas-sans-barre flex min-h-[100dvh] flex-col px-[22px] pb-5">
      <EcranMotDePasseOublie adresseDeDepart={typeof adresse === "string" ? adresse.slice(0, 254) : ""} />
    </PorteDeNuit>
  );
}
