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

        fetchRole();
        
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

            if (!error && data) {
                setRecords(data as RecordRow[]);
            }

            setLoading(false);
        };

        fetchRecords();
    }, []);

    /* =======================
        Filtrage temps réel
    ======================= */
        const handleDelete = async (recordId: string) => {
            
            const ok = confirm(
                    "⚠️ Cette action supprimera définitivement la fiche et tout son historique.\n\nContinuer ?"
                );

                if (!ok) return;


                try {

                    // 2️⃣ Supprimer les dispositifs
                    await supabase
                        .from("record_devices")
                        .delete()
                        .eq("record_id", recordId);

                    // 3️⃣ Supprimer la fiche
                    await supabase
                        .from("records")
                        .delete()
                        .eq("id", recordId);

                    // 4️⃣ Mise à jour UI
                    setRecords((prev) =>
                        prev.filter((r) => r.id !== recordId)
                    );

                    alert("✅ Fiche supprimée définitivement.");
                } catch (err) {
                    console.error(err);
                    alert("❌ Erreur lors de la suppression.");
                }
            };

    const filteredRecords = useMemo(() => {
        const textTokens = normalize(searchText)
            .split(" ")
            .filter(Boolean);

        const codeToken = normalize(searchCode);

        return records.filter((item) => {
            const name = normalize(item.client?.name ?? "");
            const city = normalize(item.client?.city ?? "");
            const code = normalize(item.client?.code_client ?? "");

            const haystack = `${name} ${city}`;

            const textMatch =
                textTokens.length === 0 ||
                textTokens.every((token) => haystack.includes(token));

            const codeMatch =
                !codeToken || code.includes(codeToken);

            return textMatch && codeMatch;
        });
    }, [records, searchText, searchCode]);


    /* Reset page quand on tape */
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
            <div
                style={{
                    marginTop: 16,
                    display: "flex",
                    justifyContent: "flex-end",
                }}
            >
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

            {/* Barre de recherche */}
            <div
                style={{
                    marginTop: 24,
                    backgroundColor: "#f5f7fa",
                    padding: 20,
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                }}
            >
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "2fr 1fr",
                        gap: 16,
                    }}
                >
                    <div>
                        <label style={labelStyle}>
                            Raison sociale client et ville
                        </label>
                        <input
                            type="text"
                            placeholder="Ex : Collège Camille Claudel – Villepinte"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            style={inputStyle}
                        />
                    </div>

                    <div>
                        <label style={labelStyle}>Code client</label>
                        <input
                            type="text"
                            placeholder="CLxxxxxx"
                            value={searchCode}
                            onChange={(e) => setSearchCode(e.target.value)}
                            style={inputStyle}
                        />
                    </div>
                </div>
            </div>

            {/* Résultats */}
            <div style={{ marginTop: 32 }}>
                <h2
                    style={{
                        fontSize: 18,
                        fontWeight: 600,
                        marginBottom: 12,
                    }}
                >
                    Résultats
                </h2>

                {loading ? (
                    <p>Chargement...</p>
                ) : (
                    <>
                        <table
                            style={{
                                width: "100%",
                                borderCollapse: "collapse",
                                backgroundColor: "#ffffff",
                                border: "1px solid #e5e7eb",
                                borderRadius: 8,
                                overflow: "hidden",
                            }}
                        >
                            <thead style={{ backgroundColor: "#f9fafb" }}>
                                <tr>
                                    <th style={thStyle}>Client</th>
                                    <th style={thStyle}>Code client</th>
                                    <th style={thStyle}>Date</th>
                                    {isAdmin && <th style={thStyle}></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedRecords.length === 0 ? (
                                    <tr>
                                        <td style={tdStyle} colSpan={3}>
                                            Aucun résultat
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRecords.map((item) => (
                                        <tr
                                            key={item.id}
                                            style={{
                                                borderTop:
                                                    "1px solid #e5e7eb",
                                            }}
                                        >
                                            <td style={tdStyle}>
                                                <Link
                                                    href={`/recherche/${item.id}`}
                                                    style={{
                                                        color: "#2563eb",
                                                        textDecoration:
                                                            "none",
                                                        fontWeight: 500,
                                                    }}
                                                >
                                                    {item.client ? (
                                                        <>
                                                            {highlight(
                                                                item.client.name,
                                                                searchText
                                                            )}
                                                            {item.client.city && (
                                                                <>
                                                                    {" – "}
                                                                    {highlight(
                                                                        item.client.city,
                                                                        searchText
                                                                    )}
                                                                </>
                                                            )}
                                                        </>
                                                    ) : (
                                                        "Client inconnu"
                                                    )}
                                                </Link>
                                            </td>
                                            <td style={tdStyle}>
                                                {highlight(
                                                    item.client?.code_client ??
                                                        "-",
                                                    searchCode
                                                )}
                                            </td>
                                            <td style={tdStyle}>
                                                {item.date_fiche ?? "-"}
                                            </td>
                                        


                                            {isAdmin && (
                                                <td
                                                    style={{
                                                        ...tdStyle,
                                                        textAlign: "center",
                                                        width: 44,
                                                    }}
                                                >
                                                    <button
                                                        onClick={() => handleDelete(item.id)}
                                                        title="Supprimer définitivement"
                                                        style={{
                                                            width: 30,
                                                            height: 30,
                                                            borderRadius: 8,
                                                            border: "1px solid #e5e7eb",
                                                            backgroundColor: "#ffffff",
                                                            cursor: "pointer",
                                                            color: "#dc2626",
                                                            fontWeight: 700,
                                                            lineHeight: "28px",
                                                        }}
                                                    >
                                                        ×
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div
                                style={{
                                    marginTop: 16,
                                    display: "flex",
                                    justifyContent: "center",
                                    gap: 8,
                                }}
                            >
                                <button
                                    disabled={page === 1}
                                    onClick={() =>
                                        setPage((p) => p - 1)
                                    }
                                    style={paginationButton(page === 1)}
                                >
                                    ← Précédent
                                </button>

                                <span
                                    style={{
                                        padding: "6px 10px",
                                        fontSize: 14,
                                    }}
                                >
                                    Page {page} / {totalPages}
                                </span>

                                <button
                                    disabled={page === totalPages}
                                    onClick={() =>
                                        setPage((p) => p + 1)
                                    }
                                    style={paginationButton(
                                        page === totalPages
                                    )}
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
   Utils
======================= */
function highlight(text: string, query: string) {
    if (!query) return text;

    const regex = new RegExp(`(${query})`, "gi");
    const parts = text.split(regex);

    return parts.map((part, index) =>
        regex.test(part) ? (
            <mark
                key={index}
                style={{
                    backgroundColor: "#FEF08A",
                    padding: "0 2px",
                    borderRadius: 4,
                }}
            >
                {part}
            </mark>
        ) : (
            part
        )
    );
}

function paginationButton(disabled: boolean) {
    return {
        padding: "6px 12px",
        borderRadius: 6,
        border: "1px solid #d1d5db",
        backgroundColor: disabled ? "#f3f4f6" : "#ffffff",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 14,
    };
}

/* =======================
   Styles
======================= */
const labelStyle = {
    display: "block",
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 6,
    color: "#374151",
};

const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 14,
    outline: "none",
};

const thStyle = {
    textAlign: "left" as const,
    padding: "12px",
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
};

const tdStyle = {
    padding: "12px",
    fontSize: 14,
    color: "#111827",
};
