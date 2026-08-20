export function Modal({ title, children, onClose, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div
        className={`bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-auto ${
          wide ? 'w-full max-w-3xl' : 'w-full max-w-xl'
        }`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          {onClose && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">
              ×
            </button>
          )}
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
