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
   Page
======================= */
export default function RecherchePage() {
    const [records, setRecords] = useState<RecordRow[]>([]);
    const [loading, setLoading] = useState(true);

    const [searchText, setSearchText] = useState("");
    const [searchCode, setSearchCode] = useState("");

    useEffect(() => {
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
       Filtrage en temps réel
    ======================= */
    const filteredRecords = useMemo(() => {
        return records.filter((item) => {
            const clientName = item.client?.name?.toLowerCase() ?? "";
            const city = item.client?.city?.toLowerCase() ?? "";
            const code = item.client?.code_client?.toLowerCase() ?? "";

            const textMatch =
                !searchText ||
                `${clientName} ${city}`.includes(searchText.toLowerCase());

            const codeMatch =
                !searchCode || code.includes(searchCode.toLowerCase());

            return textMatch && codeMatch;
        });
    }, [records, searchText, searchCode]);

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
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRecords.length === 0 ? (
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
                                                    textDecoration: "none",
                                                    fontWeight: 500,
                                                }}
                                            >
                                                {item.client
                                                    ? `${item.client.name}${
                                                          item.client.city
                                                              ? " – " +
                                                                item.client.city
                                                              : ""
                                                      }`
                                                    : "Client inconnu"}
                                            </Link>
                                        </td>
                                        <td style={tdStyle}>
                                            {item.client?.code_client ?? "-"}
                                        </td>
                                        <td style={tdStyle}>
                                            {item.date_fiche ?? "-"}
                                        </td>
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
