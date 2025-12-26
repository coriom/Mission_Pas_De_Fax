"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type HistoryRow = {
    id: string;
    created_at: string;
    updated_by: {
        username: string;
    } | null;
    record: {
        id: string;
        client: {
            name: string;
            code_client: string;
            city: string | null;
        } | null;
    } | null;
};


export default function HistoriquePage() {
    const [rows, setRows] = useState<HistoryRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);

            const { data, error } = await supabase
                .from("record_history")
                .select(`
                    id,
                    created_at,
                    updated_by:user_profiles (
                        username
                    ),
                    record:records (
                        id,
                        client:clients (
                            name,
                            code_client,
                            city
                        )
                    )
                `)

                .order("created_at", { ascending: false })
                .limit(50);

            if (!error && data) {
                setRows(data as HistoryRow[]);
            }

            setLoading(false);
        };

        fetchHistory();
    }, []);

    const filtered = rows.filter((r) =>
        !search ||
        r.record?.client?.code_client
            ?.toLowerCase()
            .includes(search.toLowerCase())
    );

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
            // 1️⃣ Charger le snapshot
            const { data, error } = await supabase
                .from("record_history")
                .select("snapshot")
                .eq("id", row.id)
                .single();

            if (error || !data) throw error;

            const snapshotRows = data.snapshot.rows;

            // 2️⃣ Supprimer l’état actuel
            await supabase
                .from("record_devices")
                .delete()
                .eq("record_id", row.record.id);

            // 3️⃣ Restaurer la version
            const payload = snapshotRows.map((r: any, idx: number) => ({
                record_id: row.record!.id,
                localisation_zone: r.localisation_zone,
                emplacement: r.emplacement,
                type_dispositif: r.type_dispositif,
                numero: r.numero ?? idx + 1,
            }));

            await supabase.from("record_devices").insert(payload);

            alert("La version a été rétablie avec succès.");
        } catch (err) {
            console.error(err);
            alert("Erreur lors de la restauration.");
        }
    };

    return (
        <div>
            <h1 style={{ fontSize: 24, fontWeight: 700 }}>
                Historique
            </h1>

            <p style={{ marginTop: 8 }}>
                Dernières fiches clients modifiées.
            </p>

            {/* Recherche */}
            <div style={{ marginTop: 20, maxWidth: 320 }}>
                <input
                    type="text"
                    placeholder="Rechercher par code client (ex : CL12345)"
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
                                <Th>Modifié par</Th>
                                <Th>Actions</Th>
                            </tr>
                        </thead>

                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <Td colSpan={4}>
                                        Aucun résultat
                                    </Td>
                                </tr>
                            ) : (
                                filtered.map((row) => (
                                    <tr
                                        key={row.id}
                                        style={{
                                            borderTop:
                                                "1px solid #e5e7eb",
                                        }}
                                    >
                                        <Td>
                                            {new Date(
                                                row.created_at
                                            ).toLocaleString("fr-FR")}
                                        </Td>

                                        <Td>
                                            {row.record?.client
                                                ? `${row.record.client.name}${
                                                      row.record.client.city
                                                          ? " – " +
                                                            row.record.client.city
                                                          : ""
                                                  }`
                                                : "Client inconnu"}
                                        </Td>

                                        <Td>
                                            {row.record?.client
                                                ?.code_client ?? "-"}
                                        </Td>
                                        
                                        <Td>
                                            {row.updated_by?.username ?? "—"}
                                        </Td>


                                        <Td>
                                            <div
                                                style={{
                                                    display: "flex",
                                                    gap: 14,
                                                    flexWrap: "wrap",
                                                }}
                                            >
                                                {/* Fiche actuelle */}
                                                {row.record && (
                                                    <Link
                                                        href={`/recherche/${row.record.id}`}
                                                        style={{
                                                            color: "#2563eb",
                                                            fontWeight: 600,
                                                            textDecoration:
                                                                "none",
                                                        }}
                                                    >
                                                        Ouvrir la fiche
                                                    </Link>
                                                )}

                                                {/* Version */}
                                                <Link
                                                    href={`/historique/${row.id}`}
                                                    style={{
                                                        color: "#047857",
                                                        fontWeight: 600,
                                                        textDecoration:
                                                            "none",
                                                    }}
                                                >
                                                    Ouvrir la version
                                                </Link>

                                                {/* Rétablir */}
                                                <button
                                                    onClick={() =>
                                                        handleRestore(row)
                                                    }
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
function Th({
    children,
}: {
    children: React.ReactNode;
}) {
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
        <td
            colSpan={colSpan}
            style={{
                padding: "12px",
                fontSize: 14,
            }}
        >
            {children}
        </td>
    );
}
