"use client";

import { useMemo, useState } from "react";

type DeviceType = {
    type: string;
    count: number;
};

type Props = {
    data: DeviceType[];
};

export default function DeviceTypeChart({ data }: Props) {
    const [sort, setSort] = useState<"desc" | "asc">("desc");
    const [period, setPeriod] = useState<"all" | "30" | "7">("all");

    /* =======================
       Hooks TOUJOURS appelés
    ======================= */
    const safeData = data ?? [];

    const total = useMemo(
        () => safeData.reduce((acc, d) => acc + d.count, 0),
        [safeData]
    );

    const max = useMemo(
        () => Math.max(1, ...safeData.map((d) => d.count)),
        [safeData]
    );

    const sorted = useMemo(() => {
        return [...safeData].sort((a, b) =>
            sort === "desc" ? b.count - a.count : a.count - b.count
        );
    }, [safeData, sort]);

    /* =======================
       Rendu
    ======================= */
    if (safeData.length === 0) {
        return (
            <div style={{ marginTop: 32 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600 }}>
                    Types de dispositifs
                </h2>
                <p style={{ marginTop: 8, color: "#6b7280" }}>
                    Aucun dispositif renseigné.
                </p>
            </div>
        );
    }

    return (
        <div style={{ marginTop: 32 }}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                }}
            >
                <h2 style={{ fontSize: 18, fontWeight: 600 }}>
                    Types de dispositifs
                </h2>

                <div style={{ display: "flex", gap: 12 }}>
                    <select
                        value={period}
                        onChange={(e) =>
                            setPeriod(e.target.value as any)
                        }
                        style={selectStyle}
                    >
                        <option value="all">Tout</option>
                        <option value="30">30 jours</option>
                        <option value="7">7 jours</option>
                    </select>

                    <select
                        value={sort}
                        onChange={(e) =>
                            setSort(e.target.value as any)
                        }
                        style={selectStyle}
                    >
                        <option value="desc">Volume ↓</option>
                        <option value="asc">Volume ↑</option>
                    </select>
                </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {sorted.map((item) => {
                    const percent = Math.round(
                        (item.count / total) * 100
                    );

                    const barWidth = Math.round(
                        (item.count / max) * 100
                    );

                    return (
                        <div key={item.type}>
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    fontSize: 13,
                                    fontWeight: 600,
                                    marginBottom: 4,
                                }}
                            >
                                <span>{item.type}</span>
                                <span>
                                    {item.count} ({percent}%)
                                </span>
                            </div>

                            <div
                                style={{
                                    width: "100%",
                                    height: 10,
                                    backgroundColor: "#e5e7eb",
                                    borderRadius: 999,
                                    overflow: "hidden",
                                }}
                            >
                                <div
                                    style={{
                                        width: `${barWidth}%`,
                                        height: "100%",
                                        backgroundColor: "#2563eb",
                                        borderRadius: 999,
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* =======================
   Styles
======================= */
const selectStyle: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 13,
    cursor: "pointer",
};
