"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type DeviceRow = {
  id: string;
  localisation_zone: string;
  emplacement: string;
  type_dispositif: string;
  numero: number;
  position: number;
};

type ClientRow = {
  name: string;
  code_client: string;
  city: string | null;
};

type RecordDbRow = {
  id: string;
  client_id: string | null;
  commentaire: string | null;
  groupe: string | null;
  annexe_contrat_numero: string | null;
  date_fiche: string | null;
};

type RecordMeta = {
  id: string;
  commentaire: string | null;
  groupe: string | null;
  annexe_contrat_numero: string | null;
  date_fiche: string | null;
  client: ClientRow | null;
};

export default function PdfPage() {
  const params = useParams();
  const recordId = String((params as any)?.id ?? "");

  const [meta, setMeta] = useState<RecordMeta | null>(null);
  const [rows, setRows] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const exportDate = useMemo(() => new Date(), []);

  useEffect(() => {
    if (!recordId) return;

    const fetchAll = async () => {
      setLoading(true);

      try {
        // 1) Record (sans join client pour éviter les types "client: []" en prod)
        const { data: rec, error: recErr } = await supabase
          .from("records")
          .select("id, client_id, commentaire, groupe, annexe_contrat_numero, date_fiche")
          .eq("id", recordId)
          .single();

        if (recErr) throw recErr;
        const recRow = rec as unknown as RecordDbRow;

        // 2) Client (si client_id)
        let client: ClientRow | null = null;

        if (recRow.client_id) {
          const { data: cli, error: cliErr } = await supabase
            .from("clients")
            .select("name, code_client, city")
            .eq("id", recRow.client_id)
            .single();

          if (cliErr) {
            // on ne bloque pas le PDF si le client n'est pas trouvable
            console.error("PDF FETCH CLIENT ERROR", cliErr);
          } else {
            client = (cli as unknown as ClientRow) ?? null;
          }
        }

        // ✅ On construit l'objet meta explicitement (plus de `as RecordMeta`)
        setMeta({
          id: recRow.id,
          commentaire: recRow.commentaire,
          groupe: recRow.groupe,
          annexe_contrat_numero: recRow.annexe_contrat_numero,
          date_fiche: recRow.date_fiche,
          client,
        });

        // 3) Lignes
        const { data: devices, error: devErr } = await supabase
          .from("record_devices")
          .select("id, localisation_zone, emplacement, type_dispositif, numero, position")
          .eq("record_id", recordId)
          .order("position", { ascending: true });

        if (devErr) throw devErr;

        setRows(((devices ?? []) as unknown) as DeviceRow[]);

        setLoading(false);

        // 4) Print (petit délai pour laisser le DOM se peindre)
        setTimeout(() => window.print(), 250);
      } catch (err: any) {
        console.error("PDF FETCH ERROR (FULL)", {
          message: err?.message,
          details: err?.details,
          hint: err?.hint,
          code: err?.code,
          raw: err,
        });
        setMeta(null);
        setRows([]);
        setLoading(false);
      }
    };

    fetchAll();
  }, [recordId]);

  if (loading) return <p style={{ padding: 20 }}>Préparation du PDF…</p>;
  if (!meta) return <p style={{ padding: 20 }}>Impossible de générer le PDF.</p>;

  return (
    <div className="pdfRoot">
      <style>{printCss}</style>

      {/* ✅ Zone imprimable */}
      <div className="printArea">
        {/* Bandeau */}
        <header className="header">
          <div>
            <div className="label">Raison sociale client</div>
            <div className="value">{meta.client?.name ?? "—"}</div>
          </div>

          <div>
            <div className="label">Ville</div>
            <div className="value">{meta.client?.city ?? "—"}</div>
          </div>

          <div>
            <div className="label">Code client</div>
            <div className="value">{meta.client?.code_client ?? "—"}</div>
          </div>

          <div>
            <div className="label">Groupe</div>
            <div className="value">{meta.groupe ?? "—"}</div>
          </div>

          <div>
            <div className="label">Annexe au contrat d’abonnement n°</div>
            <div className="value">{meta.annexe_contrat_numero ?? "—"}</div>
          </div>

          <div>
            <div className="label">Date de la fiche</div>
            <div className="value">{meta.date_fiche ?? "—"}</div>
          </div>
        </header>

        {/* Date export */}
        <div className="exportRow">
          <div className="exportLabel">Date d’export :</div>
          <div className="exportValue">{exportDate.toLocaleString("fr-FR")}</div>
        </div>

        {/* Commentaire */}
        <section className="section">
          <h2 className="h2">Commentaire</h2>
          <div className="commentBox">{meta.commentaire?.trim() ? meta.commentaire : "—"}</div>
        </section>

        {/* Tableau */}
        <section className="section">
          <h2 className="h2">Implantation des dispositifs</h2>

          <table className="table">
            <thead>
              <tr>
                <th>Localisation zone</th>
                <th>Emplacement</th>
                <th>Type dispositif</th>
                <th style={{ width: 70 }}>N°</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 10 }}>
                    Aucun dispositif
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.localisation_zone || "—"}</td>
                    <td>{r.emplacement || "—"}</td>
                    <td>{r.type_dispositif || "—"}</td>
                    <td style={{ textAlign: "center", fontWeight: 700 }}>
                      {Number.isFinite(Number(r.numero)) ? r.numero : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>

      {/* UI hors impression */}
      <div className="noPrint actions">
        <button onClick={() => window.print()} className="btn">
          Imprimer / Sauver en PDF
        </button>
      </div>
    </div>
  );
}

