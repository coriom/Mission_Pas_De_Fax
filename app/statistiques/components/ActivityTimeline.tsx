export default function ActivityTimeline({ data }: { data: any[] }) {
    return (
        <div style={{ marginTop: 32 }}>
            <h3>Activité dans le temps</h3>

            <table style={{ width: "100%", marginTop: 12 }}>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th align="right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((d) => (
                        <tr key={d.date}>
                            <td>{d.date}</td>
                            <td align="right">{d.count}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
