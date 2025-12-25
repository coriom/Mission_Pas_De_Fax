"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
    username: string;
};

export default function Navbar() {
    const router = useRouter();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    const loadProfile = async () => {
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            setProfile(null);
            setLoading(false);
            return;
        }

        const { data, error } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", user.id)
            .single();

        if (!error && data) {
            setProfile(data);
        } else {
            setProfile(null);
        }

        setLoading(false);
    };

    useEffect(() => {
        // Chargement initial
        loadProfile();

        // Écoute des changements d'auth
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(() => {
            loadProfile();
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.replace("/login");
        // la navbar se mettra à jour automatiquement via le listener
    };

    if (loading) {
        return null;
    }

    return (
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

            <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
                <Link href="/recherche">Recherche & modification</Link>
                <Link href="/historique">Historique</Link>

                {profile && (
                    <>
                        <span
                            style={{
                                fontSize: 14,
                                color: "#374151",
                            }}
                        >
                            Connecté : <strong>{profile.username}</strong>
                        </span>

                        <button
                            onClick={handleLogout}
                            style={{
                                padding: "6px 12px",
                                borderRadius: 6,
                                border: "1px solid #d1d5db",
                                backgroundColor: "#ffffff",
                                cursor: "pointer",
                                fontSize: 13,
                            }}
                        >
                            Déconnexion
                        </button>
                    </>
                )}
            </div>
        </nav>
    );
}
