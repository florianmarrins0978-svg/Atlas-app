"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { colors, font, libelleCaps, voile } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { grouperEnBandes } from "@/lib/bandes-clients";
import {
  filtrerClientsParNom,
  aucunClientTrouve,
  morceauxSurlignes,
} from "@/lib/recherche-client";

/**
 * La liste des clients, et le champ qui les retrouve.
 *
 * **Sa demande du 20 août 2026 :** *« Il faut une barre de recherche où je peux
 * taper le nom d'un client pour le retrouver plus facilement »*, capture à
 * l'appui — vingt et un noms, dont quatre Martins, et le sien perdu au milieu.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **REFONDU LE 3 SEPTEMBRE 2026, sur maquette qu'il a regardée puis retenue :**
 * *« tu peux coder exactement cette maquette »* (`appli/vos-clients.html`). Il
 * avait nommé trois manques, et un seul d'entre eux tenait à l'apparence :
 *
 *   1. *« quatre clients s'appellent Martins : rien ne me dit lequel c'est »* —
 *      **le lieu prend la deuxième ligne**. La colonne existait
 *      (`clients.adresse`) ; seule cette liste ne la chargeait pas ;
 *   2. *« ce qui reste dû est la seule chose qui demande un geste, et c'est
 *      écrit tout petit, en bout de ligne »* — il passe de 9,5 px en capitales
 *      à **16 px**, à hauteur du nom ;
 *   3. *« une liste longue se parcourt à l'aveugle : ni ordre annoncé, ni
 *      repère »* — **les bandes** (`src/lib/bandes-clients.ts`) nomment l'ordre
 *      que le dépôt appliquait déjà en silence.
 *
 * **CE QUI A ÉTÉ RETIRÉ, et il l'a tranché** : le total facturé par client
 * (« 2 940,00 € facturés ») quitte la ligne. Deux montants sur une même ligne,
 * l'un gris l'autre rouge, se confondent au premier coup d'œil — et c'est le
 * rouge qui compte. Il ne se lit plus nulle part ailleurs depuis que la fiche a
 * été allégée le 2 septembre : c'est le prix, il a été dit, et il l'a accepté.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Le tri se fait au dépôt, le filtre ICI.** Vingt et un noms tiennent dans une
 * page ; les envoyer chercher à chaque lettre tapée ferait attendre un
 * aller-retour réseau par frappe, sur un téléphone en 5G au bord d'un chantier.
 * Le jour où un artisan en aura deux mille, ce choix se révisera — et les règles
 * ne bougeront pas : elles vivent dans `src/lib/`, hors de cet écran
 * (`CLAUDE.md` §3).
 */
export type FicheClientListee = {
  id: string;
  nom: string;
  /** Ce qui distingue quatre Martins. `null` : jamais renseignée. */
  adresse: string | null;
  chantiers: number;
  facture: string | number | null;
  du: string | number | null;
  /** Le jour du chantier le plus récent : c'est l'ordre, et c'est la bande. */
  dernierJour: string | null;
};

/**
 * ─── POURQUOI UN CONTEXTE, POUR UN SEUL CHAMP DE SAISIE ──────────────────────
 *
 * **Le compte a quitté le bas de la liste pour l'en-tête**, et il suit la
 * frappe : « 21 clients » devient « 4 clients trouvés ». Écrit sous le dernier
 * résultat, il était hors de l'écran au moment précis où il sert — on tape, on
 * regarde le haut, et rien ne dit combien de noms restent.
 *
 * Or l'en-tête est rendu par `EnTeteEcran`, qui ne connaît pas la saisie. Deux
 * solutions : monter tout l'écran dans le navigateur, ou faire descendre la
 * saisie à deux endroits. C'est la seconde — l'en-tête reste rendu au serveur,
 * et seule la ligne du compte s'anime.
 */
type EtatRecherche = {
  saisie: string;
  poser: (valeur: string) => void;
  total: number;
  visibles: FicheClientListee[];
  aujourdHui: string;
};

