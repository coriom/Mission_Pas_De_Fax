"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { LOCALISATIONS, EMPLACEMENTS, TYPES_DISPOSITIF } from "../constants";

type DeviceRow = {
    id: string;
    localisation_zone: string;
    emplacement: string;
    type_dispositif: string;
    numero: number;
};

type FieldKey = "localisation_zone" | "emplacement" | "type_dispositif";
type RecordMeta = {
    groupe: string | null;
    annexe_contrat_numero: string | null;
    date_fiche: string | null;
    client: {
        name: string;
        code_client: string;
        city: string | null;
    } | null;
};



export default function ModificationPage() {
    const params = useParams<{ id: string }>();
    const recordId = params.id;

    const [rows, setRows] = useState<DeviceRow[]>([]);
    const [recordMeta, setRecordMeta] = useState<RecordMeta | null>(null);
    const [loading, setLoading] = useState(true);

    // lignes modifiées depuis la dernière sauvegarde
    const dirtyIds = useRef<Set<string>>(new Set());

    const [saveState, setSaveState] = useState<
        "idle" | "dirty" | "saving" | "saved" | "error"
    >("idle");

const [commentaire, setCommentaire] = useState("");

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);

            // 1️⃣ Charger les lignes
            const { data: devices, error: devicesError } = await supabase
                .from("record_devices")
                .select("*")
                .eq("record_id", recordId)
                .order("numero", { ascending: true });

            if (!devicesError) {
                setRows((devices as DeviceRow[]) || []);
            }

            // 2️⃣ Charger le commentaire
            const { data: record, error: recordError } = await supabase
                .from("records")
                .select("commentaire")
                .eq("id", recordId)
                .single();

            if (!recordError && record) {
                setCommentaire(record.commentaire ?? "");
            }

            setLoading(false);

            // 3️⃣ Charger les métadonnées de la fiche (lecture seule)
            const { data: meta, error: metaError } = await supabase
                .from("records")
                .select(`
                    groupe,
                    annexe_contrat_numero,
                    date_fiche,
                    client:clients (
                        name,
                        code_client,
                        city
                    )
                `)
                .eq("id", recordId)
                .single();

            if (!metaError && meta) {
                setRecordMeta;
            }

        };

        fetchData();
    }, [recordId]);


    const isEmptyRow = (row: DeviceRow) => {
        return (
            row.localisation_zone.trim() === "" &&
            row.emplacement.trim() === "" &&
            row.type_dispositif.trim() === ""
        );
    };

    /** =======================
     *  MODIFICATION LOCAL UNIQUEMENT
     ======================= */
    const updateRow = (id: string, field: FieldKey, value: string) => {
        setRows((prev) =>
            prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
        );

        dirtyIds.current.add(id);
        setSaveState("dirty");
    };

    /** =======================
     *  SAUVEGARDE EXPLICITE
     ======================= */
    const handleSave = async () => {
        setSaveState("saving");

        try {
            const { data: authData, error: authError } =
                await supabase.auth.getUser();

            if (authError || !authData.user) {
                throw new Error("Utilisateur non authentifié");
            }

            const userId = authData.user.id;

            /* 1️⃣ État actuel */
            const { data: currentRows, error: fetchError } = await supabase
                .from("record_devices")
                .select("localisation_zone, emplacement, type_dispositif, numero")
                .eq("record_id", recordId)
                .order("numero");

            if (fetchError) throw fetchError;

            /* 2️⃣ Historique */
            const { error: historyError } = await supabase
                .from("record_history")
                .insert({
                    record_id: recordId,
                    updated_by: userId,
                    snapshot: {
                        rows: currentRows ?? [],
                        commentaire,
                    },
                });

            if (historyError) {
                console.error("❌ record_history insert failed", historyError);
                throw historyError;
            }

            /* 3️⃣ Sauvegarde courante */
            const payload = rows.map((r) => ({
                id: r.id,
                record_id: recordId,
                localisation_zone: r.localisation_zone || "",
                emplacement: r.emplacement || "",
                type_dispositif: r.type_dispositif || "",
                numero: r.numero,
            }));

            const { error: saveError } = await supabase
                .from("record_devices")
                .upsert(payload, { onConflict: "id" });

            if (saveError) throw saveError;

            await supabase
                .from("records")
                .update({ commentaire })
                .eq("id", recordId);

            setSaveState("saved");
            setTimeout(() => setSaveState("idle"), 1200);
        } catch (err) {
            console.error("❌ SAVE ERROR", err);
            setSaveState("error");
        }
    };



    /** =======================
     *  AJOUT DE LIGNE
     ======================= */
    const addRow = async () => {
        const numero = rows.length + 1;

        const { data, error } = await supabase
            .from("record_devices")
            .insert({
                record_id: recordId,
                localisation_zone: "",
                emplacement: "",
                type_dispositif: "",
                numero,
            })
            .select()
            .single();

        if (!error && data) {
            setRows((prev) => [...prev, data as DeviceRow]);
            dirtyIds.current.add(data.id);
            setSaveState("dirty");
        }
    };

    /** =======================
     *  SUPPRESSION DE LIGNE
     ======================= */
    const deleteRow = async (id: string) => {
        await supabase.from("record_devices").delete().eq("id", id);

        const remaining = rows.filter((r) => r.id !== id);
        const renumbered = remaining.map((r, idx) => ({
            ...r,
            numero: idx + 1,
        }));

        setRows(renumbered);
        dirtyIds.current = new Set(renumbered.map((r) => r.id));
        setSaveState("dirty");

        for (const r of renumbered) {
            await supabase
                .from("record_devices")
                .update({ numero: r.numero })
                .eq("id", r.id);
        }
    };

    if (loading) return <p>Chargement…</p>;

    return (
        <div>
            {/* INFOS FICHE – lecture seule */}
            {recordMeta && (
                <div
                    style={{
                        marginBottom: 24,
                        padding: 16,
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        backgroundColor: "#ffffff",
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: 16,
                    }}
                >
                    <Info label="Raison sociale client" value={recordMeta.client?.name} />
                    <Info label="Ville" value={recordMeta.client?.city} />
                    <Info label="Code client" value={recordMeta.client?.code_client} />
                    <Info label="Groupe" value={recordMeta.groupe} />
                    <Info
                        label="Annexe au contrat d’abonnement n°"
                        value={recordMeta.annexe_contrat_numero}
                    />
                    <Info label="Date de la fiche" value={recordMeta.date_fiche} />
                </div>
            )}

            {/* HEADER */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                }}
            >
                <h1 style={{ fontSize: 24, fontWeight: 700 }}>
                    Implantation des dispositifs
                </h1>

                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <SaveBadge state={saveState} />

                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saveState === "saving"}
                        style={{
                            padding: "10px 14px",
                            borderRadius: 8,
                            border: "1px solid #d1d5db",
                            backgroundColor:
                                saveState === "saving" ? "#f3f4f6" : "#111827",
                            color:
                                saveState === "saving" ? "#111827" : "#ffffff",
                            cursor:
                                saveState === "saving"
                                    ? "not-allowed"
                                    : "pointer",
                            fontWeight: 700,
                        }}
                    >
                        {saveState === "saving" ? "Sauvegarde…" : "Sauvegarder"}
                    </button>
                </div>
            </div>

            {/* DATALISTS */}
            <datalist id="localisations">
                {LOCALISATIONS.map((l) => (
                    <option key={l} value={l} />
                ))}
            </datalist>

            <datalist id="emplacements">
                {EMPLACEMENTS.map((e) => (
                    <option key={e} value={e} />
                ))}
            </datalist>

            <datalist id="types">
                {TYPES_DISPOSITIF.map((t) => (
                    <option key={t} value={t} />
                ))}
            </datalist>

            {/* TABLE */}
            <div
                style={{
                    marginTop: 16,
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
                            <Th style={{ width: "44px" }}> </Th>
                        </tr>
                    </thead>

                    <tbody>
                        {rows.map((row) => {
                            const empty = isEmptyRow(row);

                            return (
                                <tr
                                    key={row.id}
                                    style={{ borderTop: "1px solid #e5e7eb" }}
                                >
                                    <Td>
                                        <SmallInput
                                            list="localisations"
                                            value={row.localisation_zone}
                                            onChange={(v) =>
                                                updateRow(
                                                    row.id,
                                                    "localisation_zone",
                                                    v
                                                )
                                            }
                                        />
                                    </Td>

                                    <Td>
                                        <SmallInput
                                            list="emplacements"
                                            value={row.emplacement}
                                            onChange={(v) =>
                                                updateRow(
                                                    row.id,
                                                    "emplacement",
                                                    v
                                                )
                                            }
                                        />
                                    </Td>

                                    <Td>
                                        <SmallInput
                                            list="types"
                                            value={row.type_dispositif}
                                            onChange={(v) =>
                                                updateRow(
                                                    row.id,
                                                    "type_dispositif",
                                                    v
                                                )
                                            }
                                        />
                                    </Td>

                                    <Td
                                        style={{
                                            textAlign: "center",
                                            fontWeight: 700,
                                        }}
                                    >
                                        {empty ? "" : row.numero}
                                    </Td>

                                    <Td style={{ textAlign: "center" }}>
                                        <button
                                            type="button"
                                            onClick={() => deleteRow(row.id)}
                                            title="Supprimer la ligne"
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
                                    </Td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* AJOUT */}
            <div style={{ marginTop: 14 }}>
                <button
                    onClick={addRow}
                    style={{
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: "1px solid #d1d5db",
                        backgroundColor: "#f9fafb",
                        cursor: "pointer",
                        fontWeight: 600,
                    }}
                >
                    ➕ Ajouter une ligne
                </button>
            </div>

            {/* COMMENTAIRE */}
            <div
                style={{
                    marginTop: 24,
                    padding: 16,
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    backgroundColor: "#ffffff",
                }}
            >
                <label
                    style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 700,
                        marginBottom: 8,
                    }}
                >
                    Commentaire
                </label>

                <textarea
                    value={commentaire}
                    onChange={(e) => {
                        setCommentaire(e.target.value);
                        setSaveState("dirty");
                    }}
                    placeholder="Ajouter un commentaire libre concernant cette fiche…"
                    style={{
                        width: "100%",
                        minHeight: 90,
                        resize: "vertical",
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid #d1d5db",
                        fontSize: 14,
                        fontFamily: "inherit",
                        outline: "none",
                        boxSizing: "border-box",
                    }}
                />
            </div>
        </div>
    );
}

/* =======================
   UI helpers
======================= */
function SaveBadge({
    state,
}: {
    state: "idle" | "dirty" | "saving" | "saved" | "error";
}) {
    if (state === "idle") return null;

    const map: Record<
        "idle" | "dirty" | "saving" | "saved" | "error",
        { text: string; bg: string; color: string }
    > = {
        idle: { text: "", bg: "", color: "" },
        dirty: { text: "Modifications non sauvegardées", bg: "#FEF3C7", color: "#92400E" },
        saving: { text: "Sauvegarde en cours…", bg: "#DBEAFE", color: "#1D4ED8" },
        saved: { text: "Sauvegardé ✓", bg: "#DCFCE7", color: "#166534" },
        error: { text: "Erreur de sauvegarde", bg: "#FEE2E2", color: "#991B1B" },
    };

    const s = map[state];

    return (
        <span
            style={{
                padding: "6px 10px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                backgroundColor: s.bg,
                color: s.color,
                border: "1px solid #e5e7eb",
                whiteSpace: "nowrap",
            }}
        >
            {s.text}
        </span>
    );
}

function Info({
    label,
    value,
}: {
    label: string;
    value?: string | null;
}) {
    return (
        <div>
            <div
                style={{
                    fontSize: 12,
                    color: "#6b7280",
                    marginBottom: 4,
                }}
            >
                {label}
            </div>
            <div
                style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#111827",
                }}
            >
                {value || "—"}
            </div>
        </div>
    );
}


function SmallInput({
    list,
    value,
    onChange,
}: {
    list: string;
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <input
            list={list}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{
                width: "100%",
                height: 34,
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
            }}
        />
    );
}

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
    style,
}: {
    children: React.ReactNode;
    style?: React.CSSProperties;
}) {
    return (
        <td
            style={{
                padding: "10px 12px",
                verticalAlign: "top",
                ...style,
            }}
        >
            {children}
        </td>
    );
}
