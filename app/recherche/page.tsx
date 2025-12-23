import Link from "next/link";

const MOCK_INTERVENTIONS = [
    {
        id: "1",
        client: "Collège Camille Claudel – Villepinte",
        codeClient: "CL123456",
        date: "12/09/2025",
        statut: "Brouillon",
    },
    {
        id: "2",
        client: "Lycée Jean Moulin – Paris",
        codeClient: "CL654321",
        date: "10/09/2025",
        statut: "Signé",
    },
];

export default function RecherchePage() {
    return (
        <div>
            <h1 style={{ fontSize: 24, fontWeight: 700 }}>
                Recherche & modification
            </h1>

            {/* Barre de recherche */}
            <div
                style={{
                    marginTop: 24,
                    backgroundColor: "#f5f7fa",
                    padding: 20,
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                }}
            >
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "2fr 1fr",
                        gap: 16,
                    }}
                >
                    <div>
                        <label style={labelStyle}>
                            Raison sociale client et ville
                        </label>
                        <input
                            type="text"
                            placeholder="Ex : Collège Camille Claudel – Villepinte"
                            style={inputStyle}
                        />
                    </div>

                    <div>
                        <label style={labelStyle}>
                            Code client
                        </label>
                        <input
                            type="text"
                            placeholder="CLxxxxxx"
                            style={inputStyle}
                        />
                    </div>
                </div>

                {/* Bouton rechercher */}
                <div style={{ marginTop: 16, textAlign: "right" }}>
                    <button
                        style={{
                            padding: "10px 16px",
                            borderRadius: 8,
                            border: "none",
                            backgroundColor: "#111827",
                            color: "#ffffff",
                            fontWeight: 500,
                            cursor: "pointer",
                        }}
                    >
                        Rechercher
                    </button>
                </div>
            </div>

            {/* Résultats */}
            <div style={{ marginTop: 32 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
                    Résultats
                </h2>

                <table
                    style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        backgroundColor: "#ffffff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        overflow: "hidden",
                    }}
                >
                    <thead style={{ backgroundColor: "#f9fafb" }}>
                        <tr>
                            <th style={thStyle}>Client</th>
                            <th style={thStyle}>Code client</th>
                            <th style={thStyle}>Date</th>
                            <th style={thStyle}>Statut</th>
                        </tr>
                    </thead>
                    <tbody>
                        {MOCK_INTERVENTIONS.map((item) => (
                            <tr
                                key={item.id}
                                style={{
                                    borderTop: "1px solid #e5e7eb",
                                }}
                            >
                                <td style={tdStyle}>
                                    <Link
                                        href={`/recherche/${item.id}`}
                                        style={{
                                            color: "#2563eb",
                                            textDecoration: "none",
                                            fontWeight: 500,
                                        }}
                                    >
                                        {item.client}
                                    </Link>
                                </td>
                                <td style={tdStyle}>{item.codeClient}</td>
                                <td style={tdStyle}>{item.date}</td>
                                <td style={tdStyle}>{item.statut}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/* Styles partagés */
const labelStyle = {
    display: "block",
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 6,
    color: "#374151",
};

const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 14,
    outline: "none",
};

const thStyle = {
    textAlign: "left" as const,
    padding: "12px",
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
};

const tdStyle = {
    padding: "12px",
    fontSize: 14,
    color: "#111827",
};
