"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError("Identifiants incorrects");
            setLoading(false);
            return;
        }

        router.replace("/recherche");
    };

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#f9fafb",
            }}
        >
            <form
                onSubmit={handleSubmit}
                style={{
                    width: 380,
                    padding: 32,
                    borderRadius: 12,
                    backgroundColor: "#ffffff",
                    border: "1px solid #e5e7eb",
                    textAlign: "center",
                }}
            >
                <h1 style={{ fontSize: 26, fontWeight: 700 }}>
                    Connexion
                </h1>

                <p
                    style={{
                        marginTop: 8,
                        marginBottom: 24,
                        color: "#6b7280",
                        fontSize: 14,
                    }}
                >
                    Accès réservé au personnel autorisé
                </p>

                <input
                    type="email"
                    placeholder="Adresse email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={inputStyle}
                />

                <input
                    type="password"
                    placeholder="Mot de passe"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={inputStyle}
                />

                {error && (
                    <p style={{ color: "red", marginTop: 12 }}>
                        {error}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        marginTop: 24,
                        width: "100%",
                        padding: "12px",
                        borderRadius: 8,
                        border: "none",
                        backgroundColor: "#2563eb",
                        color: "#ffffff",
                        fontWeight: 600,
                        cursor: "pointer",
                        fontSize: 15,
                    }}
                >
                    {loading ? "Connexion..." : "Se connecter"}
                </button>
            </form>
        </div>
    );
}

const inputStyle = {
    width: "100%",
    marginTop: 12,
    padding: "12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 14,
};
