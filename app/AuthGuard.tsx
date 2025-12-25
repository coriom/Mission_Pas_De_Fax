"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGuard({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            // Si pas connecté
            if (!session && pathname !== "/login") {
                router.replace("/login");
                return;
            }

            // Si connecté et sur /login → redirection
            if (session && pathname === "/login") {
                router.replace("/recherche");
                return;
            }

            setLoading(false);
        };

        checkAuth();

        const { data: listener } = supabase.auth.onAuthStateChange(
            () => {
                checkAuth();
            }
        );

        return () => {
            listener.subscription.unsubscribe();
        };
    }, [pathname, router]);

    if (loading) {
        return null;
    }

    return <>{children}</>;
}
