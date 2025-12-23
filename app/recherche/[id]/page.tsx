export default function ModificationPage({
    params,
}: {
    params: { id: string };
}) {
    return (
        <div>
            <h1 style={{ fontSize: 24, fontWeight: 700 }}>
                Modification de l’intervention
            </h1>

            <p style={{ marginTop: 8 }}>
                Intervention ID : <strong>{params.id}</strong>
            </p>

            <div style={{ marginTop: 24 }}>
                <em>
                    (Formulaire PDF + tableau dynamique à venir)
                </em>
            </div>
        </div>
    );
}
