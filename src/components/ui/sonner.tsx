import { useTheme } from "next-themes";
import { Toaster as Sonner, toast as sonnerToast, ExternalToast } from "sonner";
import { toFriendlyError } from "@/lib/friendly-errors";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="bottom-center"
      className="toaster group"
      toastOptions={{
        style: {
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)',
          color: '#000000',
          padding: '16px',
          minWidth: '360px',
        },
        classNames: {
          toast: "group toast",
          description: "group-[.toast]:text-gray-500",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

/**
 * Wrapped toast that automatically maps error messages to user-friendly text.
 * All other toast methods (success, info, warning, custom, etc.) pass through unchanged.
 */
const toast = Object.assign(
  // Default toast() call — pass through
  (...args: Parameters<typeof sonnerToast>) => sonnerToast(...args),
  {
    // Wrap toast.error to apply friendly error mapping
    error: (message: string | React.ReactNode, data?: ExternalToast) => {
      const friendly = typeof message === 'string' ? toFriendlyError(message) : message;
      // Also sanitize the description if it's a raw error string
      const sanitizedData = data?.description && typeof data.description === 'string'
        ? { ...data, description: toFriendlyError(data.description) }
        : data;
      return sonnerToast.error(friendly, sanitizedData);
    },
    // Pass through all other toast methods unchanged
    success: sonnerToast.success,
    info: sonnerToast.info,
    warning: sonnerToast.warning,
    loading: sonnerToast.loading,
    message: sonnerToast.message,
    promise: sonnerToast.promise,
    custom: sonnerToast.custom,
    dismiss: sonnerToast.dismiss,
  }
);

export { Toaster, toast };
