"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

/* =======================
    Types
======================= */
type RecordRow = {
    id: string;
    date_fiche: string | null;
    client: {
        name: string;
        code_client: string;
        city: string | null;
    } | null;
};

/* =======================
    Constantes pagination
======================= */
const PAGE_SIZE = 10;

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

    function normalize(str: string) {
        return str
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9 ]/g, "");
    }

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

            const { data, error } = await supabase
                .from("records")
                .select(`
                    id,
                    date_fiche,
                    client:clients (
                        name,
                        code_client,
                        city
                    )
                `)
                .order("created_at", { ascending: false });

            if (error) {
                console.error("FETCH RECORDS ERROR", error);
            } else {
                setRecords(data as RecordRow[]);
            }

            setLoading(false);
        };

        fetchRole();
        fetchRecords();
    }, []);

    /* =======================
        Suppression (admin)
    ======================= */
    const handleDelete = async (recordId: string) => {
        const ok = confirm(
            "⚠️ Cette action supprimera définitivement la fiche et tout son historique.\n\nContinuer ?"
        );
        if (!ok) return;

        try {
            await supabase.from("record_devices").delete().eq("record_id", recordId);
            await supabase.from("records").delete().eq("id", recordId);

            setRecords((prev) => prev.filter((r) => r.id !== recordId));
            alert("✅ Fiche supprimée définitivement.");
        } catch (err) {
            console.error(err);
            alert("❌ Erreur lors de la suppression.");
        }
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
                textTokens.length === 0 ||
                textTokens.every((t) => haystack.includes(t));

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
            <h1 style={{ fontSize: 24, fontWeight: 700 }}>
                Recherche & modification
            </h1>

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
            <div style={{ marginTop: 24, backgroundColor: "#f5f7fa", padding: 20, borderRadius: 12 }}>
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
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr>
                                <th style={thStyle}>Client</th>
                                <th style={thStyle}>Code</th>
                                <th style={thStyle}>Date</th>
                                {isAdmin && <th />}
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={4} style={tdStyle}>Aucun résultat</td>
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
                                        {isAdmin && (
                                            <td style={tdStyle}>
                                                <button onClick={() => handleDelete(r.id)}>×</button>
                                            </td>
                                        )}
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
   Styles
======================= */
const labelStyle = { fontSize: 13, fontWeight: 500 };
const inputStyle = { width: "100%", padding: 10 };
const thStyle = { textAlign: "left" as const, padding: 12 };
const tdStyle = { padding: 12 };
