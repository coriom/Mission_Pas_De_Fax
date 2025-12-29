"use client";

import { useEffect, useState } from "react";
import {
    fetchGlobalStats,
    fetchActivityByUser,
    fetchDeviceTypes,
    fetchActivityTimeline,
    fetchModifiedThisWeek,
    fetchInactiveRecords,
    fetchTopClients,
    fetchAverageDevices,
    fetchMonthComparison,
    fetchRecentClients,
    fetchLeastActiveClients,
    fetchActivityHeatmap
} from "./queries";

/* Components */
import KPIGrid from "./components/KPIGrid";
import ActivityByUser from "./components/ActivityByUser";
import DeviceTypeChart from "./components/DeviceTypeChart";
import ActivityTimeline from "./components/ActivityTimeline";
import TopClients from "./components/TopClients";
import RecentClients from "./components/RecentClients";
import LeastActiveClients from "./components/LeastActiveClients";
import ActivityHeatmap from "./components/ActivityHeatmap";


export default function StatistiquesPage() {
    const [stats, setStats] = useState<any>(null);
    const [byUser, setByUser] = useState<any[]>([]);
    const [devices, setDevices] = useState<any[]>([]);
    const [timeline, setTimeline] = useState<any[]>([]);

    const [topClients, setTopClients] = useState<any[]>([]);
    const [recentClients, setRecentClients] = useState<any[]>([]);
    const [leastActiveClients, setLeastActiveClients] = useState<any[]>([]);

    const [weekly, setWeekly] = useState(0);
    const [inactive, setInactive] = useState(0);
    const [average, setAverage] = useState("0");
    const [month, setMonth] = useState<any>(null);
    const [heatmap, setHeatmap] = useState<any[]>([]);


    useEffect(() => {
        const load = async () => {
            setStats(await fetchGlobalStats());
            setByUser(await fetchActivityByUser());
            setDevices(await fetchDeviceTypes());
            setTimeline(await fetchActivityTimeline());

            setWeekly(await fetchModifiedThisWeek());
            setInactive(await fetchInactiveRecords());
            setAverage(await fetchAverageDevices());
            setMonth(await fetchMonthComparison());

            setTopClients(await fetchTopClients());
            setRecentClients(await fetchRecentClients());
            setLeastActiveClients(await fetchLeastActiveClients());
            setHeatmap(await fetchActivityHeatmap(365));
        };

        load();
    }, []);

    if (!stats) return <p>Chargement…</p>;

    return (
        <div style={{ paddingBottom: 48 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800 }}>
                Statistiques – Administration
            </h1>

            {/* =======================
            1️⃣ Vue d’ensemble (KPIs)
            ======================= */}
            <Section title="Vue d’ensemble">
                <Card>
                    <KPIGrid
                        stats={{
                            ...stats,
                            modifiedThisWeek: weekly,
                            inactiveRecords: inactive,
                            avgDevices: average,
                            monthComparison: month,
                        }}
                    />
                </Card>
            </Section>

            {/* =======================
            2️⃣ Activité (classique)
            ======================= */}
            <Section title="Activité">
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "2fr 1fr",
                        gap: 24,
                    }}
                >
                    <Card>
                        <ActivityTimeline data={timeline} />
                    </Card>

                    <Card>
                        <ActivityByUser data={byUser} />
                    </Card>
                </div>
            </Section>

            {/* =======================
            3️⃣ Heatmap activité (BLOC MAJEUR)
            ======================= */}
            <Section title="Vue globale de l’activité">
                <Card>
                    <ActivityHeatmap data={heatmap} />
                </Card>
            </Section>

            {/* =======================
            4️⃣ Dispositifs
            ======================= */}
            <Section title="Dispositifs">
                <Card>
                    <DeviceTypeChart data={devices} />
                </Card> 
            </Section>

            {/* =======================
            5️⃣ Clients
            ======================= */}
            <Section title="Clients">
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: 24,
                    }}
                >
                    <Card>
                        <TopClients data={topClients} />
                    </Card>

                    <Card>
                        <RecentClients data={recentClients} />
                    </Card>

                    <Card>
                        <LeastActiveClients data={leastActiveClients} />
                    </Card>
                </div>
            </Section>
        </div>
    );
}

/* =======================
   UI helpers
======================= */
function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div style={{ marginTop: 36 }}>
            <h2
                style={{
                    fontSize: 18,
                    fontWeight: 700,
                    marginBottom: 16,
                }}
            >
                {title}
            </h2>
            {children}
        </div>
    );
}

function Card({ children }: { children: React.ReactNode }) {
    return (
        <div
            style={{
                backgroundColor: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: 20,
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
        >
            {children}
        </div>
    );
}
