"use client";

interface ToastProps {
  message: string;
  type: "success" | "error";
  onClose?: () => void;
}

export function Toast({ message, type }: ToastProps) {
  return (
    <div className="fixed bottom-24 right-6 z-50 animate-fade-in">
      <div
        className={`glass-card rounded-xl px-4 py-3 flex items-center gap-3 border ${
          type === "success"
            ? "border-emerald-500/30 bg-emerald-500/10"
            : "border-red-500/30 bg-red-500/10"
        }`}
      >
        {type === "success" ? (
          <svg
            className="w-5 h-5 text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        ) : (
          <svg
            className="w-5 h-5 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        )}
        <span
          className={`text-sm font-medium ${
            type === "success" ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {message}
        </span>
      </div>
    </div>
  );
}

// IM module specific icon variants
export function ToastWithIcon({
  message,
  type,
  icon,
}: ToastProps & { icon?: React.ReactNode }) {
  return (
    <div className="fixed bottom-24 right-6 z-50 animate-fade-in">
      <div
        className={`glass-card rounded-xl px-4 py-3 flex items-center gap-3 border ${
          type === "success"
            ? "border-emerald-500/30 bg-emerald-500/10"
            : "border-red-500/30 bg-red-500/10"
        }`}
      >
        {icon || (
          type === "success" ? (
            <svg
              className="w-5 h-5 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          )
        )}
        <span
          className={`text-sm font-medium ${
            type === "success" ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {message}
        </span>
      </div>
    </div>
  );
}
