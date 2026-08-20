"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import {
  filtrerClientsParNom,
  aucunClientTrouve,
} from "@/lib/recherche-client";

/**
 * La liste des clients, et le champ qui les retrouve.
 *
 * **Sa demande du 20 août 2026 :** *« Il faut une barre de recherche où je peux
 * taper le nom d'un client pour le retrouver plus facilement »*, capture à
 * l'appui — vingt et un noms, dont quatre Martins, et le sien perdu au milieu.
 * Déjà dessinée le 17 août (`appli/clients-recherche.html`, proposition B).
 *
 * **Le tri se fait ICI, dans le navigateur, et pas au serveur.** Vingt et un
 * noms tiennent dans une page ; les envoyer chercher à chaque lettre tapée
 * ferait attendre un aller-retour réseau par frappe, sur un téléphone en 5G au
 * bord d'un chantier. Le jour où un artisan en aura deux mille, ce choix se
 * révisera — et la règle, elle, ne bougera pas : elle vit dans
 * `src/lib/recherche-client.ts`, hors de cet écran.
 *
 * **La règle n'est pas réécrite ici** (`CLAUDE.md` §3) : `filtrerClientsParNom`
 * sert à l'écran ET à la suite. Deux implémentations divergent toujours, et
 * c'est l'écran qui a tort sans que rien ne le dise.
 */
export type FicheClientListee = {
  id: string;
  nom: string;
  chantiers: number;
  facture: string | number | null;
  du: string | number | null;
};

export default function ListeClients({
  clients,
}: {
  clients: FicheClientListee[];
}) {
  const [saisie, setSaisie] = useState("");
  const visibles = useMemo(
    () => filtrerClientsParNom(clients, saisie),
    [clients, saisie],
  );
  const cherche = saisie.trim().length > 0;

  return (
    <>
      {/* **Le champ est TOUJOURS là, et c'est un choix.** Une première version
          ne le montrait qu'à partir de cinq clients — moins de meuble sur un
          écran presque vide. Mais une barre qui apparaît et disparaît est une
          règle de plus à deviner : le jour où il en a quatre, il la cherche et
          conclut qu'elle a été retirée. Un champ vide ne coûte rien à lire ;
          une règle invisible coûte un message. */}
      <div className="relative mx-[26px] mt-[18px]">
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
          onChange={(e) => setSaisie(e.target.value)}
          placeholder="Chercher un client"
          aria-label="Chercher un client"
          data-atlas="chercher-client"
          className="w-full rounded-[10px] border-0 py-[13px] pl-[14px] pr-[46px] outline-none"
          style={{
            backgroundColor: colors.rustTint,
            color: colors.ink,
            // **16 px au moins.** En dessous, Safari sur iPhone zoome tout
            // seul au premier appui et l'écran part de travers — le patron
            // se retrouve avec une page décalée qu'il faut repincer.
            fontSize: 16,
            minHeight: 50,
          }}
        />
        {/* Notre croix : de la couleur de l'application, et assez grande pour
            un pouce. Elle n'existe que s'il y a quelque chose à effacer — un
            bouton qui ne fait rien est un bouton de trop. */}
        {cherche && (
          <button
            type="button"
            onClick={() => setSaisie("")}
            aria-label="Effacer la recherche"
            data-atlas="effacer-recherche"
            className="absolute right-0 top-0 flex h-full w-[46px] items-center justify-center"
            style={{ color: colors.muted, fontSize: 19, lineHeight: 1 }}
          >
            ✕
          </button>
        )}
      </div>

      {visibles.length === 0 ? (
        <p
          className="mx-[26px] mt-[22px] text-[13px] leading-[1.6]"
          style={{ color: colors.muted }}
        >
          {aucunClientTrouve(saisie)}
        </p>
      ) : (
        <ul className="mx-[26px] mt-[20px] flex flex-col">
          {visibles.map((c, i) => (
            <li key={c.id}>
              <Link
                href={`/clients/${c.id}`}
                className="flex min-h-[56px] w-full items-center gap-[15px] py-[13px]"
                style={
                  i === visibles.length - 1
                    ? undefined
                    : { borderBottom: `1px solid ${colors.line}` }
                }
              >
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-[17px] leading-[1.25]"
                    style={{ fontFamily: font.display, color: colors.ink }}
                  >
                    {c.nom}
                  </span>
                  <span
                    className="mt-[3px] block text-[11.5px] leading-[1.5]"
                    style={{ color: colors.muted }}
                  >
                    {c.chantiers === 0
                      ? "aucun chantier"
                      : c.chantiers === 1
                        ? "1 chantier"
                        : `${c.chantiers} chantiers`}
                    {c.facture
                      ? ` · ${enEuros(c.facture)} facturés`
                      : " · rien de facturé"}
                  </span>
                </span>

                {/* Ce qui reste dû passe avant tout le reste : c'est la seule
                    chose qui demande un geste. Absent quand rien n'est dû —
                    un « 0 € » en face de chaque nom ferait un tableau de bord,
                    exactement ce qu'il refuse. */}
                {c.du && Number(c.du) > 0 && (
                  <span
                    className={`flex-none ${libelleCaps}`}
                    style={{ color: colors.alert }}
                  >
                    {enEuros(c.du)} dus
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
            </li>
          ))}
        </ul>
      )}

      {/* **Le compte ne s'affiche que pendant une recherche.** Hors recherche,
          le titre de l'écran le porte déjà, et le redire serait la redite qu'il
          nous reproche. */}
      {cherche && visibles.length > 0 && (
        <p
          className={`mx-[26px] mt-[16px] ${libelleCaps}`}
          style={{ color: colors.muted }}
        >
          {visibles.length === 1
            ? "1 client trouvé"
            : `${visibles.length} clients trouvés`}
        </p>
      )}
    </>
  );
}