const printCss = `
/* Layout écran */
.pdfRoot{
  padding:16px;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  color:#111827;
  background:#ffffff;
}
.printArea{
  /* largeur max lisible à l’écran */
  max-width: 1000px;
}
.header{
  display:grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap:12px;
  border:1px solid #e5e7eb;
  border-radius:12px;
  padding:12px;
}
.label{
  font-size:11px;
  color:#6b7280;
  font-weight:700;
  margin-bottom:4px;
}
.value{
  font-size:13px;
  font-weight:700;
}
.exportRow{
  margin-top:10px;
  display:flex;
  gap:8px;
  align-items:center;
  color:#374151;
  font-size:12px;
}
.exportLabel{ font-weight:700; }
.section{ margin-top:16px; }
.h2{
  margin:0 0 8px 0;
  font-size:14px;
  font-weight:800;
}
.commentBox{
  border:1px solid #e5e7eb;
  border-radius:12px;
  padding:12px;
  min-height:60px;
  white-space:pre-wrap;
}
.table{
  width:100%;
  border-collapse:collapse;
  border:1px solid #e5e7eb;
  border-radius:12px;
  overflow:hidden;
}
.table thead th{
  background:#f9fafb;
  text-align:left;
  font-size:12px;
  padding:10px;
  border-bottom:1px solid #e5e7eb;
}
.table tbody td{
  font-size:12px;
  padding:10px;
  border-top:1px solid #e5e7eb;
  vertical-align:top;
}
.actions{ margin-top:16px; }
.btn{
  padding:10px 14px;
  border-radius:10px;
  border:1px solid #d1d5db;
  background:#111827;
  color:#fff;
  font-weight:800;
  cursor:pointer;
}

/* Print */
@page { size: A4 portrait; margin: 12mm; }

@media print {
  /* ✅ clé: on cache tout le document, puis on ré-affiche uniquement .printArea */
  body * { visibility: hidden !important; }

  .printArea, .printArea * { visibility: visible !important; }

  /* ✅ on place la zone imprimable en haut à gauche */
  .printArea{
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    max-width: none;
    padding: 0;
  }

  /* bouton print caché */
  .noPrint{ display:none !important; }

  /* arrondis optionnels en print */
  .header{ border-radius:0; }
  .commentBox{ border-radius:0; }
  .table{ border-radius:0; }

  /* éviter que les lignes se coupent */
  tr { break-inside: avoid; page-break-inside: avoid; }
  thead { display: table-header-group; }
}
`;
