"use client";

/**
 * MON ANNÉE, à l'écran — sa planche du 8 novembre 2026
 * (`appli/soignee/mon-annee.html`). Les mots et l'ordre sont ceux de la
 * planche qu'il a validée ; les chiffres arrivent tout calculés de la page
 * (`src/lib/mon-annee.ts`). Ce fichier ne décide de rien.
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BottomSheet from "@/components/atlas/BottomSheet";
import IconeTrait from "@/components/atlas/IconeTrait";
import JaugeAnnee from "@/components/atlas/JaugeAnnee";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import Paquet from "@/components/atlas/reglages/Paquet";
import PlageTon, { teintesDuTon, type Ton } from "@/components/atlas/reglages/PlageTon";
import { colors, font } from "@/lib/design-tokens";
import { enEurosEntiers } from "@/lib/euros";
import {
  aLaCentaine,
  dernierDuMois,
  manqueEncore,
  NOMS_DES_MOIS,
  objectifPasseLaFranchise,
  resteSurMilleEuros,
  sensDeLEcart,
  tonDeLAnnee,
  type BeneficeEstime,
  type Comparaison,
  type EtatDeLObjectif,
  type FaceAnDernier,
  type MoisRestant,
} from "@/lib/mon-annee";
import { PLAFOND_CENTIMES } from "@/lib/franchise-plafond";
import { dixPourCentDePlus, presqueToutSigne, type ConseilsDePrix, type PrixDuTarif } from "@/lib/vos-prix";
import type { Attente } from "@/server/repositories/mon-annee";
import { ecrireObjectifAction, ecrireSurTerminesAction } from "./actions";

/** Des centimes en euros entiers : « 214 600 € ». */
const eur = (centimes: number) => enEurosEntiers(Math.round(centimes / 100));
const maj = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const quantieme = (j: number) => (j === 1 ? "1er" : String(j));
const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n < 2 ? un : plusieurs}`;
const CHIFFRES = { fontVariantNumeric: "tabular-nums lining-nums" } as const;

function Rang({ nom, sous, prix, fort = false, filet = false }: { nom: React.ReactNode; sous?: string; prix: string; fort?: boolean; filet?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3.5 py-[11px]" style={{ boxShadow: filet ? `inset 0 1px 0 ${colors.lineSoft}` : undefined }}>
      <span className="min-w-0 flex-1 leading-[1.35]" style={{ color: colors.ink, fontSize: fort ? 20 : 16, fontFamily: fort ? font.display : undefined }}>
        {nom}
        {sous && (
          <small className="mt-0.5 block text-[14px]" style={{ color: colors.inkSoft }}>
            {sous}
          </small>
        )}
      </span>
      <span className="whitespace-nowrap" style={{ ...CHIFFRES, color: fort ? colors.or : colors.ink, fontSize: fort ? 20 : 16.5, fontFamily: fort ? font.display : undefined }}>
        {prix}
      </span>
    </div>
  );
}

function Ecart({ c }: { c: Comparaison }) {
  const sens = sensDeLEcart(c);
  if (sens === "pareil") return <PlageTon ton="or">Pareil.</PlageTon>;
  return (
    <PlageTon ton={sens === "plus" ? "vert" : "ambre"}>
      <b style={{ color: colors.ink }}>{eur(Math.abs(c.cetteAnnee - c.anDernier))}</b> {sens === "plus" ? "de plus." : "de moins."}
    </PlageTon>
  );
}

function BoutonTexte({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-12 items-center text-[15px] font-semibold" style={{ color: colors.or }}>
      {children}
    </button>
  );
}

function Fermer({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mt-2 flex min-h-12 w-full items-center justify-center text-[15px] font-semibold" style={{ color: colors.inkSoft }}>
      Fermer
    </button>
  );
}

const TitreFeuille = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mb-4 mt-1.5 text-[26px] leading-[1.15]" style={{ fontFamily: font.display, color: colors.ink }}>
    {children}
  </h2>
);

export default function MonAnnee({
  modifiable,
  annee,
  aujourdHui,
  objectif,
  facture,
  totalAnDernier,
  etat,
  surTermines,
  regimeTva,
  face,
  reste,
  peutRentrer,
  banqueReliee,
  benefice,
  prix,
  parJournee,
  conseils,
}: {
  /** Le patron seul pose l'objectif et l'interrupteur ; la facturation lit. */
  modifiable: boolean;
  annee: number;
  aujourdHui: string;
  objectif: { chiffreAffaires: number; benefice: number | null } | null;
  facture: number;
  totalAnDernier: number | null;
  etat: EtatDeLObjectif | null;
  surTermines: boolean;
  regimeTva: "assujettie" | "franchise";
  face: FaceAnDernier | null;
  reste: MoisRestant[];
  peutRentrer: { aFacturer: Attente; signes: Attente; sansReponse: Attente };
  banqueReliee: boolean;
  benefice: BeneficeEstime | null;
  /** Vos prix, rangés par ses tarifs (`src/lib/vos-prix.ts`). */
  prix: PrixDuTarif[];
  /** Ce qu'une journée d'équipe doit rapporter pour l'objectif ; `null` sans objectif. */
  parJournee: number | null;
  conseils: ConseilsDePrix;
}) {
  const router = useRouter();
  const [feuille, setFeuille] = useState<null | "objectif" | "mois" | "tous" | "benefice" | "travaux">(null);
  const [allume, setAllume] = useState(surTermines);
  const [saisieCa, setSaisieCa] = useState("");
  const [saisieBenefice, setSaisieBenefice] = useState("");
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const mois = Number(aujourdHui.slice(5, 7)) - 1;
  const jour = Number(aujourdHui.slice(8, 10));
  const fermer = () => setFeuille(null);

  function ouvrirObjectif() {
    const enChiffres = (c: number | null | undefined) => (c ? new Intl.NumberFormat("fr-FR").format(Math.round(c / 100)) : "");
    setSaisieCa(enChiffres(objectif?.chiffreAffaires));
    setSaisieBenefice(enChiffres(objectif?.benefice));
    setRefus(null);
    setFeuille("objectif");
  }

  function garder() {
    demarrer(async () => {
      const r = await ecrireObjectifAction(saisieCa, saisieBenefice);
      if (!r.ok) {
        setRefus(r.raison);
        return;
      }
      setFeuille(null);
      router.refresh();
    });
  }

  function basculer() {
    const oui = !allume;
    setAllume(oui);
    demarrer(async () => {
      const r = await ecrireSurTerminesAction(oui);
      // Refusé : l'interrupteur revient où il était, il ne ment pas.
      if (!r.ok) setAllume(!oui);
    });
  }

  const passe = etat?.passe ?? false;
  const manque = etat ? manqueEncore(etat.reste, peutRentrer.aFacturer.centimes, peutRentrer.signes.centimes) : 0;

  return (
    <div data-atlas="mon-annee">
      <p className="mx-[22px] -mt-2 text-[14.5px]" style={{ color: colors.inkSoft }}>
        Au {quantieme(jour)} {NOMS_DES_MOIS[mois]} {annee}
      </p>

      {/* ─── Le chiffre d'affaires ─────────────────────────────────────── */}
      {objectif && etat ? (
        <Paquet dataAtlas="mon-annee-chiffre">
          <div className="py-[18px]">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[14px] font-semibold" style={{ color: colors.inkSoft }}>
                Chiffre d&apos;affaires
              </span>
              {modifiable && (
                <button type="button" onClick={ouvrirObjectif} className="-my-2.5 min-h-10 text-[15px] font-semibold" style={{ color: colors.or }} data-atlas="modifier-objectif">
                  Modifier
                </button>
              )}
            </div>
            <span className="mb-3.5 mt-1.5 block text-[19px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.inkSoft, ...CHIFFRES }}>
              <b className="text-[30px] font-normal" style={{ color: colors.ink }}>{eur(etat.fait)}</b> sur {eur(etat.objectif)}
            </span>
            <JaugeAnnee part={etat.fait / etat.objectif} trait={passe ? null : etat.trait} ton={tonDeLAnnee(etat)} />
            <div className="mt-3.5">
              {passe ? (
                <PlageTon ton="vert">
                  Objectif passé de <b style={{ color: colors.ink }}>{eur(etat.fait - etat.objectif)}</b>.
                </PlageTon>
              ) : etat.ecart !== null && etat.ecart < 0 ? (
                <PlageTon ton="ambre">
                  <b style={{ color: colors.ink }}>{eur(-etat.ecart)}</b> de retard sur votre saison.
                </PlageTon>
              ) : etat.ecart !== null ? (
                <PlageTon ton="vert">
                  <b style={{ color: colors.ink }}>{eur(etat.ecart)}</b> d&apos;avance sur votre saison.
                </PlageTon>
              ) : null}
            </div>
            {!passe && etat.trait !== null && (
              <p className="mt-2 text-[13px]" style={{ color: colors.inkSoft }}>
                Le trait suit votre saison de l&apos;an dernier.
              </p>
            )}
          </div>
        </Paquet>
      ) : (
        <Paquet dataAtlas="mon-annee-sans-objectif">
          <div className="pb-[22px] pt-[26px] text-center">
            <p className="text-[24px] leading-[1.2]" style={{ fontFamily: font.display, color: colors.ink }}>
              Pas encore d&apos;objectif
            </p>
            <p className="mb-5 mt-2 text-[15px]" style={{ color: colors.inkSoft, ...CHIFFRES }}>
              Facturé cette année, {eur(facture)}.{totalAnDernier !== null && ` L'an dernier, ${eur(totalAnDernier)}.`}
            </p>
            {modifiable && (
              <PrimaryButton pleineLargeur onClick={ouvrirObjectif} repere="fixer-objectif">
                Fixer mon objectif
              </PrimaryButton>
            )}
          </div>
        </Paquet>
      )}

      {/* ─── L'interrupteur, au-dessus de Face à l'an dernier : le patron seul ─ */}
      {modifiable && (
      <Paquet>
        <div className="flex min-h-16 items-center gap-3.5 py-3">
          <span className="flex-1 text-[18px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
            Afficher sur Terminés
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={allume}
            aria-label="Afficher sur Terminés"
            data-atlas="mon-annee-sur-termines"
            onClick={basculer}
            className="relative h-8 w-[52px] flex-none rounded-full border-0"
            style={{ backgroundColor: allume ? colors.plein : colors.line }}
          >
            <span aria-hidden="true" className="absolute top-[3px] h-[26px] w-[26px] rounded-full transition-[left]" style={{ left: allume ? 23 : 3, backgroundColor: colors.card }} />
          </button>
        </div>
      </Paquet>
      )}

      {/* ─── Face à l'an dernier : le jour même, puis du 1er à aujourd'hui ─ */}
      {face && (
        <Paquet titre={`Face à ${annee - 1}`} dataAtlas="face-an-dernier">
          <div className="py-[18px]">
            <p className="mb-0.5 text-[19px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
              Le {quantieme(jour)} {NOMS_DES_MOIS[mois]}
            </p>
            <Rang nom={String(annee)} prix={eur(face.leJour.cetteAnnee)} />
            <Rang nom={String(annee - 1)} prix={eur(face.leJour.anDernier)} filet />
            <Ecart c={face.leJour} />
            {face.duPremier && (
              <>
                <hr className="mb-4 mt-5 border-0" style={{ height: 1, backgroundColor: colors.line }} />
                <p className="mb-0.5 text-[19px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
                  Du 1er au {quantieme(jour)} {NOMS_DES_MOIS[mois]}
                </p>
                <Rang nom={String(annee)} prix={eur(face.duPremier.cetteAnnee)} />
                <Rang nom={String(annee - 1)} prix={eur(face.duPremier.anDernier)} filet />
                <Ecart c={face.duPremier} />
              </>
            )}
            <BoutonTexte onClick={() => setFeuille("tous")}>Tous les mois</BoutonTexte>
          </div>
        </Paquet>
      )}

      {/* ─── Il reste à facturer ───────────────────────────────────────── */}
      {etat && !passe && reste.length > 0 && (
        <Paquet titre="Il reste à facturer" dataAtlas="reste-a-facturer">
          <Rang nom="D'ici le 31 décembre" prix={eur(etat.reste)} fort />
          <Rang
            filet
            nom={reste[0].enCours ? `D'ici le ${quantieme(Number(dernierDuMois(annee, reste[0].mois).slice(8)))} ${NOMS_DES_MOIS[reste[0].mois]}` : maj(NOMS_DES_MOIS[reste[0].mois])}
            sous={pluriel(reste[0].joursOuvres, "jour travaillé", "jours travaillés")}
            prix={eur(aLaCentaine(reste[0].centimes))}
          />
          <Rang filet nom="Par jour travaillé" prix={eur(Math.round(reste[0].centimes / reste[0].joursOuvres / 1000) * 1000)} />
          {reste.length > 1 && (
            <div className="pb-1">
              <BoutonTexte onClick={() => setFeuille("mois")}>Mois par mois</BoutonTexte>
            </div>
          )}
        </Paquet>
      )}

      {/* ─── Ce qui peut encore rentrer ────────────────────────────────── */}
      <Paquet titre="Ce qui peut encore rentrer" dataAtlas="peut-rentrer">
        {[
          { href: "/termines", nom: pluriel(peutRentrer.aFacturer.nombre, "chantier fini, à facturer", "chantiers finis, à facturer"), a: peutRentrer.aFacturer },
          { href: "/planning", nom: pluriel(peutRentrer.signes.nombre, "devis signé, pas encore fait", "devis signés, pas encore faits"), a: peutRentrer.signes },
          { href: "/", nom: pluriel(peutRentrer.sansReponse.nombre, "devis sans réponse", "devis sans réponse"), a: peutRentrer.sansReponse },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex min-h-[60px] items-center gap-3 py-2 no-underline"
            style={{ color: colors.ink, boxShadow: l.href === "/termines" ? undefined : `inset 0 1px 0 ${colors.lineSoft}` }}
          >
            <span className="min-w-0 flex-1 text-[16px] leading-[1.35]">{l.nom}</span>
            <span className="whitespace-nowrap text-[16.5px]" style={CHIFFRES}>{eur(l.a.centimes)}</span>
            <span style={{ color: colors.chevron }}>
              <IconeTrait nom="suivant" taille={18} epaisseur={2} />
            </span>
          </Link>
        ))}
      </Paquet>
      {etat && !passe && (
        <div className="mx-[22px] mt-2">
          {manque > 0 ? (
            <PlageTon ton="or">
              Pour l&apos;objectif, il manque encore <b style={{ color: colors.ink }}>{eur(manque)}</b> de nouveaux devis signés.
            </PlageTon>
          ) : (
            <PlageTon ton="vert">Les chantiers à facturer et les devis signés suffisent pour l&apos;objectif.</PlageTon>
          )}
        </div>
      )}

      {/* ─── Le bénéfice ───────────────────────────────────────────────── */}
      <Paquet titre="Bénéfice" dataAtlas="benefice">
        <div className="py-[18px]">
          {!banqueReliee ? (
            <>
              <p className="mb-4 text-[15px] leading-[1.45]" style={{ color: colors.inkSoft }}>
                Sans votre banque, l&apos;appli ne voit pas vos dépenses.
              </p>
              <PrimaryButton pleineLargeur secondaire href="/reglages/banque">
                Relier ma banque
              </PrimaryButton>
            </>
          ) : !benefice ? (
            <p className="text-[15px] leading-[1.45]" style={{ color: colors.inkSoft }}>
              Aucune ligne de banque cette année.
            </p>
          ) : (
            <BlocBenefice benefice={benefice} objectif={objectif} onCompte={() => setFeuille("benefice")} />
          )}
        </div>
      </Paquet>

      {/* ─── Vos prix : deux conseils au plus, et tous les tarifs ───────── */}
      <Paquet titre="Vos prix" dataAtlas="vos-prix">
        {prix.length === 0 ? (
          <p className="py-[18px] text-[15px] leading-[1.45]" style={{ color: colors.inkSoft }}>
            Rien encore à comparer cette année.
          </p>
        ) : (
          <>
            {conseils.bas && (
              <Conseil nom={conseils.bas.intitule} onClick={() => setFeuille("travaux")}>
                <b style={{ color: colors.ink }}>{eur(conseils.bas.parJournee!)}</b> la journée, il en faut {eur(parJournee!)}
                {presqueToutSigne(conseils.bas) ? `, et ${conseils.bas.signes} devis sur ${conseils.bas.envoyes} sont signés.` : "."} 10&nbsp;% plus
                cher : <b style={{ color: colors.ink }}>{eur(aLaCentaine(dixPourCentDePlus(conseils.bas)))}</b> de plus sur l&apos;année, au même nombre de
                chantiers.
              </Conseil>
            )}
            {conseils.signe && (
              <Conseil nom={conseils.signe.intitule} filet={Boolean(conseils.bas)} onClick={() => setFeuille("travaux")}>
                <b style={{ color: colors.ink }}>
                  {conseils.signe.signes} devis signés sur {conseils.signe.envoyes}
                </b>
                . Presque tout est accepté : vos prix peuvent sans doute monter.
              </Conseil>
            )}
            <div className={conseils.bas || conseils.signe ? "pb-1" : "py-1"}>
              <BoutonTexte onClick={() => setFeuille("travaux")}>Tous les travaux</BoutonTexte>
            </div>
          </>
        )}
      </Paquet>

      {/* ─── Les feuilles ──────────────────────────────────────────────── */}
      <BottomSheet open={feuille === "objectif"} onBackdropClick={fermer}>
        <div data-atlas="feuille-objectif">
          <TitreFeuille>Mon objectif {annee}</TitreFeuille>
          <ChampEuros libelle="Chiffre d'affaires, HT" valeur={saisieCa} onChange={setSaisieCa} indication="300 000" />
          {totalAnDernier !== null && (
            <span className="mt-1.5 block text-[13.5px]" style={{ color: colors.inkSoft }}>
              L&apos;an dernier, {eur(totalAnDernier)}.
            </span>
          )}
          {objectifPasseLaFranchise(saisieCa, regimeTva) && (
            <div className="mt-3" data-atlas="objectif-passe-la-franchise">
              <PlageTon ton="ambre">Au-dessus de {eur(PLAFOND_CENTIMES)}, vous sortez de la franchise de TVA.</PlageTon>
            </div>
          )}
          <div className="mt-4">
            <ChampEuros libelle="Bénéfice" valeur={saisieBenefice} onChange={setSaisieBenefice} indication="Facultatif" />
          </div>
          {refus && (
            <div className="mt-4" role="alert">
              <PlageTon ton="rouge">{refus}</PlageTon>
            </div>
          )}
          <div className="mt-5">
            <PrimaryButton pleineLargeur onClick={garder} disabled={enCours} repere="garder-objectif">
              Garder
            </PrimaryButton>
          </div>
          <Fermer onClick={fermer} />
        </div>
      </BottomSheet>

      <BottomSheet open={feuille === "mois"} onBackdropClick={fermer}>
        <div data-atlas="feuille-mois-par-mois">
          <TitreFeuille>Mois par mois</TitreFeuille>
          {reste.map((m) => (
            <Rang
              key={m.mois}
              filet={m.mois !== reste[0].mois}
              nom={maj(NOMS_DES_MOIS[m.mois])}
              sous={`${pluriel(m.joursOuvres, "jour travaillé", "jours travaillés")}, ${eur(Math.round(m.centimes / m.joursOuvres / 1000) * 1000)} par jour`}
              prix={eur(aLaCentaine(m.centimes))}
            />
          ))}
          {etat && <Rang nom="D'ici le 31 décembre" prix={eur(etat.reste)} fort filet />}
          <Fermer onClick={fermer} />
        </div>
      </BottomSheet>

      {face && (
        <BottomSheet open={feuille === "tous"} onBackdropClick={fermer}>
          <div data-atlas="feuille-tous-les-mois">
            <TitreFeuille>Face à {annee - 1}</TitreFeuille>
            <TousLesMois face={face} annee={annee} />
            <Fermer onClick={fermer} />
          </div>
        </BottomSheet>
      )}

      <BottomSheet open={feuille === "travaux"} onBackdropClick={fermer}>
        <div data-atlas="feuille-vos-prix">
          <TitreFeuille>Ce que rapporte une journée</TitreFeuille>
          {objectif && parJournee !== null && (
            <PlageTon ton="or">
              Pour {eur(objectif.chiffreAffaires)}, une journée d&apos;équipe doit rapporter <b style={{ color: colors.ink }}>{eur(parJournee)}</b>.
            </PlageTon>
          )}
          <table className="mt-3.5 w-full border-collapse" style={CHIFFRES}>
            <thead>
              <tr className="text-[13px] font-semibold" style={{ color: colors.inkSoft }}>
                <th scope="col" className="pb-2 text-left font-semibold">Travail</th>
                <th scope="col" className="pb-2 text-right font-semibold">La journée</th>
                <th scope="col" className="pb-2 text-right font-semibold">Signés</th>
              </tr>
            </thead>
            <tbody>
              {prix.map((p) => (
                <tr key={p.tarifId} style={{ boxShadow: `inset 0 1px 0 ${colors.lineSoft}` }}>
                  <td className="py-3 pr-2 text-[17px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
                    {p.intitule}
                    <small className="mt-0.5 block text-[13.5px]" style={{ fontFamily: font.body, color: colors.inkSoft }}>
                      {pluriel(p.chantiers, "chantier facturé", "chantiers facturés")}
                    </small>
                  </td>
                  <td
                    className="py-3 text-right text-[16px]"
                    style={{
                      color: parJournee !== null && p.parJournee !== null && p.parJournee < parJournee ? colors.carteAmbreTexte : colors.ink,
                      fontWeight: parJournee !== null && p.parJournee !== null && p.parJournee < parJournee ? 700 : 400,
                    }}
                  >
                    {p.parJournee === null ? "Pas de durée" : eur(p.parJournee)}
                  </td>
                  <td className="whitespace-nowrap py-3 text-right text-[16px]" style={{ color: colors.ink }}>
                    {p.envoyes > 0 ? `${p.signes} sur ${p.envoyes}` : "Aucun envoi"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[13.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
            Rangé par vos tarifs. Un chantier compte pour le tarif qui fait plus de la moitié de son montant.
          </p>
          <Fermer onClick={fermer} />
        </div>
      </BottomSheet>

      {benefice && (
        <BottomSheet open={feuille === "benefice"} onBackdropClick={fermer}>
          <div data-atlas="feuille-benefice">
            <TitreFeuille>Bénéfice estimé, {annee}</TitreFeuille>
            <Rang nom="Encaissé" prix={eur(benefice.encaisse)} />
            <Rang filet nom="Fournisseurs" prix={`moins ${eur(benefice.fournisseurs)}`} />
            <Rang filet nom="Salaires" prix={`moins ${eur(benefice.salaires)}`} />
            <Rang filet nom="Loyer" prix={`moins ${eur(benefice.loyer)}`} />
            <Rang filet nom="Impôts et cotisations" prix={`moins ${eur(benefice.impots)}`} />
            {benefice.aJustifier > 0 && <Rang filet nom="Pas encore justifié" prix={`moins ${eur(benefice.aJustifier)}`} />}
            <Rang nom="Bénéfice estimé" prix={eur(benefice.benefice)} fort filet />
            <p className="mt-3 text-[13.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
              {benefice.depuis > `${annee}-01-01` && `Depuis le ${quantieme(Number(benefice.depuis.slice(8)))} ${NOMS_DES_MOIS[Number(benefice.depuis.slice(5, 7)) - 1]}. `}
              Pas comptés : vos dépenses perso, vos prêts, les virements entre vos comptes. Le vrai chiffre, c&apos;est votre comptable.
            </p>
            <Fermer onClick={fermer} />
          </div>
        </BottomSheet>
      )}
    </div>
  );
}

function Conseil({ nom, filet = false, onClick, children }: { nom: string; filet?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full py-3.5 text-left"
      style={{ boxShadow: filet ? `inset 0 1px 0 ${colors.lineSoft}` : undefined }}
    >
      <span className="flex items-center justify-between gap-2.5 text-[19px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
        {nom}
        <span style={{ color: colors.chevron }}>
          <IconeTrait nom="suivant" taille={18} epaisseur={2} />
        </span>
      </span>
      <span className="mt-1 block text-[15px] leading-[1.45]" style={{ color: colors.inkSoft, ...CHIFFRES }}>
        {children}
      </span>
    </button>
  );
}

function BlocBenefice({
  benefice,
  objectif,
  onCompte,
}: {
  benefice: BeneficeEstime;
  objectif: { chiffreAffaires: number; benefice: number | null } | null;
  onCompte: () => void;
}) {
  const garde = resteSurMilleEuros(benefice.benefice, benefice.encaisse);
  const faut = objectif?.benefice ? resteSurMilleEuros(objectif.benefice, objectif.chiffreAffaires) : null;
  const ton: Ton = faut !== null && garde !== null && garde < faut ? "ambre" : "vert";
  return (
    <>
      <span className="mb-3.5 block text-[19px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.inkSoft, ...CHIFFRES }}>
        <b className="text-[30px] font-normal" style={{ color: colors.ink }}>{eur(benefice.benefice)}</b>
        {objectif?.benefice ? ` sur ${eur(objectif.benefice)}` : ""}
      </span>
      {objectif?.benefice ? <JaugeAnnee part={benefice.benefice / objectif.benefice} trait={null} ton={ton} /> : null}
      {garde !== null && (
        <div className="mt-3.5">
          <PlageTon ton={ton}>
            Sur 1&nbsp;000&nbsp;€ encaissés, il vous reste <b style={{ color: colors.ink }}>{enEurosEntiers(garde)}</b> une fois tout payé.
            {faut !== null && ` Pour votre objectif, il en faudrait ${enEurosEntiers(faut)}.`}
          </PlageTon>
        </div>
      )}
      <BoutonTexte onClick={onCompte}>Voir le compte</BoutonTexte>
    </>
  );
}

/** Tous les mois face à l'an dernier : 2026 d'abord, 2025 à droite et l'écart dessous, une bande par mois. */
function TousLesMois({ face, annee }: { face: FaceAnDernier; annee: number }) {
  return (
    <table className="mt-1.5 w-full border-separate [border-spacing:0_6px]" style={CHIFFRES}>
      <thead>
        <tr className="text-[13px] font-semibold" style={{ color: colors.inkSoft }}>
          <th scope="col" className="px-3 pb-0.5 text-left font-semibold">Mois</th>
          <th scope="col" className="px-3 pb-0.5 text-right font-semibold">{annee}</th>
          <th scope="col" className="px-3 pb-0.5 text-right font-semibold">{annee - 1}</th>
        </tr>
      </thead>
      <tbody>
        {face.mois.map((m) => {
          const sens = sensDeLEcart(m);
          const teinte = sens === "plus" ? teintesDuTon("vert") : sens === "moins" ? teintesDuTon("rouge") : null;
          const fond = teinte ? { backgroundColor: teinte.fond } : {};
          return (
            <tr key={m.mois} data-sens={sens}>
              <td className="rounded-l-[6px] p-3 align-top text-[17px] leading-[1.3]" style={{ ...fond, fontFamily: font.display, color: colors.ink }}>
                {m.jusquAu ? `Du 1er au ${quantieme(m.jusquAu)} ${NOMS_DES_MOIS[m.mois]}` : maj(NOMS_DES_MOIS[m.mois])}
              </td>
              <td className="whitespace-nowrap p-3 text-right align-top text-[16px]" style={{ ...fond, color: colors.ink }}>
                {eur(m.cetteAnnee)}
              </td>
              <td className="whitespace-nowrap rounded-r-[6px] p-3 text-right align-top text-[16px]" style={{ ...fond, color: colors.ink }}>
                {eur(m.anDernier)}
                <small className="mt-[3px] block whitespace-nowrap text-[13.5px] font-bold" style={{ color: teinte ? teinte.texte : colors.inkSoft }}>
                  {sens === "pareil" ? "Pareil" : `${eur(Math.abs(m.cetteAnnee - m.anDernier))} ${sens === "plus" ? "de plus" : "de moins"}`}
                </small>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ChampEuros({ libelle, valeur, onChange, indication }: { libelle: string; valeur: string; onChange: (v: string) => void; indication: string }) {
  return (
    <label className="block">
      <span className="mb-[7px] block text-[14.5px] font-semibold" style={{ color: colors.inkSoft }}>
        {libelle}
      </span>
      <span className="relative block">
        <input
          inputMode="numeric"
          autoComplete="off"
          value={valeur}
          placeholder={indication}
          onChange={(e) => {
            // Les espaces se posent pendant qu'on tape : « 300 000 » se lit, « 300000 » se recompte.
            const chiffres = e.target.value.replace(/[^\d]/g, "").slice(0, 9);
            onChange(chiffres ? new Intl.NumberFormat("fr-FR").format(Number(chiffres)) : "");
          }}
          className="block min-h-[52px] w-full rounded-[6px] border-0 px-[15px] py-3.5 pr-10 text-[20px] outline-none"
          style={{ backgroundColor: colors.cream, color: colors.ink, ...CHIFFRES }}
        />
        <span className="pointer-events-none absolute bottom-3.5 right-[15px] text-[18px]" style={{ color: colors.inkSoft }}>
          €
        </span>
      </span>
    </label>
  );
}
