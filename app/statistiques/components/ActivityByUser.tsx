export default function ActivityByUser({ data }: { data: any[] }) {
    return (
        <div style={{ marginTop: 32 }}>
            <h3>Activité par utilisateur</h3>

            <table style={{ width: "100%", marginTop: 12 }}>
                <thead>
                    <tr>
                        <th align="left">Utilisateur</th>
                        <th align="right">Modifications</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((u) => (
                        <tr key={u.username}>
                            <td>{u.username}</td>
                            <td align="right">{u.count}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
