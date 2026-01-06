"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
    username: string;
};

export default function Navbar() {
    const router = useRouter();
    const pathname = usePathname();

    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    // ✅ menu mobile
    const [mobileOpen, setMobileOpen] = useState(false);

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

    // ✅ fermer le menu mobile quand on change de page
    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    // ✅ empêcher le scroll derrière le drawer (mobile)
    useEffect(() => {
        if (mobileOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [mobileOpen]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.replace("/login");
        // la navbar se mettra à jour automatiquement via le listener
    };

    if (loading) return null;

    return (
        <>
            <nav
                className="navbar"
                style={{
                    borderBottom: "1px solid #e5e7eb",
                    backgroundColor: "#ffffff",
                }}
            >
                <div className="navbarInner">
                    <Link href="/" className="logoLink" aria-label="Accueil">
                        <Image
                            src="/Logo.jpg"
                            alt="Logo Pas De Fax"
                            width={140}
                            height={48}
                            style={{ objectFit: "contain" }}
                            priority
                        />
                    </Link>

                    {/* ✅ Desktop links */}
                    <div className="navRight desktopOnly">
                        <Link href="/recherche" className="navLink">
                            Recherche & modification
                        </Link>
                        <Link href="/historique" className="navLink">
                            Historique
                        </Link>
                        <Link href="/statistiques" className="navLink">
                            Statistiques
                        </Link>

                        {profile && (
                            <>
                                <span className="userText">
                                    Connecté : <strong>{profile.username}</strong>
                                </span>

                                <button onClick={handleLogout} className="logoutBtn">
                                    Déconnexion
                                </button>
                            </>
                        )}
                    </div>

                    {/* ✅ Mobile burger */}
                    <div className="mobileOnly">
                        <button
                            type="button"
                            className="burgerBtn"
                            aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
                            aria-expanded={mobileOpen}
                            onClick={() => setMobileOpen((v) => !v)}
                        >
                            <span className="burgerLine" />
                            <span className="burgerLine" />
                            <span className="burgerLine" />
                        </button>
                    </div>
                </div>
            </nav>

            {/* ✅ Mobile overlay + drawer */}
            {mobileOpen && (
                <div
                    className="overlay"
                    role="dialog"
                    aria-modal="true"
                    onClick={() => setMobileOpen(false)}
                >
                    <div
                        className="drawer"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Menu"
                    >
                        <div className="drawerHeader">
                            <div style={{ fontWeight: 900 }}>Menu</div>
                            <button
                                className="closeBtn"
                                onClick={() => setMobileOpen(false)}
                                aria-label="Fermer"
                            >
                                ×
                            </button>
                        </div>

                        <div className="drawerLinks">
                            <Link href="/recherche" className="drawerLink">
                                Recherche & modification
                            </Link>
                            <Link href="/historique" className="drawerLink">
                                Historique
                            </Link>
                            <Link href="/statistiques" className="drawerLink">
                                Statistiques
                            </Link>
                        </div>

                        {profile && (
                            <div className="drawerFooter">
                                <div className="drawerUser">
                                    Connecté : <strong>{profile.username}</strong>
                                </div>
                                <button onClick={handleLogout} className="drawerLogout">
                                    Déconnexion
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ✅ Styles (responsive) */}
            <style jsx>{`
                .navbar {
                    width: 100%;
                }

                .navbarInner {
                    max-width: 1100px;
                    margin: 0 auto;
                    height: 56px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 16px;
                    gap: 12px;
                }

                .logoLink {
                    display: flex;
                    align-items: center;
                    flex-shrink: 0;
                }

                .navRight {
                    display: flex;
                    gap: 18px;
                    align-items: center;
                    flex-wrap: wrap; /* ✅ évite le débordement */
                    justify-content: flex-end;
                }

                .navLink {
                    text-decoration: none;
                    color: #111827;
                    font-weight: 600;
                    white-space: nowrap;
                }

                .userText {
                    font-size: 14px;
                    color: #374151;
                    white-space: nowrap;
                }

                .logoutBtn {
                    padding: 6px 12px;
                    border-radius: 6px;
                    border: 1px solid #d1d5db;
                    background-color: #ffffff;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 700;
                    white-space: nowrap;
                }

                /* ✅ Mobile */
                .mobileOnly {
                    display: none;
                }
                .desktopOnly {
                    display: flex;
                }

                .burgerBtn {
                    width: 40px;
                    height: 40px;
                    border-radius: 10px;
                    border: 1px solid #e5e7eb;
                    background: #ffffff;
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    gap: 5px;
                    padding: 0 10px;
                }
                .burgerLine {
                    display: block;
                    height: 2px;
                    width: 100%;
                    background: #111827;
                    border-radius: 999px;
                }

                .overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.35);
                    z-index: 50;
                    display: flex;
                    justify-content: flex-end;
                }

                .drawer {
                    width: min(360px, 88vw);
                    height: 100%;
                    background: #ffffff;
                    border-left: 1px solid #e5e7eb;
                    padding: 14px;
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                }

                .drawerHeader {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    padding-bottom: 10px;
                    border-bottom: 1px solid #f1f5f9;
                }

                .closeBtn {
                    width: 38px;
                    height: 38px;
                    border-radius: 10px;
                    border: 1px solid #e5e7eb;
                    background: #ffffff;
                    cursor: pointer;
                    font-size: 22px;
                    font-weight: 900;
                    line-height: 34px;
                }

                .drawerLinks {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .drawerLink {
                    padding: 10px 12px;
                    border-radius: 10px;
                    border: 1px solid #e5e7eb;
                    text-decoration: none;
                    color: #111827;
                    font-weight: 800;
                    background: #ffffff;
                }

                .drawerFooter {
                    margin-top: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    padding-top: 10px;
                    border-top: 1px solid #f1f5f9;
                }

                .drawerUser {
                    font-size: 14px;
                    color: #374151;
                    font-weight: 700;
                }

                .drawerLogout {
                    padding: 10px 12px;
                    border-radius: 10px;
                    border: 1px solid #d1d5db;
                    background: #111827;
                    color: #ffffff;
                    cursor: pointer;
                    font-weight: 900;
                }

                @media (max-width: 768px) {
                    .navbarInner {
                        padding: 0 12px;
                    }

                    .desktopOnly {
                        display: none; /* ✅ on cache tout le bloc desktop */
                    }

                    .mobileOnly {
                        display: block; /* ✅ on affiche le burger */
                    }
                }
            `}</style>
        </>
    );
}
