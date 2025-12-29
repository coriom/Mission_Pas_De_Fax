"use client";

type ClientRow = {
    id: string;
    name: string;
    code_client: string;
    count: number;
};

export default function LeastActiveClients({
    data,
}: {
    data: ClientRow[];
}) {
    return (
        <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
                Clients les moins actifs
            </h3>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                    <tr>
                        <th style={th}>Client</th>
                        <th style={th}>Code</th>
                        <th style={{ ...th, textAlign: "right" }}>
                            Modifs
                        </th>
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
                            <tr key={c.id}>
                                <td style={td}>{c.name}</td>
                                <td style={td}>{c.code_client}</td>
                                <td
                                    style={{
                                        ...td,
                                        textAlign: "right",
                                        color:
                                            c.count === 0
                                                ? "#dc2626"
                                                : "#92400e",
                                        fontWeight: 600,
                                    }}
                                >
                                    {c.count}
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
    fontSize: 14,
    padding: "6px 0",
};
