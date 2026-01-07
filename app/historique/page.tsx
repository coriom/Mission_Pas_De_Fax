"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

/* =======================
   Types
======================= */

// ✅ On ne récupère plus record + client en select imbriqué (ça sortait en tableaux et cassait le build Vercel)
type HistoryDbRow = {
    id: string;
    created_at: string;
    updated_by: string | null; // UUID user
    record_id: string | null;  // ✅ clé de la fiche
};

type RecordRow = {
    id: string;
    client: {
        name: string;
        code_client: string;
        city: string | null;
    } | null;
};

type HistoryRow = {
    id: string;
    created_at: string;
    updated_by_email: string | null;
    updated_by: string | null;
    record: {
        id: string;
        client: {
            name: string;
            code_client: string;
            city: string | null;
        } | null;
    } | null;
};

type ProfileRow = {
    id: string;
    email: string | null;
};

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
export default function HistoriquePage() {
    const [rows, setRows] = useState<HistoryRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);

            try {
                // 1) Historique "plat" (pas de join imbriqué -> évite le problème de types [])
                const { data, error } = await supabase
                    .from("record_history")
                    .select("id, created_at, updated_by, record_id")
                    .order("created_at", { ascending: false })
                    .limit(50);

                if (error) {
                    console.error("HISTORY FETCH ERROR (FULL)", {
                        message: error.message,
                        details: (error as any).details,
                        hint: (error as any).hint,
                        code: (error as any).code,
                        raw: error,
                    });
                    setRows([]);
                    return;
                }

                const history: HistoryDbRow[] = (data ?? []) as any;

                // 2) Emails via profiles
                const userIds = Array.from(
                    new Set(history.map((r) => r.updated_by).filter(Boolean))
                ) as string[];

                const emailById = new Map<string, string | null>();

                if (userIds.length > 0) {
                    const { data: profiles, error: profErr } = await supabase
                        .from("profiles")
                        .select("id, email")
                        .in("id", userIds);

                    if (profErr) {
                        console.error("PROFILES FETCH ERROR (FULL)", {
                            message: profErr.message,
                            details: (profErr as any).details,
                            hint: (profErr as any).hint,
                            code: (profErr as any).code,
                            raw: profErr,
                        });
                    } else {
                        (profiles ?? []).forEach((p) => {
                            const pr = p as ProfileRow;
                            emailById.set(pr.id, pr.email ?? null);
                        });
                    }
                }

                // 3) Records + clients en 2e requête (contrôle de forme -> client = objet ou null)
                const recordIds = Array.from(
                    new Set(history.map((h) => h.record_id).filter(Boolean))
                ) as string[];

                const recordById = new Map<string, RecordRow>();

                if (recordIds.length > 0) {
                    const { data: recs, error: recErr } = await supabase
                        .from("records")
                        .select(
                            `
                            id,
                            client:clients (
                                name,
                                code_client,
                                city
                            )
                        `
                        )
                        .in("id", recordIds);

                    if (recErr) {
                        console.error("RECORDS FETCH ERROR (FULL)", {
                            message: recErr.message,
                            details: (recErr as any).details,
                            hint: (recErr as any).hint,
                            code: (recErr as any).code,
                            raw: recErr,
                        });
                    } else {
                        (recs ?? []).forEach((r: any) => {
                            recordById.set(r.id, {
                                id: r.id,
                                client: r.client ?? null,
                            });
                        });
                    }
                }

                // 4) Hydratation finale
                const hydrated: HistoryRow[] = history.map((h) => ({
                    id: h.id,
                    created_at: h.created_at,
                    updated_by: h.updated_by ?? null,
                    updated_by_email: h.updated_by ? emailById.get(h.updated_by) ?? null : null,
                    record: h.record_id ? recordById.get(h.record_id) ?? null : null,
                }));

                setRows(hydrated);
            } catch (err: any) {
                console.error("HISTORY FETCH CRASH (FULL)", {
                    message: err?.message,
                    raw: err,
                });
                setRows([]);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, []);

    const filtered = useMemo(() => {
        return rows.filter((row) => {
            if (!search) return true;

            const tokens = normalize(search).split(" ").filter(Boolean);

            const clientName = normalize(row.record?.client?.name ?? "");
            const city = normalize(row.record?.client?.city ?? "");
            const code = normalize(row.record?.client?.code_client ?? "");
            const username = normalize(row.updated_by_email ?? "");

            const haystack = `${clientName} ${city} ${code} ${username}`;
            return tokens.every((t) => haystack.includes(t));
        });
    }, [rows, search]);

    /* =======================
       RESTAURATION VERSION
    ======================= */
    const handleRestore = async (row: HistoryRow) => {
        if (!row.record) return;

        const ok = confirm(
            "Cette action remplacera l’état actuel de la fiche par cette version.\n\nContinuer ?"
        );
        if (!ok) return;

        try {
            const { data, error } = await supabase
                .from("record_history")
                .select("snapshot")
                .eq("id", row.id)
                .single();

            if (error) throw error;

            const snapshotRows = (data as any)?.snapshot?.rows;
            if (!Array.isArray(snapshotRows)) {
                throw new Error("Snapshot invalide (rows manquant).");
            }

            // 1) purge
            const { error: delErr } = await supabase
                .from("record_devices")
                .delete()
                .eq("record_id", row.record.id);

            if (delErr) throw delErr;

            // 2) restore (avec position si présent)
            const payload = snapshotRows.map((r: any, idx: number) => ({
                record_id: row.record!.id,
                localisation_zone: r.localisation_zone ?? "",
                emplacement: r.emplacement ?? "",
                type_dispositif: r.type_dispositif ?? "",
                numero: r.numero ?? idx + 1,
                position: r.position ?? idx + 1,
            }));

            const { error: insErr } = await supabase.from("record_devices").insert(payload);
            if (insErr) throw insErr;

            alert("✅ Version restaurée avec succès.");
        } catch (err: any) {
            console.error("RESTORE ERROR (FULL)", {
                message: err?.message,
                details: err?.details,
                hint: err?.hint,
                code: err?.code,
                raw: err,
            });
            alert("❌ Erreur lors de la restauration.");
        }
    };

    return (
        <div>
            <h1 style={{ fontSize: 24, fontWeight: 700 }}>Historique</h1>
            <p style={{ marginTop: 8 }}>Dernières fiches clients modifiées.</p>

            {/* Recherche */}
            <div style={{ marginTop: 20, maxWidth: 320 }}>
                <input
                    type="text"
                    placeholder="Client, ville, code client ou utilisateur…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid #d1d5db",
                        fontSize: 14,
                    }}
                />
            </div>

            {/* Tableau */}
            <div style={{ marginTop: 24 }}>
                {loading ? (
                    <p>Chargement…</p>
                ) : (
                    <table
                        style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            backgroundColor: "#ffffff",
                            border: "1px solid #e5e7eb",
                            borderRadius: 12,
                            overflow: "hidden",
                        }}
                    >
                        <thead style={{ backgroundColor: "#f9fafb" }}>
                            <tr>
                                <Th>Date</Th>
                                <Th>Client</Th>
                                <Th>Code client</Th>
                                <Th>Actions</Th>
                            </tr>
                        </thead>

                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <Td colSpan={4}>Aucun résultat</Td>
                                </tr>
                            ) : (
                                filtered.map((row) => (
                                    <tr key={row.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                                        <Td>{new Date(row.created_at).toLocaleString("fr-FR")}</Td>

                                        <Td>
                                            {row.record?.client ? (
                                                <HighlightText
                                                    search={search}
                                                    text={`${row.record.client.name}${
                                                        row.record.client.city
                                                            ? " – " + row.record.client.city
                                                            : ""
                                                    }`}
                                                />
                                            ) : (
                                                <em style={{ color: "#6b7280" }}>Client supprimé</em>
                                            )}
                                        </Td>

                                        <Td>{row.record?.client?.code_client ?? "-"}</Td>

                                        <Td>
                                            <div style={{ display: "flex", gap: 14 }}>
                                                {row.record && (
                                                    <Link
                                                        href={`/recherche/${row.record.id}`}
                                                        style={{
                                                            color: "#2563eb",
                                                            fontWeight: 600,
                                                            textDecoration: "none",
                                                        }}
                                                    >
                                                        Fiche
                                                    </Link>
                                                )}

                                                <Link
                                                    href={`/historique/${row.id}`}
                                                    style={{
                                                        color: "#047857",
                                                        fontWeight: 600,
                                                        textDecoration: "none",
                                                    }}
                                                >
                                                    Version
                                                </Link>

                                                <button
                                                    onClick={() => handleRestore(row)}
                                                    style={{
                                                        border: "none",
                                                        background: "none",
                                                        color: "#dc2626",
                                                        fontWeight: 700,
                                                        cursor: "pointer",
                                                        padding: 0,
                                                    }}
                                                >
                                                    Rétablir
                                                </button>
                                            </div>
                                        </Td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

/* =======================
   UI helpers
======================= */
function Th({ children }: { children: React.ReactNode }) {
    return (
        <th
            style={{
                textAlign: "left",
                padding: "12px",
                fontSize: 13,
                fontWeight: 700,
            }}
        >
            {children}
        </th>
    );
}

function Td({
    children,
    colSpan,
}: {
    children: React.ReactNode;
    colSpan?: number;
}) {
    return (
        <td colSpan={colSpan} style={{ padding: "12px", fontSize: 14 }}>
            {children}
        </td>
    );
}

function HighlightText({ text, search }: { text: string; search: string }) {
    if (!search) return <>{text}</>;

    const normalizedSearch = normalize(search);
    const regex = new RegExp(`(${normalizedSearch})`, "gi");

    return (
        <>
            {text.split(regex).map((part, i) =>
                normalize(part).includes(normalizedSearch) ? (
                    <mark
                        key={i}
                        style={{
                            backgroundColor: "#fde68a",
                            padding: "0 2px",
                            borderRadius: 4,
                        }}
                    >
                        {part}
                    </mark>
                ) : (
                    part
                )
            )}
        </>
    );
}
