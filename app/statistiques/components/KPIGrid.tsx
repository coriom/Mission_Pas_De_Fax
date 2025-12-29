export default function KPIGrid({ stats }: { stats: any }) {
    const items = [
        { label: "Fiches clients", value: stats.totalRecords },
        { label: "Dispositifs", value: stats.totalDevices },
        { label: "Modifications", value: stats.totalModifications },
    ];

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 16,
                marginTop: 24,
            }}
        >
            {items.map((i) => (
                <div
                    key={i.label}
                    style={{
                        padding: 16,
                        borderRadius: 12,
                        background: "#ffffff",
                        border: "1px solid #e5e7eb",
                    }}
                >
                    <div style={{ fontSize: 13, color: "#6b7280" }}>
                        {i.label}
                    </div>
                    <div
                        style={{
                            fontSize: 28,
                            fontWeight: 700,
                            marginTop: 4,
                        }}
                    >
                        {i.value}
                    </div>
                </div>
            ))}
        </div>
    );
}
