export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface CustomToastProps {
  message: string;
  type: ToastType;
  testId: string;
}

const emojis: Record<ToastType, string> = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
  warning: '⚠️',
};

export function CustomToast({ message, type, testId }: CustomToastProps) {
  return (
    <div
      data-testid={testId}
      className="flex items-start gap-3 min-w-[360px] max-w-[420px]"
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)',
        color: '#000000',
        padding: '16px',
        borderRadius: '8px',
      }}
    >
      <span className="text-xl flex-shrink-0">{emojis[type]}</span>
      <p className="text-sm font-bold text-gray-900 leading-snug flex-1">{message}</p>
    </div>
  );
}
