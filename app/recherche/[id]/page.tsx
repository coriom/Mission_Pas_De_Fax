"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
    LOCALISATIONS,
    EMPLACEMENTS,
    TYPES_DISPOSITIF,
} from "../constants";

type DeviceRow = {
    id: string;
    localisation_zone: string;
    emplacement: string;
    type_dispositif: string;
    numero: number;
};

export default function ModificationPage({
    params,
}: {
    params: { id: string };
}) {
    const recordId = params.id;

    const [rows, setRows] = useState<DeviceRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRows = async () => {
            const { data } = await supabase
                .from("record_devices")
                .select("*")
                .eq("record_id", recordId)
                .order("numero");

            setRows(data || []);
            setLoading(false);
        };

        fetchRows();
    }, [recordId]);

    const updateRow = async (
        id: string,
        field: keyof DeviceRow,
        value: string
    ) => {
        setRows((prev) =>
            prev.map((row) =>
                row.id === id ? { ...row, [field]: value } : row
            )
        );

        await supabase
            .from("record_devices")
            .update({ [field]: value })
            .eq("id", id);
    };

    const addRow = async () => {
        const nextNumero = rows.length + 1;

        const { data } = await supabase
            .from("record_devices")
            .insert({
                record_id: recordId,
                localisation_zone: "",
                emplacement: "",
                type_dispositif: "",
                numero: nextNumero,
            })
            .select()
            .single();

        if (data) {
            setRows((prev) => [...prev, data]);
        }
    };

    if (loading) {
        return <p>Chargement…</p>;
    }

    return (
        <div>
            <h1 style={{ fontSize: 24, fontWeight: 700 }}>
                Implantation des dispositifs
            </h1>

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

            <table
                style={{
                    width: "100%",
                    marginTop: 24,
                    borderCollapse: "collapse",
                }}
            >
                <thead>
                    <tr>
                        <Th>Localisation zone</Th>
                        <Th>Emplacement du dispositif</Th>
                        <Th>Type dispositif</Th>
                        <Th>N°</Th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.id}>
                            <Td>
                                <input
                                    list="localisations"
                                    value={row.localisation_zone || ""}
                                    onChange={(e) =>
                                        updateRow(
                                            row.id,
                                            "localisation_zone",
                                            e.target.value
                                        )
                                    }
                                />
                            </Td>
                            <Td>
                                <input
                                    list="emplacements"
                                    value={row.emplacement || ""}
                                    onChange={(e) =>
                                        updateRow(
                                            row.id,
                                            "emplacement",
                                            e.target.value
                                        )
                                    }
                                />
                            </Td>
                            <Td>
                                <input
                                    list="types"
                                    value={row.type_dispositif || ""}
                                    onChange={(e) =>
                                        updateRow(
                                            row.id,
                                            "type_dispositif",
                                            e.target.value
                                        )
                                    }
                                />
                            </Td>
                            <Td>{row.numero}</Td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <button
                onClick={addRow}
                style={{
                    marginTop: 16,
                    padding: "8px 14px",
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    backgroundColor: "#f9fafb",
                    cursor: "pointer",
                }}
            >
                ➕ Ajouter une ligne
            </button>
        </div>
    );
}

function Th({ children }: { children: React.ReactNode }) {
    return (
        <th
            style={{
                textAlign: "left",
                padding: 8,
                borderBottom: "1px solid #e5e7eb",
                fontSize: 13,
            }}
        >
            {children}
        </th>
    );
}

function Td({ children }: { children: React.ReactNode }) {
    return (
        <td
            style={{
                padding: 8,
                borderBottom: "1px solid #f1f5f9",
            }}
        >
            {children}
        </td>
    );
}
