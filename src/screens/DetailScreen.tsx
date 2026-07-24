import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Shell,
  Venus,
  Mars,
  Baby,
  Edit3,
  Trash2,
  Save,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  getSnailLogById,
  updateSnailLog,
  deleteSnailLog,
  type SnailLog,
} from "../lib/firebase";
import { formatDate, formatConfidence, cn } from "../lib/utils";
import type { SnailGender, PregnantStatus } from "../types";

interface DetailScreenProps {
  params: { id: string };
  onNavigate: (screen: string) => void;
}

export function DetailScreen({ params, onNavigate }: DetailScreenProps) {
  const [log, setLog] = useState<SnailLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editGender, setEditGender] = useState<SnailGender>("Male");
  const [editPregnancy, setEditPregnancy] = useState<PregnantStatus>("Not Pregnant");
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getSnailLogById(params.id);
        if (data) {
          setLog(data);
          setEditGender(data.gender);
          setEditPregnancy(data.pregnantStatus);
        } else {
          setError("Record not found");
        }
      } catch (err) {
        setError("Failed to load record");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  const startEditing = () => {
    if (!log) return;
    setEditGender(log.gender);
    setEditPregnancy(log.pregnantStatus);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
  };

  const saveChanges = async () => {
    if (!log) return;
    setSaving(true);
    setError(null);
    try {
      await updateSnailLog(log.id, {
        gender: editGender,
        pregnantStatus: editPregnancy,
      });
      setLog({
        ...log,
        gender: editGender,
        pregnantStatus: editPregnancy,
      });
      setEditing(false);
    } catch (err) {
      setError("Failed to save changes");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!log) return;
    setDeleting(true);
    try {
      await deleteSnailLog(log.id);
      setDeleted(true);
    } catch (err) {
      setError("Failed to delete record");
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-[#03615f] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (deleted) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#f8f9fa] px-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <CheckCircle2 size={48} className="text-green-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Record Deleted</h2>
          <p className="text-gray-500 text-sm mb-6">
            The record has been permanently removed.
          </p>
          <button
            onClick={() => onNavigate("history")}
            className="py-3 px-6 rounded-2xl bg-[#03615f] text-white font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all"
          >
            Back to History
          </button>
        </motion.div>
      </div>
    );
  }

  if (!log) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#f8f9fa] px-6">
        <AlertTriangle size={48} className="text-amber-700 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Not Found</h2>
        <p className="text-gray-500 text-sm mb-6">{error || "Record not found"}</p>
        <button
          onClick={() => onNavigate("history")}
          className="py-3 px-6 rounded-2xl bg-[#03615f] text-white font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all"
        >
          Back to History
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] overflow-y-auto pb-24">
      {/* Header */}
      <div className="relative">
        {/* Photo */}
        <div className="h-64 bg-gray-200 relative overflow-hidden">
          {log.photoUrl ? (
            <img
              src={log.photoUrl}
              alt="Snail"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Shell size={64} className="text-gray-400" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>

        {/* Back button */}
        <button
          onClick={() => onNavigate("history")}
          className="absolute top-6 left-4 w-10 h-10 rounded-xl bg-white/90 flex items-center justify-center hover:bg-white active:scale-90 transition-all"
        >
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
      </div>

      {/* Content */}
      <div className="-mt-16 relative z-10 px-6">
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100"
        >
          {/* Main info */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {log.gender === "Male" ? (
                <div className="w-12 h-12 rounded-2xl bg-[#beead1] flex items-center justify-center">
                  <Mars size={24} className="text-[#3f6653]" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-[#ffdad6] flex items-center justify-center">
                  <Venus size={24} className="text-[#ba1a1a]" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900">
                    {log.gender}
                  </h2>
                  <span
                    className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full",
                      log.gender === "Male"
                        ? "bg-[#beead1] text-[#3f6653]"
                        : "bg-[#ffdad6] text-[#ba1a1a]"
                    )}
                  >
                    {log.pregnantStatus}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatDate(log.date)}
                </p>
              </div>
            </div>
            {!editing && (
              <button
                onClick={startEditing}
                className="w-10 h-10 rounded-xl bg-[#c0fffc] flex items-center justify-center hover:opacity-80 active:scale-90 transition-all"
              >
                <Edit3 size={18} className="text-[#03615f]" />
              </button>
            )}
          </div>

          {/* Confidence */}
          <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 rounded-xl">
            <div className="w-8 h-8 rounded-lg bg-[#c0fffc] flex items-center justify-center">
              <span className="text-sm font-bold text-[#03615f]">AI</span>
            </div>
            <div>
              <p className="text-xs text-gray-400">Confidence Score</p>
              <p className="text-sm font-bold text-gray-900">
                {formatConfidence(log.confidence)}
              </p>
            </div>
          </div>

          {/* Morphological notes */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Morphological Notes
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              {log.morphologicalNotes || "No notes recorded."}
            </p>
          </div>

          {/* Editing controls */}
          {editing && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              className="border-t border-gray-100 pt-4 mb-4"
            >
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Edit Classification
              </h3>
              <div className="space-y-3">
                {/* Gender selector */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-2 block">
                    Sex
                  </label>
                  <div className="flex gap-2">
                    {(["Male", "Female"] as SnailGender[]).map((g) => (
                      <button
                        key={g}
                        onClick={() => setEditGender(g)}
                        className={cn(
                          "flex-1 py-2.5 rounded-xl text-sm font-medium transition-all",
                          editGender === g
                            ? g === "Male"
                              ? "bg-[#beead1] text-[#3f6653]"
                              : "bg-[#ffdad6] text-[#ba1a1a]"
                            : "bg-gray-100 text-gray-500"
                        )}
                      >
                        {g === "Male" ? (
                          <span className="flex items-center justify-center gap-1.5">
                            <Mars size={16} /> Male
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-1.5">
                            <Venus size={16} /> Female
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Pregnancy selector */}
                {editGender === "Female" && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-2 block">
                      Pregnancy Status
                    </label>
                    <div className="flex gap-2">
                      {(["Pregnant", "Not Pregnant"] as PregnantStatus[]).map(
                        (p) => (
                          <button
                            key={p}
                            onClick={() => setEditPregnancy(p)}
                            className={cn(
                              "flex-1 py-2.5 rounded-xl text-sm font-medium transition-all",
                              editPregnancy === p
                                ? "bg-[#c1ecd4] text-[#274e3d]"
                                : "bg-gray-100 text-gray-500"
                            )}
                          >
                            {p === "Pregnant" && <Baby size={14} className="inline mr-1" />}
                            {p}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )}
                {editGender === "Male" && (
                  <p className="text-xs text-gray-400 italic">
                    Pregnancy status only applies to female snails.
                  </p>
                )}

                {/* Save / Cancel */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={saveChanges}
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-xl bg-[#03615f] text-white font-medium text-sm flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    Save
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="py-2.5 px-4 rounded-xl bg-gray-100 text-gray-600 font-medium text-sm hover:bg-gray-200 active:scale-[0.98] transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 rounded-xl px-3 py-2 mb-4">
              <AlertTriangle size={14} />
              {error}
            </div>
          )}

          {/* Delete button */}
          {!editing && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-3 rounded-xl border border-red-200 text-red-600 font-medium text-sm flex items-center justify-center gap-2 hover:bg-red-50 active:scale-[0.98] transition-all"
            >
              <Trash2 size={16} />
              Delete Record
            </button>
          )}
        </motion.div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl"
          >
            <div className="text-center mb-4">
              <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-3">
                <Trash2 size={28} className="text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                Delete Record?
              </h3>
              <p className="text-sm text-gray-500">
                This will permanently delete this snail record. This action
                cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Trash2 size={18} />
                )}
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-600 font-semibold text-sm hover:bg-gray-200 active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
