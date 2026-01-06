"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function NouvelleFichePage() {
    const router = useRouter();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        name: "",
        code_client: "",
        city: "",
        groupe: "",
        annexe_contrat_numero: "",
        date_fiche: "",
        liste_supplementaire_annexe: false,
        plan_client_fourni_annexe: false,
    });

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const { name, value, type, checked } = e.target;

        setForm((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); // ✅ TOUJOURS en premier
        setLoading(true);
        setError(null);

        try {
            /* =======================
            AUTH
            ======================= */
            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            console.log("AUTH USER =", user);
            console.log("AUTH ERROR =", authError);

            if (authError || !user) {
                throw new Error("Utilisateur non authentifié");
            }

            /* =======================
            1️⃣ Client : récupérer ou créer
            ======================= */
            let clientId: string | null = null;

            if (form.code_client) {
                const { data: existingClient, error: existingError } =
                    await supabase
                        .from("clients")
                        .select("id")
                        .eq("code_client", form.code_client)
                        .maybeSingle();

                if (existingError) throw existingError;

                if (existingClient) {
                    clientId = existingClient.id;
                } else {
                    const { data: newClient, error: clientError } =
                        await supabase
                            .from("clients")
                            .insert({
                                name: form.name,
                                code_client: form.code_client,
                                city: form.city,
                            })
                            .select("id")
                            .single();

                    if (clientError) throw clientError;
                    clientId = newClient.id;
                }
            }

            /* =======================
            2️⃣ Création de la fiche
            ======================= */
            const { data: record, error: recordError } =
                await supabase
                    .from("records")
                    .insert({
                        client_id: clientId,
                        groupe: form.groupe,
                        annexe_contrat_numero: form.annexe_contrat_numero,
                        date_fiche: form.date_fiche || null,
                        nom_client: form.name,
                        liste_supplementaire_annexe:
                            form.liste_supplementaire_annexe,
                        plan_client_fourni_annexe:
                            form.plan_client_fourni_annexe,
                    })
                    .select("id")
                    .single();

            if (recordError) {
                console.error("RECORD ERROR FULL =", recordError);
                throw recordError;
            }

            // ✅ SUCCÈS
            router.push(`/recherche/${record.id}`);
        } catch (err: any) {
            console.error("SUPABASE ERROR:", err);
            setError(err?.message || "Erreur lors de la création de la fiche");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            style={{
                minHeight: "calc(100vh - 56px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <div style={{ width: "100%", maxWidth: 700 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700 }}>
                    Nouvelle fiche de renseignement
                </h1>

                <form
                    onSubmit={handleSubmit}
                    style={{
                        marginTop: 24,
                        backgroundColor: "#f9fafb",
                        padding: 24,
                        borderRadius: 12,
                        border: "1px solid #e5e7eb",
                    }}
                >
                    <Field
                        label="Raison sociale client"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="COLLEGE CAMILLE CLAUDEL"
                        required
                    />

                    <Field
                        label="Ville"
                        name="city"
                        value={form.city}
                        onChange={handleChange}
                        placeholder="VILLEPINTE"
                    />

                    <Field
                        label="Code client"
                        name="code_client"
                        value={form.code_client}
                        onChange={handleChange}
                        placeholder="CLXXXXX"
                    />

                    <Field
                        label="Groupe"
                        name="groupe"
                        value={form.groupe}
                        onChange={handleChange}
                        placeholder="XX-XX-XXXX"
                    />

                    <Field
                        label="Annexe au contrat d’abonnement n°"
                        name="annexe_contrat_numero"
                        value={form.annexe_contrat_numero}
                        onChange={handleChange}
                        placeholder="XXXXX"
                    />

                    <Field
                        label="Date de la fiche"
                        name="date_fiche"
                        type="date"
                        value={form.date_fiche}
                        onChange={handleChange}
                    />

                    <Checkbox
                        label="Liste supplémentaire en annexe"
                        name="liste_supplementaire_annexe"
                        checked={form.liste_supplementaire_annexe}
                        onChange={handleChange}
                    />

                    <Checkbox
                        label="Plan client fourni en annexe"
                        name="plan_client_fourni_annexe"
                        checked={form.plan_client_fourni_annexe}
                        onChange={handleChange}
                    />

                    {error && (
                        <p style={{ color: "red", marginTop: 8 }}>
                            {error}
                        </p>
                    )}

                    <div style={{ marginTop: 24 }}>
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                padding: "10px 16px",
                                borderRadius: 8,
                                border: "none",
                                backgroundColor: "#2563eb",
                                color: "#ffffff",
                                fontWeight: 500,
                                cursor: "pointer",
                            }}
                        >
                            {loading ? "Création..." : "Créer la fiche"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* =======================
   Composants simples
======================= */
function Field({
    label,
    name,
    value,
    onChange,
    placeholder,
    type = "text",
    required = false,
}: any) {
    return (
        <div style={{ marginBottom: 16 }}>
            <label
                style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 500,
                    marginBottom: 6,
                }}
            >
                {label}
            </label>
            <input
                type={type}
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                required={required}
                style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                }}
            />
        </div>
    );
}

function Checkbox({ label, name, checked, onChange }: any) {
    return (
        <label
            style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 12,
            }}
        >
            <input
                type="checkbox"
                name={name}
                checked={checked}
                onChange={onChange}
            />
            {label}
        </label>
    );
}
