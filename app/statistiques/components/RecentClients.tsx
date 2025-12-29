"use client";

import Link from "next/link";

type ClientRow = {
    id: string;
    name: string;
    code: string;
    city: string | null;
    date: string;
};

export default function RecentClients({ data }: { data: ClientRow[] }) {
    return (
        <div
            style={{
                backgroundColor: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 16,
            }}
        >
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
                Derniers clients modifiés
            </h3>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                    <tr>
                        <th style={th}>Client</th>
                        <th style={th}>Code</th>
                        <th style={th}>Dernière modification</th>
                    </tr>
                </thead>
                <tbody>
                    {data.length === 0 ? (
                        <tr>
                            <td colSpan={3} style={td}>
                                Aucun résultat
                            </td>
                        </tr>
                    ) : (
                        data.map((c) => (
                            <tr key={`${c.id}-${c.date}`}>
                                <td style={td}>
                                    <Link
                                        href={`/recherche/${c.id}`}
                                        style={{
                                            color: "#2563eb",
                                            fontWeight: 600,
                                            textDecoration: "none",
                                        }}
                                    >
                                        {c.name}
                                        {c.city ? ` – ${c.city}` : ""}
                                    </Link>
                                </td>
                                <td style={td}>{c.code}</td>
                                <td style={td}>
                                    {new Date(c.date).toLocaleString("fr-FR")}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

const th = {
    textAlign: "left" as const,
    fontSize: 13,
    fontWeight: 600,
    paddingBottom: 8,
};

const td = {
    padding: "8px 0",
    fontSize: 14,
};
