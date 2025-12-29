import { supabase } from "@/lib/supabaseClient";

/* =======================
   KPIs globaux
======================= */
export async function fetchGlobalStats() {
    const [{ count: records }, { count: devices }] = await Promise.all([
        supabase.from("records").select("*", { count: "exact", head: true }),
        supabase.from("record_devices").select("*", { count: "exact", head: true }),
    ]);

    const { count: modifications } = await supabase
        .from("record_history")
        .select("*", { count: "exact", head: true });

    return {
        totalRecords: records ?? 0,
        totalDevices: devices ?? 0,
        totalModifications: modifications ?? 0,
    };
}

/* =======================
   Activité par utilisateur
======================= */
export async function fetchActivityByUser() {
    const { data, error } = await supabase
        .from("record_history")
        .select(`
            updated_by:user_profiles (
                username
            )
        `);

    if (error || !data) return [];

    const map: Record<string, number> = {};

    data.forEach((row: any) => {
        const name = row.updated_by?.username ?? "Inconnu";
        map[name] = (map[name] ?? 0) + 1;
    });

    return Object.entries(map).map(([username, count]) => ({
        username,
        count,
    }));
}

/* =======================
   Répartition types dispositifs (sans vides)
======================= */
export async function fetchDeviceTypes() {
    const { data, error } = await supabase
        .from("record_devices")
        .select("type_dispositif")
        .not("type_dispositif", "is", null)
        .neq("type_dispositif", "");

    if (error || !data) return [];

    const map: Record<string, number> = {};

    data.forEach((row) => {
        const value = row.type_dispositif?.trim();
        if (!value) return; // sécurité supplémentaire

        map[value] = (map[value] ?? 0) + 1;
    });

    return Object.entries(map)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);
}


/* =======================
   Top 5 dispositifs
======================= */
export async function fetchTopDevices(limit = 5) {
    const { data, error } = await supabase
        .from("record_devices")
        .select("type_dispositif");

    if (error || !data) return [];

    const map: Record<string, number> = {};

    data.forEach((row) => {
        const key = row.type_dispositif || "Non renseigné";
        map[key] = (map[key] ?? 0) + 1;
    });

    return Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([type, count]) => ({ type, count }));
}

/* =======================
   Top clients les plus actifs
======================= */
export async function fetchTopClients(limit = 10) {
    const { data, error } = await supabase
        .from("record_history")
        .select(`
            record:records (
                client:clients (
                    name,
                    code_client
                )
            )
        `);

    if (error || !data) return [];

    const map: Record<string, number> = {};

    data.forEach((row: any) => {
        const client = row.record?.client;
        if (!client) return;

        const label = `${client.name} (${client.code_client})`;
        map[label] = (map[label] ?? 0) + 1;
    });

    return Object.entries(map)
        .map(([client, count]) => ({ client, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}


/* =======================
   Moyenne dispositifs par fiche
======================= */
export async function fetchAverageDevices() {
    const [{ count: records }, { count: devices }] = await Promise.all([
        supabase.from("records").select("*", { count: "exact", head: true }),
        supabase.from("record_devices").select("*", { count: "exact", head: true }),
    ]);

    if (!records || !devices || records === 0) return "0";

    return (devices / records).toFixed(2);
}

/* =======================
   Comparaison mois courant vs précédent
======================= */
export async function fetchMonthComparison() {
    const now = new Date();

    const startCurrent = new Date(now.getFullYear(), now.getMonth(), 1);
    const startPrevious = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endPrevious = new Date(now.getFullYear(), now.getMonth(), 0);

    const [{ count: current }, { count: previous }] = await Promise.all([
        supabase
            .from("record_history")
            .select("*", { count: "exact", head: true })
            .gte("created_at", startCurrent.toISOString()),

        supabase
            .from("record_history")
            .select("*", { count: "exact", head: true })
            .gte("created_at", startPrevious.toISOString())
            .lte("created_at", endPrevious.toISOString()),
    ]);

    const diff = (current ?? 0) - (previous ?? 0);
    const trend =
        diff > 0 ? "up" : diff < 0 ? "down" : "stable";

    return {
        current: current ?? 0,
        previous: previous ?? 0,
        diff,
        trend,
    };
}

/* =======================
   Timeline activité (jour)
======================= */
export async function fetchActivityTimeline() {
    const { data, error } = await supabase
        .from("record_history")
        .select("created_at");

    if (error || !data) return [];

    const map: Record<string, number> = {};

    data.forEach((row) => {
        const day = row.created_at.slice(0, 10);
        map[day] = (map[day] ?? 0) + 1;
    });

    return Object.entries(map)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count }));
}

/* =======================
   Fiches modifiées cette semaine
======================= */
export async function fetchModifiedThisWeek() {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const { count } = await supabase
        .from("record_history")
        .select("*", { count: "exact", head: true })
        .gte("created_at", since.toISOString());

    return count ?? 0;
}

/* =======================
   Fiches inactives (>30j)
======================= */
export async function fetchInactiveRecords() {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const { count } = await supabase
        .from("records")
        .select("*", { count: "exact", head: true })
        .lt("updated_at", since.toISOString());

    return count ?? 0;
}


/* =======================
   Derniers clients modifiés
======================= */
export async function fetchRecentClients(limit = 10) {
    const { data, error } = await supabase
        .from("record_history")
        .select(`
            created_at,
            record:records!left (
                id,
                client:clients!left (
                    name,
                    code_client,
                    city
                )
            )
        `)


    if (error || !data) return [];

    return data.map((row) => ({
        date: row.created_at,
        id: row.record?.id,
        name: row.record?.client?.name ?? "Client inconnu",
        code: row.record?.client?.code_client ?? "-",
        city: row.record?.client?.city ?? null,
    }));

}

/* =======================
   Clients les moins actifs
======================= */
export async function fetchLeastActiveClients() {
    const { data } = await supabase
        .from("records")
        .select(`
            id,
            client:clients (
                name,
                code_client
            ),
            history:record_history (
                id
            )
        `);

    if (!data) return [];

    return data
        .map((r: any) => ({
            id: r.id,
            name: r.client?.name ?? "Client inconnu",
            code_client: r.client?.code_client ?? "-",
            count: r.history?.length ?? 0,
        }))
        .sort((a, b) => a.count - b.count)
        .slice(0, 10);
}

/* =======================
   Heatmap activité (par jour)
   - Renvoie les N derniers jours, même si count = 0
======================= */
export async function fetchActivityHeatmap(days: number = 90) {
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    since.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
        .from("record_history")
        .select("created_at")
        .gte("created_at", since.toISOString());

    if (error) {
        console.error("fetchActivityHeatmap error:", error);
        return [];
    }

    // count par YYYY-MM-DD
    const map: Record<string, number> = {};
    (data ?? []).forEach((r: any) => {
        const day = String(r.created_at).slice(0, 10);
        map[day] = (map[day] ?? 0) + 1;
    });

    // Générer une série complète de jours (avec 0 si absent)
    const out: { date: string; count: number }[] = [];
    const cursor = new Date(since);

    for (let i = 0; i < days; i++) {
        const y = cursor.getFullYear();
        const m = String(cursor.getMonth() + 1).padStart(2, "0");
        const d = String(cursor.getDate()).padStart(2, "0");
        const key = `${y}-${m}-${d}`;

        out.push({ date: key, count: map[key] ?? 0 });
        cursor.setDate(cursor.getDate() + 1);
    }

    return out;
}

