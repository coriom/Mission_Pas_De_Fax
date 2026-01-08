"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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

type RecordPhoto = {
  id: string;
  record_id: string;
  path: string;
  filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  position: number;
  created_at: string;
  created_by: string | null;
};

type PdfPhotoItem = {
  id: string;
  path: string;
  filename: string | null;
  position: number;
  signedUrl: string | null;
};

const PHOTO_BUCKET = "record-photos";

/**
 * ✅ Objectif (modif demandée):
 * - En impression: chaque photo prend (presque) toute la page A4 (max possible)
 * - On force une hauteur "page" en print + 1 colonne
 * - On garde un rendu propre même si ratios différents (object-fit: contain ou cover)
 *
 * Choix:
 * - Écran: grille 2 colonnes avec cadres homogènes
 * - Print: 1 colonne, et chaque photo devient un "slide" (un bloc page)
 * - Pour remplir un max sans couper: object-fit: contain (pas de recadrage)
 *   -> Si tu veux vraiment FULL BLEED (recadrage), passe à cover dans le CSS print (commenté plus bas).
 */
export default function PdfPage() {
  const params = useParams();
  const recordId = String((params as any)?.id ?? "");

  const [meta, setMeta] = useState<RecordMeta | null>(null);
  const [rows, setRows] = useState<DeviceRow[]>([]);
  const [photos, setPhotos] = useState<PdfPhotoItem[]>([]);
  const [loading, setLoading] = useState(true);

  const exportDate = useMemo(() => new Date(), []);
  const printRequestedRef = useRef(false);

  const printablePhotos = useMemo(() => {
    return [...photos].sort((a, b) => Number(a.position) - Number(b.position));
  }, [photos]);

  useEffect(() => {
    if (!recordId) return;

    const fetchAll = async () => {
      setLoading(true);
      printRequestedRef.current = false;

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
            // non bloquant
            console.error("PDF FETCH CLIENT ERROR", cliErr);
          } else {
            client = (cli as unknown as ClientRow) ?? null;
          }
        }

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

        // 4) Photos (table record_photos + signed urls)
        const { data: photoRows, error: photoErr } = await supabase
          .from("record_photos")
          .select("id, record_id, path, filename, mime_type, size_bytes, position, created_at, created_by")
          .eq("record_id", recordId)
          .order("position", { ascending: true });

        if (photoErr) {
          console.error("PDF FETCH PHOTOS ERROR", photoErr);
          setPhotos([]);
        } else {
          const list = (photoRows ?? []) as RecordPhoto[];

          // Signed URLs batch
          const paths = list.map((p) => p.path).filter(Boolean);

          const signedUrlByPath = new Map<string, string>();

          if (paths.length > 0) {
            const { data: signed, error: signErr } = await supabase.storage
              .from(PHOTO_BUCKET)
              .createSignedUrls(paths, 60 * 30); // 30 minutes

            if (signErr) {
              console.error("PDF SIGNED URLS ERROR", signErr);
            } else {
              (signed ?? []).forEach((s) => {
                if (s?.path && s?.signedUrl) signedUrlByPath.set(s.path, s.signedUrl);
              });
            }
          }

          const items: PdfPhotoItem[] = list.map((p) => ({
            id: p.id,
            path: p.path,
            filename: p.filename ?? null,
            position: Number(p.position) || 0,
            signedUrl: signedUrlByPath.get(p.path) ?? null,
          }));

          setPhotos(items);
        }

        setLoading(false);
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
        setPhotos([]);
        setLoading(false);
      }
    };

    fetchAll();
  }, [recordId]);

  /**
   * ✅ Impression auto quand:
   * - la page n’est plus en loading
   * - et qu’on a eu le temps de charger les images (best effort)
   *
   * Important: on utilise printablePhotos (state à jour),
   * pas `photos` dans le fetch (qui n'est pas encore à jour).
   */
  useEffect(() => {
    if (loading) return;
    if (!meta) return;
    if (printRequestedRef.current) return;

    const run = async () => {
      printRequestedRef.current = true;

      // best effort: précharge les images (évite PDF sans photos)
      await preloadImages(printablePhotos, 6000);

      // petit délai pour laisser le DOM se peindre
      setTimeout(() => window.print(), 250);
    };

    run();
  }, [loading, meta, printablePhotos]);

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

        {/* ✅ PHOTOS */}
        <section className="section photosSection">
          <h2 className="h2">Photos</h2>

          {printablePhotos.length === 0 ? (
            <div className="muted">Aucune photo enregistrée.</div>
          ) : (
            <div className="photoGrid">
              {printablePhotos.map((p) => (
                <figure key={p.id} className="photoCard">
                  <div className="photoImgWrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.signedUrl ? (
                      <img src={p.signedUrl} alt={p.filename ?? "photo"} className="photoImg" />
                    ) : (
                      <div className="photoMissing">Image indisponible</div>
                    )}
                  </div>
                  <figcaption className="photoCaption">
                    {p.filename ?? p.path.split("/").pop() ?? "Photo"}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
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

/** ✅ Best effort: précharge les images avant impression (évite PDF sans photos) */
async function preloadImages(items: PdfPhotoItem[], timeoutMs: number) {
  const urls = items.map((i) => i.signedUrl).filter(Boolean) as string[];
  if (urls.length === 0) return;

  const loadOne = (src: string) =>
    new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = src;
    });

  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));

  await Promise.race([Promise.all(urls.map(loadOne)).then(() => undefined), timeout]);
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

