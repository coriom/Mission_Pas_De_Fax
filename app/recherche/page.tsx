"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

/* =======================
    Types
======================= */
type ClientRow = {
  name: string;
  code_client: string;
  city: string | null;
};

type RecordDbRow = {
  id: string;
  date_fiche: string | null;
  client_id: string | null;
};

type RecordRow = {
  id: string;
  date_fiche: string | null;
  client: ClientRow | null;
};

/* =======================
    Constantes pagination
======================= */
const PAGE_SIZE = 10;

function normalize(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "");
}

/* =======================
    Page
======================= */
export default function RecherchePage() {
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchText, setSearchText] = useState("");
  const [searchCode, setSearchCode] = useState("");

  const [page, setPage] = useState(1);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchRole = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      setIsAdmin(profile?.role === "admin");
    };

    const fetchRecords = async () => {
      setLoading(true);

      try {
        // ✅ 1) records (sans join client pour éviter le type "client: []" en build Vercel)
        const { data: recs, error: recErr } = await supabase
          .from("records")
          .select("id, date_fiche, client_id")
          .order("created_at", { ascending: false });

        if (recErr) throw recErr;

        const recordsDb = ((recs ?? []) as unknown) as RecordDbRow[];

        // ✅ 2) clients (via client_id)
        const clientIds = Array.from(
          new Set(recordsDb.map((r) => r.client_id).filter(Boolean))
        ) as string[];

        let clientById = new Map<string, ClientRow>();

        if (clientIds.length > 0) {
          const { data: clients, error: cliErr } = await supabase
            .from("clients")
            .select("id, name, code_client, city")
            .in("id", clientIds);

          if (cliErr) throw cliErr;

          (clients ?? []).forEach((c: any) => {
            clientById.set(String(c.id), {
              name: String(c.name ?? ""),
              code_client: String(c.code_client ?? ""),
              city: (c.city ?? null) as string | null,
            });
          });
        }

        // ✅ 3) hydrate au bon type RecordRow
        const hydrated: RecordRow[] = recordsDb.map((r) => ({
          id: r.id,
          date_fiche: r.date_fiche,
          client: r.client_id ? clientById.get(r.client_id) ?? null : null,
        }));

        setRecords(hydrated);
      } catch (err: any) {
        console.error("FETCH RECORDS ERROR (FULL)", {
          message: err?.message,
          details: err?.details,
          hint: err?.hint,
          code: err?.code,
          raw: err,
        });
        setRecords([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
    fetchRecords();
  }, []);

  /* =======================
      Suppression (admin)
  ======================= */
  const logSupabaseError = (label: string, err: any) => {
    console.error(label, err);
    if (!err) return;

    const props = Object.getOwnPropertyNames(err);
    const picked: any = {};
    for (const k of props) picked[k] = (err as any)[k];

    console.error(label + " (PROPS)", picked);
    try {
      console.error(label + " (STRINGIFY)", JSON.stringify(err));
    } catch {
      // ignore circular
    }
  };

  const handleDelete = async (recordId: string) => {
    const ok = confirm(
      "⚠️ Cette action supprimera définitivement la fiche et tout son historique.\n\nContinuer ?"
    );
    if (!ok) return;

    // 1) record_history
    const histRes = await supabase
      .from("record_history")
      .delete()
      .eq("record_id", recordId);

    if (histRes.error) {
      logSupabaseError("DELETE record_history ERROR", histRes.error);
      alert("❌ Impossible de supprimer l'historique (voir console).");
      return;
    }

    // 2) record_devices
    const devRes = await supabase
      .from("record_devices")
      .delete()
      .eq("record_id", recordId);

    if (devRes.error) {
      logSupabaseError("DELETE record_devices ERROR", devRes.error);
      alert("❌ Impossible de supprimer les lignes (voir console).");
      return;
    }

    // 3) records
    const recRes = await supabase.from("records").delete().eq("id", recordId);

    if (recRes.error) {
      logSupabaseError("DELETE records ERROR", recRes.error);
      alert("❌ Impossible de supprimer la fiche (voir console).");
      return;
    }

    setRecords((prev) => prev.filter((r) => r.id !== recordId));
    alert("✅ Fiche supprimée définitivement.");
  };

  /* =======================
      Filtrage
  ======================= */
  const filteredRecords = useMemo(() => {
    const textTokens = normalize(searchText).split(" ").filter(Boolean);
    const codeToken = normalize(searchCode);

    return records.filter((item) => {
      const name = normalize(item.client?.name ?? "");
      const city = normalize(item.client?.city ?? "");
      const code = normalize(item.client?.code_client ?? "");

      const haystack = `${name} ${city}`;

      const textMatch =
        textTokens.length === 0 || textTokens.every((t) => haystack.includes(t));

      const codeMatch = !codeToken || code.includes(codeToken);

      return textMatch && codeMatch;
    });
  }, [records, searchText, searchCode]);

  useEffect(() => {
    setPage(1);
  }, [searchText, searchCode]);

  /* =======================
      Pagination
  ======================= */
  const totalPages = Math.ceil(filteredRecords.length / PAGE_SIZE);

  const paginatedRecords = filteredRecords.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Recherche & modification</h1>

      {/* Bouton nouvelle fiche */}
      <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
        <Link
          href="/recherche/nouvelle"
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            backgroundColor: "#2563eb",
            color: "#ffffff",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          ➕ Nouvelle fiche
        </Link>
      </div>

      {/* Recherche */}
      <div
        style={{
          marginTop: 24,
          backgroundColor: "#f5f7fa",
          padding: 20,
          borderRadius: 12,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
          <div>
            <label style={labelStyle}>Raison sociale client et ville</label>
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Code client</label>
            <input
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* Résultats */}
      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Résultats</h2>

        {loading ? (
          <p>Chargement...</p>
        ) : (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Client</th>
                  <th style={thStyle}>Code</th>
                  <th style={thStyle}>Date</th>
                  {/* ✅ Colonne actions visible pour tout le monde (PDF) */}
                  <th style={thStyle} />
                </tr>
              </thead>

              <tbody>
                {paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={tdStyle}>
                      Aucun résultat
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((r) => (
                    <tr key={r.id}>
                      <td style={tdStyle}>
                        <Link href={`/recherche/${r.id}`}>
                          {r.client?.name ?? "Client inconnu"}
                          {r.client?.city && ` – ${r.client.city}`}
                        </Link>
                      </td>

                      <td style={tdStyle}>{r.client?.code_client ?? "-"}</td>

                      <td style={tdStyle}>{r.date_fiche ?? "-"}</td>

                      {/* ✅ Actions: PDF + Delete (si admin) */}
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          {/* ✅ Bouton PDF (accessible à tous) */}
                          <Link
                            href={`/recherche/${r.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Exporter en PDF"
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid #d1d5db",
                              backgroundColor: "#ffffff",
                              color: "#111827",
                              fontWeight: 700,
                              textDecoration: "none",
                              lineHeight: "20px",
                            }}
                          >
                            PDF
                          </Link>

                          {/* ✅ Bouton suppression (admin uniquement) */}
                          {isAdmin && (
                            <button
                              onClick={() => handleDelete(r.id)}
                              title="Supprimer la fiche"
                              style={deleteBtnStyle}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination simple */}
            {totalPages > 1 && (
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  justifyContent: "flex-end",
                  marginTop: 14,
                }}
              >
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={pagerBtnStyle(page <= 1)}
                >
                  ← Précédent
                </button>

                <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 700 }}>
                  Page {page} / {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  style={pagerBtnStyle(page >= totalPages)}
                >
                  Suivant →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* =======================
   Styles
======================= */
const labelStyle = { fontSize: 13, fontWeight: 500 };
const inputStyle = { width: "100%", padding: 10 };

const thStyle = {
  textAlign: "left" as const,
  padding: 12,
  fontSize: 13,
  fontWeight: 700,
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle = {
  padding: 12,
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "top" as const,
};

const deleteBtnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  backgroundColor: "#ffffff",
  cursor: "pointer",
  color: "#dc2626",
  fontWeight: 900,
  lineHeight: "30px",
};

const pagerBtnStyle = (disabled: boolean): React.CSSProperties => ({
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  backgroundColor: disabled ? "#f3f4f6" : "#ffffff",
  cursor: disabled ? "not-allowed" : "pointer",
  fontWeight: 800,
});
