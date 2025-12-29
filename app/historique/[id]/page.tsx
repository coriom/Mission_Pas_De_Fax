"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type SnapshotRow = {
    localisation_zone: string;
    emplacement: string;
    type_dispositif: string;
    numero: number;
};

export default function HistoriqueVersionPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const historyId = params.id;

    const [rows, setRows] = useState<SnapshotRow[]>([]);
    const [recordId, setRecordId] = useState<string | null>(null);
    const [createdAt, setCreatedAt] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [restoring, setRestoring] = useState(false);

    useEffect(() => {
        const fetchVersion = async () => {
            setLoading(true);

            const { data, error } = await supabase
                .from("record_history")
                .select("created_at, record_id, snapshot")
                .eq("id", historyId)
                .single();

            if (error || !data) {
                console.error(error);
                setLoading(false);
                return;
            }

            setRows(data.snapshot?.rows || []);
            setRecordId(data.record_id);
            setCreatedAt(data.created_at);
            setLoading(false);
        };

        fetchVersion();
    }, [historyId]);

    const handleRestore = async () => {
        if (!recordId) return;

        const ok = confirm(
            "Cette action remplacera l’état actuel de la fiche par cette version.\n\nContinuer ?"
        );
        if (!ok) return;

        try {
            setRestoring(true);

            // 1️⃣ Supprimer l’état actuel
            await supabase
                .from("record_devices")
                .delete()
                .eq("record_id", recordId);

            // 2️⃣ Restaurer le snapshot
            const payload = rows.map((r, idx) => ({
                record_id: recordId,
                localisation_zone: r.localisation_zone,
                emplacement: r.emplacement,
                type_dispositif: r.type_dispositif,
                numero: r.numero ?? idx + 1,
            }));

            await supabase.from("record_devices").insert(payload);

            alert("La version a été rétablie avec succès.");

            // 3️⃣ Redirection vers la fiche active
            router.push(`/recherche/${recordId}`);
        } catch (err) {
            console.error(err);
            alert("Erreur lors de la restauration.");
        } finally {
            setRestoring(false);
        }
    };

    if (loading) return <p>Chargement…</p>;

    return (
        <div>
            {/* Header */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                }}
            >
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 700 }}>
                        Version historique
                    </h1>

                    {createdAt && (
                        <p style={{ marginTop: 6, color: "#6b7280" }}>
                            Sauvegardée le{" "}
                            {new Date(createdAt).toLocaleString("fr-FR")}
                        </p>
                    )}
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                    <button
                        onClick={handleRestore}
                        disabled={restoring}
                        style={{
                            padding: "10px 14px",
                            borderRadius: 8,
                            border: "1px solid #dc2626",
                            backgroundColor: "#dc2626",
                            color: "#ffffff",
                            cursor: restoring ? "not-allowed" : "pointer",
                            fontWeight: 700,
                        }}
                    >
                        {restoring
                            ? "Restauration…"
                            : "Rétablir cette version"}
                    </button>

                    <button
                        onClick={() => router.back()}
                        style={{
                            padding: "10px 14px",
                            borderRadius: 8,
                            border: "1px solid #d1d5db",
                            backgroundColor: "#ffffff",
                            cursor: "pointer",
                            fontWeight: 600,
                        }}
                    >
                        ← Retour
                    </button>
                </div>
            </div>

            {/* Warning */}
            <div
                style={{
                    marginTop: 20,
                    padding: 12,
                    borderRadius: 8,
                    backgroundColor: "#FEF3C7",
                    color: "#92400E",
                    fontWeight: 600,
                    fontSize: 14,
                }}
            >
                ⚠️ Ceci est une version historique en lecture seule.
            </div>

            {/* Table */}
            <div
                style={{
                    marginTop: 20,
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    overflow: "hidden",
                    backgroundColor: "#ffffff",
                }}
            >
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead style={{ backgroundColor: "#f9fafb" }}>
                        <tr>
                            <Th>Localisation zone</Th>
                            <Th>Emplacement du dispositif</Th>
                            <Th>Type dispositif</Th>
                            <Th style={{ width: "60px" }}>N°</Th>
                        </tr>
                    </thead>

                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <Td colSpan={4}>
                                    Aucune donnée dans cette version
                                </Td>
                            </tr>
                        ) : (
                            rows.map((row, idx) => (
                                <tr
                                    key={idx}
                                    style={{
                                        borderTop: "1px solid #e5e7eb",
                                    }}
                                >
                                    <Td>{row.localisation_zone}</Td>
                                    <Td>{row.emplacement}</Td>
                                    <Td>{row.type_dispositif}</Td>
                                    <Td
                                        style={{
                                            textAlign: "center",
                                            fontWeight: 700,
                                        }}
                                    >
                                        {row.numero}
                                    </Td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/* =======================
   UI helpers
======================= */
function Th({
    children,
    style,
}: {
    children: React.ReactNode;
    style?: React.CSSProperties;
}) {
    return (
        <th
            style={{
                textAlign: "left",
                padding: "12px",
                fontSize: 13,
                fontWeight: 700,
                ...style,
            }}
        >
            {children}
        </th>
    );
}

function Td({
    children,
    colSpan,
    style,
}: {
    children: React.ReactNode;
    colSpan?: number;
    style?: React.CSSProperties;
}) {
    return (
        <td
            colSpan={colSpan}
            style={{
                padding: "12px",
                fontSize: 14,
                ...style,
            }}
        >
            {children}
        </td>
    );
}
