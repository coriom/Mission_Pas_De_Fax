"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type RecordPhoto = {
  id: string;
  record_id: string;
  path: string;
  filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  position: number;
  created_at: string;
  created_by: string | null;
};

export default function RecordPhotos({
  recordId,
  isAdmin,
}: {
  recordId: string;
  isAdmin: boolean;
}) {
  const [photos, setPhotos] = useState<RecordPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // urls signées par photo.id
  const [urls, setUrls] = useState<Record<string, string>>({});

  // modal
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const sorted = useMemo(() => {
    return [...photos].sort((a, b) => Number(a.position) - Number(b.position));
  }, [photos]);

  const activePhoto = sorted[activeIndex] ?? null;

  const fetchPhotos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("record_photos")
        .select("id, record_id, path, filename, mime_type, size_bytes, position, created_at, created_by")
        .eq("record_id", recordId)
        .order("position", { ascending: true });

      if (error) throw error;

      const list = (data ?? []) as RecordPhoto[];
      setPhotos(list);

      // générer urls signées
      const urlMap: Record<string, string> = {};
      for (const p of list) {
        const { data: signed, error: signedErr } = await supabase.storage
          .from("record-photos")
          .createSignedUrl(p.path, 60 * 30); // 30 minutes

        if (!signedErr && signed?.signedUrl) {
          urlMap[p.id] = signed.signedUrl;
        }
      }
      setUrls(urlMap);
    } catch (err: any) {
      console.error("PHOTOS FETCH ERROR", {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
        raw: err,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  const openPicker = () => inputRef.current?.click();

  const nextPosition = useMemo(() => {
    const maxPos = Math.max(0, ...photos.map((p) => Number(p.position) || 0));
    return maxPos + 1;
  }, [photos]);

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!isAdmin) return;

    setUploading(true);
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr || !user) throw new Error("Utilisateur non authentifié");

      // upload en série (simple & fiable)
      let pos = nextPosition;

      for (const file of Array.from(files)) {
        const safeName = (file.name || "image")
          .replace(/\s+/g, "_")
          .replace(/[^a-zA-Z0-9._-]/g, "");

        const path = `${recordId}/${Date.now()}_${safeName}`;

        const { error: upErr } = await supabase.storage
          .from("record-photos")
          .upload(path, file, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });

        if (upErr) throw upErr;

        const { data: inserted, error: insErr } = await supabase
          .from("record_photos")
          .insert({
            record_id: recordId,
            path,
            filename: file.name,
            mime_type: file.type,
            size_bytes: file.size,
            position: pos,
            created_by: user.id,
          })
          .select("id, record_id, path, filename, mime_type, size_bytes, position, created_at, created_by")
          .single();

        if (insErr) throw insErr;

        // signer url pour affichage immédiat
        const { data: signed, error: signedErr } = await supabase.storage
          .from("record-photos")
          .createSignedUrl(path, 60 * 30);

        if (!signedErr && signed?.signedUrl) {
          setUrls((prev) => ({ ...prev, [inserted.id]: signed.signedUrl }));
        }

        setPhotos((prev) => [...prev, inserted as RecordPhoto]);
        pos++;
      }

      // reset input
      if (inputRef.current) inputRef.current.value = "";
    } catch (err: any) {
      console.error("PHOTOS UPLOAD ERROR", {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
        raw: err,
      });
      alert("❌ Erreur lors de l'upload des photos.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (photo: RecordPhoto) => {
    if (!isAdmin) return;

    const ok = confirm("Supprimer cette photo ?");
    if (!ok) return;

    try {
      // 1) delete DB
      const { error: delErr } = await supabase
        .from("record_photos")
        .delete()
        .eq("id", photo.id);

      if (delErr) throw delErr;

      // 2) delete storage
      const { error: storErr } = await supabase.storage
        .from("record-photos")
        .remove([photo.path]);

      if (storErr) {
        // DB déjà supprimée => on log, mais on ne bloque pas l'UX
        console.error("PHOTO STORAGE REMOVE ERROR", storErr);
      }

      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      setUrls((prev) => {
        const next = { ...prev };
        delete next[photo.id];
        return next;
      });

      // si modal ouvert et on supprime l'image active, on ajuste l'index
      setActiveIndex((idx) => {
        const nextLen = sorted.length - 1;
        if (nextLen <= 0) return 0;
        return Math.min(idx, nextLen - 1);
      });
    } catch (err: any) {
      console.error("PHOTO DELETE ERROR", {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
        raw: err,
      });
      alert("❌ Erreur lors de la suppression.");
    }
  };

  const openModalAt = (index: number) => {
    setActiveIndex(index);
    setOpen(true);
  };

  const prev = () => setActiveIndex((i) => Math.max(0, i - 1));
  const next = () => setActiveIndex((i) => Math.min(sorted.length - 1, i + 1));

  if (loading) {
    return (
      <div style={boxStyle}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>📷 Photos</div>
        <p>Chargement…</p>
      </div>
    );
  }

  return (
    <div style={boxStyle}>
      <div style={headerStyle}>
        <div style={{ fontWeight: 800 }}>📷 Photos</div>

        {isAdmin && (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleUploadFiles(e.target.files)}
              style={{ display: "none" }}
            />

            <button
              type="button"
              onClick={openPicker}
              disabled={uploading}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                backgroundColor: uploading ? "#f3f4f6" : "#111827",
                color: uploading ? "#111827" : "#ffffff",
                cursor: uploading ? "not-allowed" : "pointer",
                fontWeight: 800,
              }}
            >
              {uploading ? "Upload…" : "➕ Ajouter des photos"}
            </button>
          </div>
        )}
      </div>

      {sorted.length === 0 ? (
        <p style={{ color: "#6b7280" }}>Aucune photo.</p>
      ) : (
        <div style={gridStyle}>
          {sorted.map((p, idx) => {
            const src = urls[p.id];
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => openModalAt(idx)}
                style={thumbBtnStyle}
                title={p.filename ?? "Photo"}
              >
                {src ? (
                  <img
                    src={src}
                    alt={p.filename ?? "photo"}
                    style={thumbImgStyle}
                  />
                ) : (
                  <div style={thumbPlaceholderStyle}>Image</div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* MODAL */}
      {open && activePhoto && (
        <div style={modalOverlayStyle} onClick={() => setOpen(false)}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalTopStyle}>
              <div style={{ fontWeight: 900 }}>
                {activePhoto.filename ?? "Photo"}
                <span style={{ marginLeft: 10, color: "#6b7280", fontWeight: 700 }}>
                  {activeIndex + 1}/{sorted.length}
                </span>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button type="button" onClick={() => setOpen(false)} style={iconBtn}>
                  ✕
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
              <button type="button" onClick={prev} disabled={activeIndex === 0} style={navBtn}>
                ←
              </button>

              <div style={imgWrapStyle}>
                {urls[activePhoto.id] ? (
                  <img
                    src={urls[activePhoto.id]}
                    alt={activePhoto.filename ?? "photo"}
                    style={modalImgStyle}
                  />
                ) : (
                  <div style={{ color: "#6b7280" }}>Image indisponible (URL expirée)</div>
                )}
              </div>

              <button
                type="button"
                onClick={next}
                disabled={activeIndex === sorted.length - 1}
                style={navBtn}
              >
                →
              </button>
            </div>

            {isAdmin && (
              <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => handleDelete(activePhoto)}
                  style={deleteBtn}
                >
                  🗑️ Supprimer
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* =======================
   Styles (inline, cohérent avec ta page)
======================= */
const boxStyle: React.CSSProperties = {
  marginTop: 24,
  padding: 16,
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  backgroundColor: "#ffffff",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
  gap: 10,
};

const thumbBtnStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  overflow: "hidden",
  padding: 0,
  backgroundColor: "#ffffff",
  cursor: "pointer",
  height: 120,
};

const thumbImgStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const thumbPlaceholderStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "grid",
  placeItems: "center",
  color: "#6b7280",
  fontWeight: 800,
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0,0,0,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 1000,
};

const modalCardStyle: React.CSSProperties = {
  width: "min(1000px, 96vw)",
  backgroundColor: "#ffffff",
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  padding: 14,
};

const modalTopStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 10,
};

const imgWrapStyle: React.CSSProperties = {
  flex: 1,
  minHeight: "60vh",
  display: "grid",
  placeItems: "center",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  backgroundColor: "#f9fafb",
  overflow: "hidden",
};

const modalImgStyle: React.CSSProperties = {
  maxWidth: "100%",
  maxHeight: "60vh",
  objectFit: "contain",
  display: "block",
};

const iconBtn: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  backgroundColor: "#ffffff",
  cursor: "pointer",
  fontWeight: 900,
};

const navBtn: React.CSSProperties = {
  width: 44,
  height: "60vh",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  backgroundColor: "#ffffff",
  cursor: "pointer",
  fontWeight: 900,
};

const deleteBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #fecaca",
  backgroundColor: "#fef2f2",
  cursor: "pointer",
  color: "#991b1b",
  fontWeight: 900,
};
