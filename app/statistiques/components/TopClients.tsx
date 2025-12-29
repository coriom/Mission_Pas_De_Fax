export default function TopClients({
    data = [],
}: {
    data?: {
        client: string;
        count: number;
    }[];
}) {
    if (!data || data.length === 0) {
        return <p>Aucune donnée client.</p>;
    }

    return (
        <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
                Clients les plus actifs
            </h3>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                    {data.map((c, idx) => (
                        <tr key={`${c.client}-${idx}`}>
                            <td>{c.client}</td>
                            <td align="right">{c.count}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
