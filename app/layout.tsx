import AuthGuard from "./AuthGuard";
import Navbar from "./Navbar";

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
                <AuthGuard>
                    <Navbar />
                    <main style={{ padding: 24 }}>
                        {children}
                    </main>
                </AuthGuard>
            </body>
        </html>
    );
}
