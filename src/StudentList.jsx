import React from 'react';
import { User, X, Hash } from 'lucide-react';

// Component to display the list of scanned students
function StudentList({ students, onRemove }) {
  // If the list is empty, show a placeholder message
  if (students.length === 0) {
    return (
      <div className="text-center text-slate-500 py-8">
        <p className="font-semibold">No students scanned yet.</p>
        <p className="text-sm">The list of students with empty cases will appear here.</p>
      </div>
    );
  }

  // Render the list of students
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold text-slate-800 border-b pb-2 mb-3">
        Scanned Students ({students.length})
      </h2>
      <ul className="divide-y divide-slate-200">
        {students.map((student, index) => (
          <li
            key={student.id}
            className="flex items-center justify-between p-3 transition-colors duration-200 hover:bg-slate-50 rounded-lg"
          >
            <div className="flex items-center gap-4">
              <span className="text-slate-400 font-mono text-sm">{index + 1}.</span>
              <div className="flex flex-col">
                <span className="font-bold text-slate-900 flex items-center gap-2">
                  <User size={16} className="text-blue-500" />
                  {student.fullName}
                </span>
                <span className="text-xs text-slate-500 flex items-center gap-2">
                  <Hash size={12} className="text-slate-400" />
                  Grade {student.grade}
                </span>
              </div>
            </div>
            <button
              onClick={() => onRemove(student.id)}
              title={`Remove ${student.fullName}`}
              className="p-2 text-slate-500 rounded-full hover:bg-red-100 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
            >
              <X size={18} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default StudentList;
