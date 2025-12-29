"use client";

import { useMemo } from "react";

type HeatmapPoint = { date: string; count: number };

type Week = {
    days: (HeatmapPoint | null)[];
    month: number; // 0..11
    year: number;
};

export default function ActivityHeatmap({
    data,
    daysLabel = "365 derniers jours",
}: {
    data: HeatmapPoint[];
    daysLabel?: string;
}) {
    const { weeks, max } = useMemo(() => {
        const points = [...(data ?? [])];

        const toDate = (iso: string) => {
            const [y, m, d] = iso.split("-").map(Number);
            return new Date(y, m - 1, d);
        };

        const isoDow = (dt: Date) => {
            const js = dt.getDay();
            return js === 0 ? 7 : js; // 1..7 (Mon..Sun)
        };

        if (points.length === 0) {
            return { weeks: [] as Week[], max: 0 };
        }

        const firstDt = toDate(points[0].date);
        const padBefore = isoDow(firstDt) - 1;

        const padded: (HeatmapPoint | null)[] = Array(padBefore).fill(null);
        points.forEach((p) => padded.push(p));

        const weeks: Week[] = [];
        for (let i = 0; i < padded.length; i += 7) {
            const slice = padded.slice(i, i + 7);

            const refDay = slice.find(Boolean);
            const refDate = refDay ? toDate(refDay.date) : null;

            weeks.push({
                days: slice,
                month: refDate ? refDate.getMonth() : -1,
                year: refDate ? refDate.getFullYear() : -1,
            });
        }

        const max = Math.max(0, ...points.map((p) => p.count || 0));
        return { weeks, max };
    }, [data]);

    const intensity = (count: number) => {
        if (!max) return 0.08;
        return 0.12 + (count / max) * 0.88;
    };

    const dayLabels = ["L", "M", "M", "J", "V", "S", "D"];
    const monthLabels = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

    return (
        <div>
            {/* Header */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginBottom: 12,
                }}
            >
                <div>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>
                        Heatmap activité
                    </div>
                    <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                        {daysLabel} — 1 case = 1 jour
                    </div>
                </div>

                <Legend max={max} />
            </div>

            {/* Heatmap */}
            <div style={{ display: "flex", gap: 10 }}>
                {/* Jours */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateRows: "repeat(7, 14px)",
                        gap: 6,
                        paddingTop: 22,
                        minWidth: 16,
                    }}
                >
                    {dayLabels.map((d, i) => (
                        <div
                            key={i}
                            style={{
                                fontSize: 11,
                                color: "#6b7280",
                                height: 14,
                                display: "flex",
                                alignItems: "center",
                            }}
                        >
                            {i % 2 === 0 ? d : ""}
                        </div>
                    ))}
                </div>

                {/* Colonnes */}
                <div
                    style={{
                        overflowX: "auto",
                        paddingBottom: 8,
                    }}
                >
                    {/* Mois */}
                    <div
                        style={{
                            display: "grid",
                            gridAutoFlow: "column",
                            gridAutoColumns: "max-content",
                            gap: 8,
                            marginBottom: 6,
                            paddingLeft: 2,
                        }}
                    >
                        {weeks.map((w, i) => {
                            const prev = weeks[i - 1];
                            const show =
                                !prev ||
                                prev.month !== w.month ||
                                prev.year !== w.year;

                            return (
                                <div
                                    key={i}
                                    style={{
                                        width: 12,
                                        fontSize: 11,
                                        color: "#6b7280",
                                        textAlign: "left",
                                    }}
                                >
                                    {show && w.month >= 0
                                        ? monthLabels[w.month]
                                        : ""}
                                </div>
                            );
                        })}
                    </div>

                    {/* Grille */}
                    <div
                        style={{
                            display: "grid",
                            gridAutoFlow: "column",
                            gridAutoColumns: "max-content",
                            gap: 8,
                        }}
                    >
                        {weeks.map((week, wIdx) => (
                            <div
                                key={wIdx}
                                style={{
                                    display: "grid",
                                    gridTemplateRows: "repeat(7, 12px)",
                                    gap: 6,
                                }}
                            >
                                {week.days.map((cell, cIdx) => {
                                    if (!cell) {
                                        return (
                                            <div
                                                key={cIdx}
                                                style={{
                                                    width: 12,
                                                    height: 12,
                                                }}
                                            />
                                        );
                                    }

                                    return (
                                        <div
                                            key={cIdx}
                                            title={`${formatFR(cell.date)} — ${cell.count} modif`}
                                            style={{
                                                width: 12,
                                                height: 12,
                                                borderRadius: 4,
                                                backgroundColor: `rgba(37, 99, 235, ${intensity(
                                                    cell.count
                                                )})`,
                                                border:
                                                    "1px solid rgba(17,24,39,0.06)",
                                            }}
                                        />
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* =======================
   Légende
======================= */
function Legend({ max }: { max: number }) {
    const steps = [0, 0.25, 0.5, 0.75, 1];

    return (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Faible</span>
            <div style={{ display: "flex", gap: 6 }}>
                {steps.map((s) => (
                    <div
                        key={s}
                        style={{
                            width: 12,
                            height: 12,
                            borderRadius: 4,
                            backgroundColor: `rgba(37, 99, 235, ${
                                0.12 + s * 0.88
                            })`,
                            border: "1px solid rgba(17,24,39,0.06)",
                        }}
                    />
                ))}
            </div>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Fort</span>
        </div>
    );
}

function formatFR(iso: string) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("fr-FR");
}