const Contexte = createContext<EtatRecherche | null>(null);

function useRecherche(): EtatRecherche {
  const etat = useContext(Contexte);
  // Hors du fournisseur, il n'y aurait rien à chercher : mieux vaut le dire ici
  // que de rendre un compte faux sur son écran.
  if (!etat) throw new Error("Cette pièce doit vivre dans <FournisseurClients>.");
  return etat;
}

export function FournisseurClients({
  clients,
  aujourdHui,
  children,
}: {
  clients: FicheClientListee[];
  /**
   * Le jour tel que l'application le compte, **posé au serveur**.
   *
   * Le lire ici avec `new Date()` donnerait l'horloge du téléphone : entre
   * minuit et deux heures du matin, l'heure d'été sépare les deux, et le serveur
   * et le navigateur ne nommeraient pas la même bande. React s'en plaindrait, et
   * lui verrait « août » clignoter en « septembre ».
   */
  aujourdHui: string;
  children: React.ReactNode;
}) {
  const [saisie, poser] = useState("");
  const visibles = useMemo(() => filtrerClientsParNom(clients, saisie), [clients, saisie]);
  const valeur = useMemo(
    () => ({ saisie, poser, total: clients.length, visibles, aujourdHui }),
    [saisie, clients.length, visibles, aujourdHui]
  );
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

/**
 * Le compte, sous le titre de l'écran.
 *
 * **La place est gardée même quand il n'y a rien à dire** — trouvé en regardant
 * une capture, jamais par un contrôle : quand une recherche ne rend rien, cette
 * ligne se vidait, disparaissait, et le champ de saisie remontait de vingt-
 * quatre pixels sous le doigt. À chaque frappe qui ne trouve pas.
 */
export function CompteClients() {
  const { saisie, total, visibles } = useRecherche();
  const cherche = saisie.trim().length > 0;
  const n = cherche ? visibles.length : total;
  const mot = n === 1 ? "1 client" : `${n} clients`;
  // Rien trouvé : la phrase juste en dessous le dit déjà, en citant sa frappe.
  // Le redire ici en capitales serait la redite qu'il nous reproche.
  const texte = cherche && n === 0 ? "" : cherche ? `${mot} trouvé${n > 1 ? "s" : ""}` : mot;
  return (
    <span className="block min-h-[14px]" data-atlas="compte-clients">
      {texte}
    </span>
  );
}

export default function ListeClients() {
  const { saisie, poser, visibles, aujourdHui } = useRecherche();
  const cherche = saisie.trim().length > 0;

  // **Le filet sous la barre collante n'apparaît qu'une fois qu'elle colle.**
  // Un repère posé en permanence serait un trait de plus sur un écran qui n'en
  // porte aucun ; il ne sert qu'à séparer la barre des lignes qui passent
  // dessous. La sentinelle mesure la page plutôt qu'un seuil écrit en dur, qui
  // serait faux dès qu'un mot du titre passe à la ligne.
  const sentinelle = useRef<HTMLDivElement>(null);
  const [posee, setPosee] = useState(false);
  useEffect(() => {
    const cible = sentinelle.current;
    if (!cible || typeof IntersectionObserver === "undefined") return;
    const veille = new IntersectionObserver(([e]) => setPosee(!e.isIntersecting), {
      threshold: 0,
    });
    veille.observe(cible);
    return () => veille.disconnect();
  }, []);

  const bandes = useMemo(
    () => grouperEnBandes(visibles, aujourdHui),
    [visibles, aujourdHui]
  );

  return (
    <>
      <div ref={sentinelle} aria-hidden="true" className="h-px" />

      {/* **Le champ est TOUJOURS là, et c'est un choix.** Une première version
          ne le montrait qu'à partir de cinq clients — moins de meuble sur un
          écran presque vide. Mais une barre qui apparaît et disparaît est une
          règle de plus à deviner : le jour où il en a quatre, il la cherche et
          conclut qu'elle a été retirée. Un champ vide ne coûte rien à lire ;
          une règle invisible coûte un message.

          **Et il COLLE en haut depuis le 3 septembre 2026.** Sur vingt et un
          noms on descend ; l'outil qui sert à remonter ne doit pas être resté
          en haut de la page. */}
      <div
        className="sticky top-0 z-[5] px-[26px] pb-[14px] pt-[18px]"
        style={{
          backgroundColor: colors.cream,
          boxShadow: posee ? `0 1px 0 ${colors.line}` : "none",
          transition: "box-shadow 180ms ease-out",
        }}
      >
        <div
          className="relative flex items-center rounded-[10px] pl-[44px] pr-[46px] focus-within:shadow-[inset_0_0_0_1.5px_var(--atlas-or,#B98B47)]"
          style={{ backgroundColor: colors.rustTint, minHeight: 50 }}
        >
          {/* La loupe dit ce que fait la plage sans un mot de plus. Dessinée,
              jamais un caractère emprunté à une police d'émojis. */}
          <svg
            aria-hidden="true"
            width="19"
            height="19"
            viewBox="0 0 20 20"
            fill="none"
            stroke={colors.muted}
            strokeWidth="1.6"
            className="pointer-events-none absolute left-[15px] top-1/2 -translate-y-1/2"
          >
            <circle cx="8.2" cy="8.2" r="6.2" />
            <path d="M12.8 12.8L18 18" strokeLinecap="round" />
          </svg>

          {/* **`type="text"`, et surtout PAS `type="search"`.** Trouvé en
              regardant la capture, jamais par une suite : le navigateur ajoute
              alors sa propre croix d'effacement, et elle est d'un BLEU VIF qui
              n'existe nulle part dans Atlas. Sur un écran de crème et de bronze,
              c'est la seule tache de couleur de la page. On la refuse et l'on
              pose la nôtre, ci-dessous. */}
          <input
            type="text"
            inputMode="search"
            autoComplete="off"
            value={saisie}
            onChange={(e) => poser(e.target.value)}
            placeholder="Chercher un client"
            aria-label="Chercher un client"
            data-atlas="chercher-client"
            className="w-full border-0 bg-transparent py-[13px] outline-none"
            style={{
              color: colors.ink,
              // **16 px au moins.** En dessous, Safari sur iPhone zoome tout
              // seul au premier appui et l'écran part de travers — le patron
              // se retrouve avec une page décalée qu'il faut repincer.
              fontSize: 16,
              // Le trait qui clignote appartient à la charte comme le reste :
              // celui du navigateur ne connaît aucune des huit.
              caretColor: colors.or,
            }}
          />

          {/* Notre croix : de la couleur de l'application, et assez grande pour
              un pouce. Elle n'existe que s'il y a quelque chose à effacer — un
              bouton qui ne fait rien est un bouton de trop. */}
          {cherche && (
            <button
              type="button"
              onClick={() => poser("")}
              aria-label="Effacer la recherche"
              data-atlas="effacer-recherche"
              className="absolute right-0 top-0 flex h-full w-[46px] items-center justify-center"
              style={{ color: colors.muted, fontSize: 19, lineHeight: 1 }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {visibles.length === 0 ? (
        <p
          className="mx-[26px] mt-[22px] max-w-[31ch] text-[13px] leading-[1.6]"
          // **`inkSoft`, et non le gris des méta.** Mesuré : `muted` tient 3,32
          // de contraste sur le fond crème — sous le seuil de lecture, et c'est
          // la première chose qui s'efface au soleil. C'est la seule phrase de
          // l'écran, et elle doit se lire.
          style={{ color: colors.inkSoft }}
        >
          {aucunClientTrouve(saisie)}
        </p>
      ) : (
        <div className="mt-[6px]">
          {bandes.map((groupe, iBande) => (
            <section key={groupe.bande}>
              {/* **Pendant une recherche, aucune bande.** Quatre Martins rangés
                  sous trois mois différents feraient trois titres pour quatre
                  lignes : le repère deviendrait le bruit qu'il devait réduire. */}
              {!cherche && (
                <p
                  className={`mx-[26px] mb-[2px] ${iBande === 0 ? "mt-[14px]" : "mt-[24px]"} ${libelleCaps}`}
                  style={{ color: colors.muted }}
                >
                  {groupe.bande}
                </p>
              )}
              <ul className="mx-[26px] flex flex-col">
                {groupe.clients.map((c) => (
                  <li key={c.id}>
                    <LigneClient
                      client={c}
                      saisie={saisie}
                      // Le filet ferme chaque ligne sauf la toute dernière de
                      // l'écran : un trait au ras du vide n'y sépare rien.
                      dernier={
                        iBande === bandes.length - 1 &&
                        c.id === groupe.clients[groupe.clients.length - 1].id
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function LigneClient({
  client,
  saisie,
  dernier,
}: {
  client: FicheClientListee;
  saisie: string;
  dernier: boolean;
}) {
  const morceaux = morceauxSurlignes(client.nom, saisie);
  const chantiers =
    client.chantiers === 0
      ? "aucun chantier"
      : client.chantiers === 1
        ? "1 chantier"
        : `${client.chantiers} chantiers`;
  // Le lieu d'abord, parce que c'est lui qu'on cherche du regard ; le compte
  // ensuite, parce qu'il tient en deux mots. Sans adresse, la ligne se contente
  // du compte plutôt que d'annoncer un manque qu'il n'a pas demandé à combler.
  const dit = client.adresse ? `${client.adresse} · ${chantiers}` : chantiers;
  const du = client.du !== null && Number(client.du) > 0 ? client.du : null;

  return (
    <Link
      href={`/clients/${client.id}`}
      className="flex min-h-[64px] w-full items-center gap-[14px] py-[13px]"
      style={{ borderBottom: dernier ? undefined : `1px solid ${colors.line}` }}
    >
      <span className="min-w-0 flex-1">
        <span
          className="block truncate text-[17.5px] leading-[1.25]"
          data-atlas="nom-client"
          style={{ fontFamily: font.display, color: colors.ink }}
        >
          {morceaux.map((m, i) =>
            m.trouve ? (
              // **Ce qui a été trouvé se voit.** Sur quatre clients qui
              // s'appellent Martins, une recherche sans marque ressemble à une
              // recherche qui n'a pas filtré.
              <mark
                key={i}
                style={{
                  backgroundColor: voile(colors.or, 0.24),
                  color: "inherit",
                  borderRadius: 2,
                  padding: "0 1px",
                }}
              >
                {m.texte}
              </mark>
            ) : (
              <span key={i}>{m.texte}</span>
            )
          )}
        </span>
        <span
          className="mt-[3px] block truncate text-[12.5px] leading-[1.45]"
          data-atlas="situation-client"
          // Voir plus haut : `muted` ne tient pas la lecture au soleil, et
          // c'est cette ligne-ci qui répond à « lequel des quatre Martins ? ».
          style={{ color: colors.inkSoft }}
        >
          {dit}
        </span>
      </span>

      {/* Ce qui reste dû passe avant tout le reste : c'est la seule chose qui
          demande un geste. Absent quand rien n'est dû — un « 0 € » en face de
          chaque nom ferait un tableau de bord, exactement ce qu'il refuse. */}
      {du !== null && (
        <span className="flex-none text-right" data-atlas="reste-du">
          <span
            className="block text-[16px] font-medium leading-[1.15]"
            style={{
              color: colors.alert,
              // Les chiffres d'une colonne s'alignent : « 740,00 € » et
              // « 1 260,00 € » doivent tomber sur la même virgule.
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            {enEuros(du)}
          </span>
          <span className={`mt-[3px] block ${libelleCaps}`} style={{ color: colors.alert }}>
            dus
          </span>
        </span>
      )}

      <span
        aria-hidden="true"
        className="h-2 w-2 rotate-45"
        style={{
          flex: "none",
          borderRight: `1.5px solid ${colors.chevron}`,
          borderTop: `1.5px solid ${colors.chevron}`,
        }}
      />
    </Link>
  );
}
