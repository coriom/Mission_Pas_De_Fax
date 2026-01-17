"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { LOCALISATIONS, EMPLACEMENTS, TYPES_DISPOSITIF } from "../constants";
import RecordPhotos from "./RecordPhotos";

type DeviceRow = {
  id: string;
  record_id: string;
  localisation_zone: string;
  emplacement: string;
  type_dispositif: string;
  numero: string | null; // ✅ manuel (texte)
  position: number; // ✅ ordre d’affichage
};

type FieldKey = "localisation_zone" | "emplacement" | "type_dispositif";

// ✅ tout le bandeau est maintenant éditable (admin)
type MetaKey = "groupe" | "annexe_contrat_numero" | "date_fiche";
type ClientKey = "name" | "code_client" | "city";

type RecordClient = {
  name: string;
  code_client: string;
  city: string | null;
};

type RecordMeta = {
  id: string;
  client_id: string | null; // ✅ nécessaire pour update clients
  groupe: string | null;
  annexe_contrat_numero: string | null;
  date_fiche: string | null;
  client: (RecordClient & { id?: string }) | null;
};

// ✅ Supabase peut parfois typer les relations comme tableaux (clients[]) selon les defs.
// On normalise pour éviter les erreurs TS en build (Vercel).
type RecordMetaRaw = Omit<RecordMeta, "client"> & {
  client: RecordClient | RecordClient[] | null;
};

function coerceRecordMeta(raw: unknown): RecordMeta {
  const r = (raw ?? {}) as any;

  const clientRaw = r?.client ?? null;
  const clientObj: RecordClient | null = Array.isArray(clientRaw)
    ? clientRaw[0] ?? null
    : clientRaw ?? null;

  return {
    id: String(r?.id ?? ""),
    client_id: r?.client_id ?? null,
    groupe: r?.groupe ?? null,
    annexe_contrat_numero: r?.annexe_contrat_numero ?? null,
    date_fiche: r?.date_fiche ?? null,
    client: clientObj
      ? {
          name: String(clientObj.name ?? ""),
          code_client: String(clientObj.code_client ?? ""),
          city: clientObj.city ?? null,
        }
      : null,
  };
}

