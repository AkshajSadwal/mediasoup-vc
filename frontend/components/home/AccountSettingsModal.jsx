"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X, UserRound, Save } from "lucide-react";
import { useSession } from "next-auth/react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export default function AccountSettingsModal({ session, onClose }) {
  const { update } = useSession();
  const [displayName, setDisplayName] = useState(session?.user?.displayName || session?.user?.name || session?.user?.username || "");
  const [preview, setPreview] = useState(session?.user?.image || "");
  const [avatarDataUrl, setAvatarDataUrl] = useState(undefined);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const resolveImage = (value) => !value ? "" : value.startsWith("http") || value.startsWith("data:") ? value : `${BACKEND_URL}${value}`;

  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape" && !saving) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const chooseImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError("Choose a PNG or JPG image.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarDataUrl(String(reader.result));
      setPreview(String(reader.result));
    };
    reader.onerror = () => setError("Could not read that image. Try another file.");
    reader.readAsDataURL(file);
  };

  const save = async (event) => {
    event.preventDefault();
    setError("");
    const cleanName = displayName.trim();
    if (!cleanName || cleanName.length > 40) {
      setError("Display name must be between 1 and 40 characters.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.backendToken || ""}`,
        },
        body: JSON.stringify({
          displayName: cleanName,
          ...(avatarDataUrl !== undefined ? { avatarDataUrl } : {}),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save account settings.");
      await update();
      onClose();
    } catch (err) {
      setError(err.message || "Could not save account settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0f1b2d]/35 px-4 py-6 backdrop-blur-[5px]" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="account-settings-title" className="w-full max-w-lg rounded-[26px] border border-[#e1eaf5] bg-white p-6 shadow-[0_28px_90px_rgba(15,35,65,0.24)] sm:p-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#176df3]">Your profile</p>
            <h2 id="account-settings-title" className="mt-1 text-2xl font-bold text-[#111827]">Account settings</h2>
            <p className="mt-1 text-sm text-[#64748b]">Manage how you appear across Rauma.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close account settings" className="rounded-full p-2 text-[#64748b] hover:bg-[#f1f6fc]"><X size={19}/></button>
        </div>

        <form onSubmit={save} className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border border-[#dce7f5] bg-[#eaf2ff] text-[#176df3]">
              {preview ? <img src={resolveImage(preview)} alt="Profile preview" className="h-full w-full object-cover"/> : <UserRound size={32}/>}
            </div>
            <div>
              <p className="font-semibold text-[#172033]">Profile picture</p>
              <p className="mt-1 text-xs text-[#718096]">PNG or JPG · Maximum 5 MB</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-[#d7e3f2] bg-[#f7faff] px-3 py-2 text-sm font-semibold text-[#24518e] hover:bg-[#edf4ff]"><Camera size={15}/> Upload image</button>
                {preview && <button type="button" onClick={() => { setPreview(""); setAvatarDataUrl(null); if (fileRef.current) fileRef.current.value = ""; }} className="rounded-xl px-3 py-2 text-sm font-medium text-[#64748b] hover:bg-[#f5f7fa]">Remove</button>}
              </div>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,.jpg,.jpeg" onChange={chooseImage} className="hidden"/>
            </div>
          </div>

          <div>
            <label htmlFor="rauma-display-name" className="mb-2 block text-sm font-semibold text-[#263449]">Display name</label>
            <input id="rauma-display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={40} autoComplete="nickname" className="w-full rounded-xl border border-[#dce5f0] bg-[#f8fbff] px-4 py-3 text-[#172033] outline-none focus:border-[#176df3] focus:ring-2 focus:ring-[#176df3]/15"/>
            <p className="mt-1.5 text-xs text-[#8794a6]">This name is visible to other meeting participants.</p>
          </div>

          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          <div className="flex justify-end gap-3 border-t border-[#edf1f6] pt-5">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-[#dce5f0] bg-white px-4 py-2.5 text-sm font-semibold text-[#526176] hover:bg-[#f8fafc]">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#176df3] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(23,109,243,0.2)] hover:bg-[#0f63e8] disabled:opacity-60"><Save size={16}/>{saving ? "Saving..." : "Save changes"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
