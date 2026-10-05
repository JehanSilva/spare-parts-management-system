import React from "react";
import { AlertTriangle } from "lucide-react";

// Leaving with unsaved work is the one thing that can lose a document outright,
// so it asks rather than warns — and offers to do the save itself.
const LeavePrompt = ({ open, saving, onSave, onDiscard, onStay, itemLabel = "document" }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b border-amber-100 bg-amber-50 flex items-center gap-3">
          <div className="p-2 rounded-full bg-amber-100 text-amber-600">
            <AlertTriangle size={22} />
          </div>
          <h3 className="font-bold text-gray-900">Unsaved changes</h3>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-gray-600">
            This {itemLabel} has changes that haven&rsquo;t been saved. Leaving now discards them.
          </p>
        </div>
        <div className="px-6 pb-6 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={onStay}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-white border border-red-200 text-red-600 hover:bg-red-50"
          >
            Discard changes
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-gray-900 text-white hover:bg-black disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save and leave"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeavePrompt;