export default function ModificationPage() {
  const params = useParams();
  const recordId =
    typeof (params as any)?.id === "string"
      ? ((params as any).id as string)
      : Array.isArray((params as any)?.id)
      ? ((params as any).id[0] as string)
      : "";

  const [rows, setRows] = useState<DeviceRow[]>([]);
  const [recordMeta, setRecordMeta] = useState<RecordMeta | null>(null);
  const [loading, setLoading] = useState(true);

  // ✅ admin : édition bandeau (meta)
  const [isAdmin, setIsAdmin] = useState(false);
  const [metaDraft, setMetaDraft] = useState<RecordMeta | null>(null);
  const [metaSaveState, setMetaSaveState] = useState<
    "idle" | "dirty" | "saving" | "saved" | "error"
  >("idle");

  // lignes modifiées depuis la dernière sauvegarde
  const dirtyIds = useRef<Set<string>>(new Set());

  const [saveState, setSaveState] = useState<
    "idle" | "dirty" | "saving" | "saved" | "error"
  >("idle");

  const [commentaire, setCommentaire] = useState("");

  // Pour l'UI: erreurs de validation (numero manuel)
  const [numeroError, setNumeroError] = useState<string | null>(null);
  const [photoDeleteMode, setPhotoDeleteMode] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // ✅ Role admin
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (!userError && user) {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

          if (!profileError) {
            setIsAdmin(profile?.role === "admin");
          }
        }
      } catch {
        // silencieux
      }

      // 1️⃣ Charger les lignes (tri par position)
      const { data: devices, error: devicesError } = await supabase
        .from("record_devices")
        .select(
          "id, record_id, localisation_zone, emplacement, type_dispositif, numero, position"
        )
        .eq("record_id", recordId)
        .order("position", { ascending: true });

      if (!devicesError && devices) {
        // ⚠️ on normalise quand même au cas où
        const sorted = (devices as any[])
          .slice()
          .sort((a, b) => Number(a.position) - Number(b.position));
        const normalized = sorted.map((r, idx) => ({
          ...(r as DeviceRow),
          // on force numero en string/null
          numero:
            r?.numero === null || r?.numero === undefined
              ? null
              : String(r.numero),
          position: idx + 1,
        }));
        setRows(normalized);
      } else if (devicesError) {
        console.error("FETCH DEVICES ERROR", devicesError);
      }

      // 2️⃣ Charger le commentaire
      const { data: record, error: recordError } = await supabase
        .from("records")
        .select("commentaire")
        .eq("id", recordId)
        .single();

      if (!recordError && record) {
        setCommentaire((record as any).commentaire ?? "");
      } else if (recordError) {
        console.error("FETCH COMMENT ERROR", recordError);
      }

      // 3️⃣ Charger les métadonnées de la fiche (✅ inclut client_id)
      const { data: meta, error: metaError } = await supabase
        .from("records")
        .select(
          `
            id,
            client_id,
            groupe,
            annexe_contrat_numero,
            date_fiche,
            client:clients (
              name,
              code_client,
              city
            )
          `
        )
        .eq("id", recordId)
        .single();

      if (!metaError && meta) {
        const typed = coerceRecordMeta(meta as RecordMetaRaw);
        setRecordMeta(typed);
        setMetaDraft(typed);
      } else if (metaError) {
        console.error("FETCH META ERROR", metaError);
      }

      setLoading(false);
    };

    if (recordId) fetchData();
  }, [recordId]);

  const isEmptyRow = (row: DeviceRow) => {
    return (
      row.localisation_zone.trim() === "" &&
      row.emplacement.trim() === "" &&
      row.type_dispositif.trim() === ""
    );
  };

  /** =======================
   *  MODIFICATION LOCAL (text fields)
   ======================= */
  const updateRow = (id: string, field: FieldKey, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
    dirtyIds.current.add(id);
    setSaveState("dirty");
  };

  /** =======================
   *  MODIFICATION LOCAL (numero manuel)
   ======================= */
  const updateNumero = (id: string, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, numero: value } : r))
    );

    dirtyIds.current.add(id);
    setSaveState("dirty");
  };

  /** =======================
   *  VALIDATION numero
   *  ✅ autorise les doublons
   ======================= */
  const validateNumeros = (candidateRows: DeviceRow[]) => {
    setNumeroError(null);

    const active = candidateRows.filter((r) => !isEmptyRow(r));
    for (const r of active) {
      const n = (r.numero ?? "").trim();
      if (!n) return "⚠️ Le champ N° est obligatoire pour chaque ligne non vide.";
    }

    // ✅ plus de check d'unicité => doublons autorisés
    return null;
  };

  /** =======================
   *  MOVE ROW (boutons à gauche)
   *  ✅ On déplace la ligne dans le tableau puis on normalise position = 1..n
   ======================= */
  const normalizePositions = (list: DeviceRow[]) => {
    return list.map((r, idx) => ({ ...r, position: idx + 1 }));
  };

  const moveRow = (rowId: string, direction: -1 | 1) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === rowId);
      const to = idx + direction;

      if (idx < 0 || to < 0 || to >= prev.length) return prev;

      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(to, 0, item);

      const normalized = normalizePositions(next);

      // ✅ positions changent => on marque tout le monde dirty
      normalized.forEach((r) => dirtyIds.current.add(r.id));
      setSaveState("dirty");

      return normalized;
    });
  };

  const moveUp = (rowId: string) => moveRow(rowId, -1);
  const moveDown = (rowId: string) => moveRow(rowId, +1);

  /** =======================
   *  SAUVEGARDE EXPLICITE (table)
   ======================= */
  const handleSave = async () => {
    setSaveState("saving");

    try {
      const validationError = validateNumeros(rows);
      if (validationError) {
        setNumeroError(validationError);
        setSaveState("error");
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        throw new Error("Utilisateur non authentifié");
      }
      const userId = authData.user.id;

      /* 1️⃣ État actuel */
      const { data: currentRows, error: fetchError } = await supabase
        .from("record_devices")
        .select("localisation_zone, emplacement, type_dispositif, numero, position")
        .eq("record_id", recordId)
        .order("position");

      if (fetchError) throw fetchError;

      /* 2️⃣ Historique */
      const { error: historyError } = await supabase
        .from("record_history")
        .insert({
          record_id: recordId,
          updated_by: userId,
          snapshot: {
            rows: currentRows ?? [],
            commentaire,
          },
        });

      if (historyError) throw historyError;

      const positions = rows.map((r) => Number(r.position));
      const dup = positions.filter((p, i) => positions.indexOf(p) !== i);
      if (dup.length) {
        console.error("DUP POSITIONS", dup, positions);
        throw new Error("Positions en doublon (bug reorder).");
      }

      /* 3️⃣ Sauvegarde courante (✅ positions en 2 phases pour éviter collision UNIQUE) */

      // 3a) on s’assure que l’ordre local est stable
      const sortedRows = [...rows].sort(
        (a, b) => Number(a.position) - Number(b.position)
      );

      // 3b) on normalise en 1..n
      const normalized = sortedRows.map((r, idx) => ({
        ...r,
        position: idx + 1,
      }));

      // ✅ Phase 1 : positions temporaires très hautes (évite tout conflit unique)
      const tempPayload = normalized.map((r) => ({
        id: r.id,
        record_id: recordId,
        localisation_zone: r.localisation_zone || "",
        emplacement: r.emplacement || "",
        type_dispositif: r.type_dispositif || "",
        numero: (r.numero ?? "").trim(), // ✅ TEXTE
        position: 1000000 + Number(r.position), // <-- clé du fix
      }));

      const { error: tempErr } = await supabase
        .from("record_devices")
        .upsert(tempPayload, { onConflict: "id" });

      if (tempErr) throw tempErr;

      // ✅ Phase 2 : positions finales 1..n
      const finalPayload = normalized.map((r) => ({
        id: r.id,
        record_id: recordId,
        localisation_zone: r.localisation_zone || "",
        emplacement: r.emplacement || "",
        type_dispositif: r.type_dispositif || "",
        numero: (r.numero ?? "").trim(), // ✅ TEXTE (NE PAS Number(...))
        position: Number(r.position),
      }));


      const { data: saved, error: saveError } = await supabase
        .from("record_devices")
        .upsert(finalPayload, { onConflict: "id" })
        .select("id"); // force une réponse lisible

      if (saveError) {
        console.error("❌ UPSERT record_devices ERROR =", JSON.stringify(saveError, null, 2));
        throw saveError;
      }
      console.log("✅ UPSERT OK, rows:", saved?.length);




      
      // ✅ IMPORTANT : on met aussi l’état React à jour avec les positions normalisées
      setRows(normalized);

      const { error: commentError } = await supabase
        .from("records")
        .update({ commentaire })
        .eq("id", recordId);

      if (commentError) throw commentError;

      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1200);
    } catch (err: any) {
      // ✅ logs "robustes" pour voir le vrai message Supabase/Postgres
      const props = err ? Object.getOwnPropertyNames(err) : [];
      const picked: any = {};
      for (const k of props) picked[k] = (err as any)[k];

      console.error("❌ SAVE ERROR (String)", String(err));
      console.error("❌ SAVE ERROR (props)", props);
      console.error("❌ SAVE ERROR (picked)", picked);
      console.error("❌ SAVE ERROR (raw)", err);

      setSaveState("error");
    }
  };

  /** =======================
   *  AJOUT DE LIGNE
   ======================= */
  const nextPosition = useMemo(() => {
    const maxPos = Math.max(
      0,
      ...rows
        .map((r) => Number(r.position))
        .filter((n) => Number.isFinite(n) && !Number.isNaN(n))
    );
    return maxPos + 1;
  }, [rows]);

  // ✅ désormais "numéro suggéré" = position (texte), puisque doublons autorisés
  const nextSuggestedNumero = useMemo(() => String(nextPosition), [nextPosition]);

  const addRow = async () => {
    const suggestedNumero = String(nextPosition);
    const position = nextPosition;

    const { data, error } = await supabase
      .from("record_devices")
      .insert({
        record_id: recordId,
        localisation_zone: "",
        emplacement: "",
        type_dispositif: "",
        numero: suggestedNumero,
        position,
      })
      .select(
        "id, record_id, localisation_zone, emplacement, type_dispositif, numero, position"
      )
      .single();

    if (!error && data) {
      setRows((prev) => {
        const next = [...prev, data as DeviceRow];
        next.sort((a, b) => Number(a.position) - Number(b.position));
        return next.map((r, idx) => ({ ...r, position: idx + 1 }));
      });
      dirtyIds.current.add((data as any).id);
      setSaveState("dirty");
    } else {
      console.error("ADD ROW ERROR", error);
      setSaveState("error");
    }
  };

  /** =======================
   *  SUPPRESSION DE LIGNE
   ======================= */
  const deleteRow = async (id: string) => {
    const { error } = await supabase.from("record_devices").delete().eq("id", id);

    if (error) {
      console.error("DELETE ROW ERROR", error);
      alert("❌ Erreur lors de la suppression.");
      return;
    }

    setRows((prev) => prev.filter((r) => r.id !== id));
    dirtyIds.current.delete(id);
    setSaveState("dirty");
  };

  /** =======================
   *  ADMIN: update bandeau (records + clients)
   ======================= */
  const updateMetaDraft = (key: MetaKey, value: string) => {
    setMetaDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, [key]: value === "" ? null : value };
    });
    setMetaSaveState("dirty");
  };

  const updateClientDraft = (key: ClientKey, value: string) => {
    setMetaDraft((prev) => {
      if (!prev) return prev;
      const currentClient = prev.client ?? {
        name: "",
        code_client: "",
        city: null,
      };
      const nextClient = {
        ...currentClient,
        [key]: value === "" ? (key === "city" ? null : "") : value,
      };
      return { ...prev, client: nextClient };
    });
    setMetaSaveState("dirty");
  };

  const handleSaveMeta = async () => {
    if (!isAdmin || !metaDraft) return;

    setMetaSaveState("saving");

    try {
      // 1) update RECORDS
      const recordPayload = {
        groupe: metaDraft.groupe,
        annexe_contrat_numero: metaDraft.annexe_contrat_numero,
        date_fiche: metaDraft.date_fiche,
      };

      const { error: recErr } = await supabase
        .from("records")
        .update(recordPayload)
        .eq("id", recordId);
      if (recErr) throw recErr;

      // 2) update CLIENTS (si client_id)
      if (metaDraft.client_id && metaDraft.client) {
        const clientPayload = {
          name: metaDraft.client.name,
          code_client: metaDraft.client.code_client,
          city: metaDraft.client.city,
        };

        const { error: cliErr } = await supabase
          .from("clients")
          .update(clientPayload)
          .eq("id", metaDraft.client_id);
        if (cliErr) throw cliErr;
      }

      // 3) re-fetch bandeau (source de vérité)
      const { data, error } = await supabase
        .from("records")
        .select(
          `
            id,
            client_id,
            groupe,
            annexe_contrat_numero,
            date_fiche,
            client:clients (
              name,
              code_client,
              city
            )
          `
        )
        .eq("id", recordId)
        .single();

      if (error) throw error;

      const updated = coerceRecordMeta(data as RecordMetaRaw);
      setRecordMeta(updated);
      setMetaDraft(updated);

      setMetaSaveState("saved");
      setTimeout(() => setMetaSaveState("idle"), 1200);
    } catch (err: any) {
      const props = err ? Object.getOwnPropertyNames(err) : [];
      const picked: any = {};
      for (const k of props) picked[k] = (err as any)[k];

      console.error("SAVE META ERROR (String)", String(err));
      console.error("SAVE META ERROR (props)", props);
      console.error("SAVE META ERROR (picked)", picked);
      console.error("SAVE META ERROR (raw)", err);

      setMetaSaveState("error");
    }
  };

  if (loading) return <p>Chargement…</p>;

  return (
    <div>
      {/* INFOS FICHE */}
      {recordMeta && (
        <div
          style={{
            marginBottom: 24,
            padding: 16,
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            backgroundColor: "#ffffff",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          {/* ✅ Admin: tout éditable */}
          {isAdmin ? (
            <>
              <InfoEditable
                label="Raison sociale client"
                value={metaDraft?.client?.name ?? ""}
                placeholder="—"
                onChange={(v) => updateClientDraft("name", v)}
              />
              <InfoEditable
                label="Ville"
                value={metaDraft?.client?.city ?? ""}
                placeholder="—"
                onChange={(v) => updateClientDraft("city", v)}
              />
              <InfoEditable
                label="Code client"
                value={metaDraft?.client?.code_client ?? ""}
                placeholder="—"
                onChange={(v) => updateClientDraft("code_client", v)}
              />

              <InfoEditable
                label="Groupe"
                value={metaDraft?.groupe ?? ""}
                placeholder="—"
                onChange={(v) => updateMetaDraft("groupe", v)}
              />
              <InfoEditable
                label="Annexe au contrat d’abonnement n°"
                value={metaDraft?.annexe_contrat_numero ?? ""}
                placeholder="—"
                onChange={(v) => updateMetaDraft("annexe_contrat_numero", v)}
              />
              <InfoEditable
                label="Date de la fiche"
                type="date"
                value={metaDraft?.date_fiche ?? ""}
                placeholder="—"
                onChange={(v) => updateMetaDraft("date_fiche", v)}
              />

              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button
                  type="button"
                  onClick={handleSaveMeta}
                  disabled={metaSaveState === "saving" || metaSaveState === "idle"}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    backgroundColor:
                      metaSaveState === "saving" ? "#f3f4f6" : "#111827",
                    color: metaSaveState === "saving" ? "#111827" : "#ffffff",
                    cursor:
                      metaSaveState === "saving"
                        ? "not-allowed"
                        : metaSaveState === "idle"
                        ? "not-allowed"
                        : "pointer",
                    fontWeight: 700,
                    width: "100%",
                  }}
                  title={
                    metaSaveState === "dirty"
                      ? "Enregistrer le bandeau"
                      : metaSaveState === "saved"
                      ? "Enregistré"
                      : "—"
                  }
                >
                  {metaSaveState === "saving"
                    ? "Enregistrement…"
                    : metaSaveState === "saved"
                    ? "Bandeau enregistré ✓"
                    : "Enregistrer le bandeau"}
                </button>
              </div>
            </>
          ) : (
            <>
              <Info label="Raison sociale client" value={recordMeta.client?.name} />
              <Info label="Ville" value={recordMeta.client?.city} />
              <Info label="Code client" value={recordMeta.client?.code_client} />
              <Info label="Groupe" value={recordMeta.groupe} />
              <Info
                label="Annexe au contrat d’abonnement n°"
                value={recordMeta.annexe_contrat_numero}
              />
              <Info label="Date de la fiche" value={recordMeta.date_fiche} />
            </>
          )}
        </div>
      )}

      {/* HEADER */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>
          Implantation des dispositifs
        </h1>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <SaveBadge state={saveState} />

          <button
            type="button"
            onClick={handleSave}
            disabled={saveState === "saving"}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              backgroundColor: saveState === "saving" ? "#f3f4f6" : "#111827",
              color: saveState === "saving" ? "#111827" : "#ffffff",
              cursor: saveState === "saving" ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {saveState === "saving" ? "Sauvegarde…" : "Sauvegarder"}
          </button>

          <button
            type="button"
            onClick={() => window.open(`/recherche/${recordId}/pdf`, "_blank")}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              backgroundColor: "#ffffff",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            📄 Export PDF
          </button>
        </div>
      </div>

      {/* Alerte validation numero */}
      {numeroError && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 10,
            border: "1px solid #fecaca",
            backgroundColor: "#fef2f2",
            color: "#991b1b",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {numeroError}
        </div>
      )}

      {/* DATALISTS */}
      <datalist id="localisations">
        {LOCALISATIONS.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>

      <datalist id="emplacements">
        {EMPLACEMENTS.map((e) => (
          <option key={e} value={e} />
        ))}
      </datalist>

      <datalist id="types">
        {TYPES_DISPOSITIF.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      {/* TABLE */}
      <div
        style={{
          marginTop: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: "#ffffff",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ backgroundColor: "#f9fafb" }}>
            <tr>
              {/* ✅ colonne swap à gauche */}
              <Th style={{ width: "54px" }}> </Th>
              <Th>Localisation zone</Th>
              <Th>Emplacement du dispositif</Th>
              <Th>Type dispositif</Th>
              <Th style={{ width: "90px" }}>N°</Th>
              <Th style={{ width: "44px" }}> </Th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const empty = isEmptyRow(row);

              return (
                <tr key={row.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                  {/* ✅ boutons à gauche */}
                  <Td style={{ padding: "8px 10px", width: 54 }}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        alignItems: "center",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => moveUp(row.id)}
                        title="Monter la ligne"
                        style={swapBtnStyle}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDown(row.id)}
                        title="Descendre la ligne"
                        style={swapBtnStyle}
                      >
                        ↓
                      </button>
                    </div>
                  </Td>

                  <Td>
                    <SmallInput
                      list="localisations"
                      value={row.localisation_zone}
                      onChange={(v) => updateRow(row.id, "localisation_zone", v)}
                    />
                  </Td>

                  <Td>
                    <SmallInput
                      list="emplacements"
                      value={row.emplacement}
                      onChange={(v) => updateRow(row.id, "emplacement", v)}
                    />
                  </Td>

                  <Td>
                    <SmallInput
                      list="types"
                      value={row.type_dispositif}
                      onChange={(v) => updateRow(row.id, "type_dispositif", v)}
                    />
                  </Td>

                  {/* ✅ NUMERO MANUEL */}
                  <Td style={{ textAlign: "center" }}>
                    <NumeroInput
                      value={row.numero ?? ""}
                      onChange={(v) => updateNumero(row.id, v)}
                      placeholder={empty ? "" : "N°"}
                    />
                  </Td>

                  <Td style={{ textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={() => deleteRow(row.id)}
                      title="Supprimer la ligne"
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                        backgroundColor: "#ffffff",
                        cursor: "pointer",
                        color: "#dc2626",
                        fontWeight: 700,
                        lineHeight: "28px",
                      }}
                    >
                      ×
                    </button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* AJOUT */}
      <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center" }}>
        <button
          onClick={addRow}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            backgroundColor: "#f9fafb",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          ➕ Ajouter une ligne
        </button>

        <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 600 }}>
          Numéro suggéré : {nextSuggestedNumero} (modifiable) • Position : {nextPosition}
        </span>
      </div>

      {/* PHOTOS */}
      <RecordPhotos recordId={recordId} isAdmin={isAdmin} />

      {/* COMMENTAIRE */}
      <div
        style={{
          marginTop: 24,
          padding: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          backgroundColor: "#ffffff",
        }}
      >
        <label
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          Commentaire
        </label>

        <textarea
          value={commentaire}
          onChange={(e) => {
            setCommentaire(e.target.value);
            setSaveState("dirty");
          }}
          placeholder="Ajouter un commentaire libre concernant cette fiche…"
          style={{
            width: "100%",
            minHeight: 90,
            resize: "vertical",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            fontSize: 14,
            fontFamily: "inherit",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>
    </div>
  );
}

