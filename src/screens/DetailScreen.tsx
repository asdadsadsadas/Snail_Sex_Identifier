import { useState } from "react";
import { ArrowLeft, Edit2, Trash2, Camera, Check, X, Save } from "lucide-react";
import { SnailRecord, SnailGender, PregnantStatus } from "../types";
import { updateSnailLog, deleteSnailLog } from "../lib/firebase";
import { cn } from "../lib/utils";

interface DetailScreenProps {
  record: SnailRecord;
  onBack: () => void;
  onChanged: () => void;
}

export function DetailScreen({ record, onBack, onChanged }: DetailScreenProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Editable fields
  const [editGender, setEditGender] = useState<SnailGender>(record.gender);
  const [editStatus, setEditStatus] = useState<PregnantStatus>(record.pregnantStatus);

  // ── Save Edits ─────────────────────────────────────────────────

  const handleSaveEdits = async () => {
    if (editGender === record.gender && editStatus === record.pregnantStatus) {
      setIsEditing(false);
      return;
    }

    setSaving(true);
    try {
      await updateSnailLog(record.id, {
        gender: editGender,
        pregnantStatus: editStatus,
      });
      setIsEditing(false);
      onChanged();
    } catch (err) {
      console.error("Failed to update record:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditGender(record.gender);
    setEditStatus(record.pregnantStatus);
    setIsEditing(false);
  };

  // ── Delete ─────────────────────────────────────────────────────

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteSnailLog(record.id);
      onChanged();
    } catch (err) {
      console.error("Failed to delete record:", err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="w-full h-full bg-[#f8f9fa] overflow-y-auto pb-8 flex flex-col relative">
      {/* Header */}
      <header className="absolute top-0 z-50 flex items-center justify-between px-4 h-16 w-full text-white">
        <button
          onClick={onBack}
          className="bg-black/20 backdrop-blur-md hover:bg-black/30 transition-all p-2 rounded-full"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg font-semibold tracking-tight text-white drop-shadow-md">Scan Details</h1>
        <div className="w-10" />
      </header>

      <main className="w-full flex-grow flex flex-col">
        {/* Image */}
        <section className="relative w-full h-72 bg-gray-200 shrink-0">
          {record.imageUrl ? (
            <img
              src={record.imageUrl}
              alt="Snail shell detail"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-300 text-gray-500">
              <Camera size={64} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#f8f9fa] via-transparent to-black/30" />
        </section>

        {/* Content Card */}
        <section className="px-4 -mt-16 relative z-10">
          <div className="bg-white rounded-t-3xl p-6 shadow-sm border border-gray-100 border-b-0 min-h-[500px]">
            {/* Gender / Status / Confidence */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex flex-col gap-2">
                {isEditing ? (
                  <>
                    {/* Gender Edit */}
                    <div className="flex gap-2">
                      {(["Male", "Female"] as const).map((g) => (
                        <button
                          key={g}
                          onClick={() => setEditGender(g)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-all",
                            editGender === g
                              ? "bg-[#03615f] text-white"
                              : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                          )}
                        >
                          {g}
                        </button>
                      ))}
                    </div>

                    {/* Pregnancy Status Edit */}
                    <div className="flex gap-2">
                      {(["Pregnant", "Not Pregnant"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setEditStatus(s)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-all",
                            editStatus === s
                              ? "bg-[#527766] text-white"
                              : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                          )}
                        >
                          {s === "Pregnant" ? "Pregnant" : "Non-Pregnant"}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#c1ecd4] text-[#002114] w-fit">
                      <span className="text-xs font-semibold uppercase">{record.gender}</span>
                    </div>
                    {record.pregnantStatus === "Pregnant" ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#527766] text-white w-fit">
                        <span className="text-xs font-semibold uppercase">Pregnant</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-200 text-gray-700 w-fit">
                        <span className="text-xs font-semibold uppercase">Not Pregnant</span>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="text-right flex flex-col items-end">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">AI Confidence</span>
                <span className="text-3xl font-bold text-[#03615f]">{record.confidence}%</span>
              </div>
            </div>

            {/* Date */}
            <div className="pt-4 pb-2 border-t border-gray-100 flex items-center gap-2 text-gray-500 mb-6">
              <span className="text-sm font-medium">{record.date}</span>
            </div>

            {/* Morphological Notes */}
            {record.morphologicalNotes && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Morphological Notes</h2>
                <p className="text-sm text-gray-600 bg-[#f8f9fa] rounded-xl p-4 border border-gray-100 leading-relaxed">
                  {record.morphologicalNotes}
                </p>
              </div>
            )}

            {/* Morphological Data */}
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Morphological Data</h2>
            <div className="grid grid-cols-2 gap-3 mb-8">
              <div className="bg-[#f8f9fa] rounded-xl p-4 border border-gray-100 flex flex-col justify-between h-24">
                <span className="text-xs font-medium text-gray-500 mb-1">Shell Length</span>
                <div className="flex items-baseline gap-1 text-[#2d7a78]">
                  <span className="text-2xl font-bold">{record.shellLength ?? "--"}</span>
                  <span className="text-sm">mm</span>
                </div>
              </div>

              <div className="bg-[#f8f9fa] rounded-xl p-4 border border-gray-100 flex flex-col justify-between h-24">
                <span className="text-xs font-medium text-gray-500 mb-1">Shell Width</span>
                <div className="flex items-baseline gap-1 text-[#2d7a78]">
                  <span className="text-2xl font-bold">{record.shellWidth ?? "--"}</span>
                  <span className="text-sm">mm</span>
                </div>
              </div>

              <div className="bg-[#f8f9fa] rounded-xl p-4 border border-gray-100 flex flex-col justify-between h-24">
                <span className="text-xs font-medium text-gray-500 mb-1">Operculum</span>
                <span className="text-sm font-semibold text-gray-900 leading-tight">
                  {record.operculum || "Unknown"}
                </span>
              </div>

              <div className="bg-[#f8f9fa] rounded-xl p-4 border border-gray-100 flex flex-col justify-between h-24">
                <span className="text-xs font-medium text-gray-500 mb-1">Tentacles</span>
                <span className="text-sm font-semibold text-gray-900 leading-tight">
                  {record.tentacles || "Unknown"}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              {isEditing ? (
                <div className="flex gap-3">
                  <button
                    onClick={handleCancelEdit}
                    className="flex-1 h-12 rounded-full text-sm font-semibold text-gray-600 flex items-center justify-center gap-2 border border-gray-300 hover:bg-gray-50 active:scale-95 transition-all"
                  >
                    <X size={18} />
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdits}
                    disabled={saving}
                    className="flex-[2] h-12 rounded-full text-sm font-semibold text-white flex items-center justify-center gap-2 bg-[#2d7a78] hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 shadow-sm"
                  >
                    {saving ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={18} />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-full bg-[#2d7a78] text-white h-12 rounded-full text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-sm"
                >
                  <Edit2 size={18} />
                  Edit Entry
                </button>
              )}

              {/* Delete */}
              {showDeleteConfirm ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 h-12 rounded-full text-sm font-semibold text-gray-600 flex items-center justify-center gap-2 border border-gray-300 hover:bg-gray-50 active:scale-95 transition-all"
                  >
                    <X size={18} />
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-[2] h-12 rounded-full text-sm font-semibold text-white flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {deleting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 size={18} />
                        Confirm Delete
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full h-12 rounded-full text-sm font-semibold text-[#ba1a1a] flex items-center justify-center gap-2 hover:bg-[#ffdad6]/50 active:scale-95 transition-all"
                >
                  <Trash2 size={18} />
                  Delete Record
                </button>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
