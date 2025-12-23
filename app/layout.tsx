import Link from "next/link";
import Image from "next/image";

export const metadata = {
    title: "Pas De Fax",
    description: "Portail interne de gestion PDF",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="fr">
            <body style={{ margin: 0, fontFamily: "system-ui" }}>
                <nav
                    style={{
                        height: 56,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0 24px",
                        borderBottom: "1px solid #e5e7eb",
                        backgroundColor: "#ffffff",
                    }}
                >
                    <Link href="/" style={{ display: "flex", alignItems: "center" }}>
                        <Image
                            src="/Logo.jpg"
                            alt="Logo Pas De Fax"
                            width={140}
                            height={48}
                            style={{ objectFit: "contain" }}
                            priority
                        />
                    </Link>

                    <div style={{ display: "flex", gap: 24 }}>
                        <Link href="/recherche">
                            Recherche & modification
                        </Link>
                        <Link href="/historique">
                            Historique
                        </Link>
                    </div>
                </nav>

                <main style={{ padding: 24 }}>
                    {children}
                </main>
            </body>
        </html>
    );
}