/* =======================
   UI helpers
======================= */
function SaveBadge({ state }: { state: "idle" | "dirty" | "saving" | "saved" | "error" }) {
  if (state === "idle") return null;

  const map: Record<
    "idle" | "dirty" | "saving" | "saved" | "error",
    { text: string; bg: string; color: string }
  > = {
    idle: { text: "", bg: "", color: "" },
    dirty: { text: "Modifications non sauvegardées", bg: "#FEF3C7", color: "#92400E" },
    saving: { text: "Sauvegarde en cours…", bg: "#DBEAFE", color: "#1D4ED8" },
    saved: { text: "Sauvegardé ✓", bg: "#DCFCE7", color: "#166534" },
    error: { text: "Erreur de sauvegarde", bg: "#FEE2E2", color: "#991B1B" },
  };

  const s = map[state];

  return (
    <span
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        backgroundColor: s.bg,
        color: s.color,
        border: "1px solid #e5e7eb",
        whiteSpace: "nowrap",
      }}
    >
      {s.text}
    </span>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{value || "—"}</div>
    </div>
  );
}

function InfoEditable({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, fontWeight: 700 }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          height: 36,
          padding: "6px 10px",
          borderRadius: 10,
          border: "1px solid #d1d5db",
          fontSize: 14,
          outline: "none",
          boxSizing: "border-box",
          fontWeight: 700,
        }}
      />
    </div>
  );
}

function SmallInput({ list, value, onChange }: { list: string; value: string; onChange: (v: string) => void }) {
  return (
    <input
      list={list}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        height: 34,
        padding: "6px 10px",
        borderRadius: 8,
        border: "1px solid #d1d5db",
        fontSize: 14,
        outline: "none",
        boxSizing: "border-box",
      }}
    />
  );
}

function NumeroInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      inputMode="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        height: 34,
        padding: "6px 10px",
        borderRadius: 8,
        border: "1px solid #d1d5db",
        fontSize: 14,
        outline: "none",
        boxSizing: "border-box",
        textAlign: "center",
        fontWeight: 700,
        backgroundColor: "#ffffff",
      }}
    />
  );
}

function Th({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "12px",
        fontSize: 13,
        fontWeight: 700,
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <td
      style={{
        padding: "10px 12px",
        verticalAlign: "top",
        ...style,
      }}
    >
      {children}
    </td>
  );
}

const swapBtnStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  backgroundColor: "#ffffff",
  cursor: "pointer",
  color: "#111827",
  fontWeight: 900,
  lineHeight: "28px",
};
