import React from 'react';
import { User, X, Hash, Smartphone, Clock } from 'lucide-react';

// Component to display the list of unaccounted (empty-slot) students
function StudentList({ students, onRemove, onToggleLate }) {
  if (students.length === 0) {
    return (
      <div className="text-center text-slate-500 py-8">
        <p className="font-semibold">No empty slots recorded yet.</p>
        <p className="text-sm">Type a slot (e.g., A12) and click “Add Slot”.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold text-slate-800 border-b pb-2 mb-3">
        Not Accounted For ({students.length})
      </h2>
      <ul className="divide-y divide-slate-200">
        {students.map((s, index) => (
          <li
            key={s.id}
            className="flex items-center justify-between p-3 transition-colors duration-200 hover:bg-slate-50 rounded-lg"
          >
            <div className="flex items-center gap-4">
              <span className="text-slate-400 font-mono text-sm">{index + 1}.</span>

              <div className="flex flex-col">
                <span className="font-bold text-slate-900 flex items-center gap-2">
                  <User size={16} className="text-blue-500" />
                  {s.fullName || '(Unassigned slot)'}
                </span>

                <div className="text-xs text-slate-600 flex items-center gap-4 flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <Smartphone size={12} className="text-slate-400" />
                    <span className="font-mono">Slot {s.slotId}</span>
                  </span>
                  {s.grade ? (
                    <span className="inline-flex items-center gap-1">
                      <Hash size={12} className="text-slate-400" />
                      Grade {s.grade}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Late toggle */}
              <label
                className="text-sm flex items-center gap-2 select-none cursor-pointer"
                title="Mark late drop-off"
              >
                <input
                  type="checkbox"
                  checked={s.status === 'late'}
                  onChange={() => onToggleLate(s.id)}
                />
                <span className={`inline-flex items-center gap-1 ${s.status === 'late' ? 'text-amber-700' : 'text-slate-600'}`}>
                  <Clock size={14} />
                  Late
                </span>
              </label>

              {/* Remove */}
              <button
                onClick={() => onRemove(s.id)}
                title={`Remove ${s.fullName || s.slotId}`}
                className="p-2 text-slate-500 rounded-full hover:bg-red-100 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
              >
                <X size={18} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default StudentList;