/* Photos */
.muted{
  font-size:12px;
  color:#6b7280;
  font-weight:700;
}

/* ✅ écran: 2 colonnes */
.photoGrid{
  display:grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap:12px;
}

.photoCard{
  border:1px solid #e5e7eb;
  border-radius:12px;
  overflow:hidden;
  break-inside: avoid;
  page-break-inside: avoid;
}

/* ✅ écran: cadre fixe (homogène) */
.photoImgWrap{
  width:100%;
  height: 360px;
  background:#f9fafb;
  display:block;
}

.photoImg{
  width:100%;
  height:100%;
  object-fit: cover;
  object-position: center;
  display:block;
}

.photoMissing{
  width:100%;
  height:100%;
  display:grid;
  place-items:center;
  background:#f9fafb;
  color:#6b7280;
  font-weight:800;
}

.photoCaption{
  padding:8px 10px;
  font-size:12px;
  font-weight:800;
  color:#374151;
  border-top:1px solid #e5e7eb;
  word-break: break-word;
}

/* ======================
   PRINT (A4)
   Objectif: max taille
====================== */

/* ✅ marges réduites pour gagner en taille (tu peux mettre 4mm si imprimante OK) */
@page { size: A4 portrait; margin: 6mm; }

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
  .photoCard{ border-radius:0; }

  /* éviter que les lignes se coupent */
  tr { break-inside: avoid; page-break-inside: avoid; }
  thead { display: table-header-group; }

  /* ✅ en print: 1 colonne */
  .photoGrid{
    grid-template-columns: 1fr;
    gap: 0;
  }

  /* ✅ chaque photo = "page" (un bloc par page) */
  .photoCard{
    border: none;
    page-break-inside: avoid;
    break-inside: avoid;
    /* force une nouvelle page après chaque photo (sauf si navigateur ignore) */
    page-break-after: always;
    break-after: page;
    margin: 0;
  }

  /* ✅ on retire le titre "Photos" de la 2e page si tu veux le garder uniquement une fois.
     (ici on le garde, mais tu peux mettre: display:none) */
  /* .photosSection .h2 { display:none; } */

  /* ✅ image quasi pleine page:
     - 100vh en print marche bien dans Chrome/Edge
     - on retire l'espace légende en dessous pour max place */
  .photoCaption{
    padding: 4mm 0 0 0;
    border-top: none;
    font-size: 11px;
  }

  /* ✅ le wrap prend quasi toute la hauteur de page imprimable */
  .photoImgWrap{
    width: 100%;
    height: 90vh;  /* <-- MAX visuel: augmente/diminue (85vh..95vh) selon rendu */
    background: #ffffff;
  }

  /* ✅ contain = pas de recadrage, max possible sans couper */
  .photoImg{
    object-fit: contain;
    background: #ffffff;
  }

  /* 🔥 Si tu veux FULL BLEED (max mais recadrage), remplace par:
     .photoImg{ object-fit: cover; } */
  
  /* sécurité anti-coupe */
  img{ break-inside: avoid; page-break-inside: avoid; }
}
`;
