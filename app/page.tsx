import Link from "next/link";

export default function HomePage() {
    return (
        <div
            style={{
                minHeight: "calc(100vh - 56px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: 24,
            }}
        >
            <div style={{ maxWidth: 520 }}>
                <h1
                    style={{
                        fontSize: 32,
                        fontWeight: 800,
                        marginBottom: 12,
                    }}
                >
                    Pas De Fax
                </h1>

                <p
                    style={{
                        fontSize: 16,
                        color: "#4b5563",
                        marginBottom: 32,
                        lineHeight: 1.5,
                    }}
                >
                    Portail interne de gestion et d’historisation
                    des données d’intervention et de suivi client.
                </p>

                <Link
                    href="/login"
                    style={{
                        display: "inline-block",
                        padding: "12px 20px",
                        borderRadius: 8,
                        backgroundColor: "#2563eb",
                        color: "#ffffff",
                        fontWeight: 600,
                        textDecoration: "none",
                        fontSize: 15,
                    }}
                >
                    Se connecter
                </Link>
            </div>
        </div>
    );
}
