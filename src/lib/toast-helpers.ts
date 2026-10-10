import { toast } from 'sonner';
import { CustomToast, ToastType } from '@/components/ui/custom-toast';
import { toFriendlyError } from '@/lib/friendly-errors';

export interface ToastOptions {
  duration?: number;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
}

/**
 * Base function to show a custom toast with test ID
 */
function showToast(message: string, type: ToastType, testId: string, options?: ToastOptions) {
  return toast.custom(
    () => CustomToast({ message, type, testId }),
    {
      duration: options?.duration,
      position: options?.position,
    }
  );
}

/**
 * Show a success toast notification
 * @param message - The message to display
 * @param testId - The test ID for the toast element
 * @param options - Optional toast configuration
 */
export function showSuccessToast(message: string, testId: string, options?: ToastOptions) {
  return showToast(message, 'success', testId, options);
}

/**
 * Show an error toast notification
 * @param message - The message to display
 * @param testId - The test ID for the toast element
 * @param options - Optional toast configuration
 */
export function showErrorToast(message: string, testId: string, options?: ToastOptions) {
  return showToast(toFriendlyError(message), 'error', testId, options);
}

/**
 * Show an info toast notification
 * @param message - The message to display
 * @param testId - The test ID for the toast element
 * @param options - Optional toast configuration
 */
export function showInfoToast(message: string, testId: string, options?: ToastOptions) {
  return showToast(message, 'info', testId, options);
}

/**
 * Show a warning toast notification
 * @param message - The message to display
 * @param testId - The test ID for the toast element
 * @param options - Optional toast configuration
 */
export function showWarningToast(message: string, testId: string, options?: ToastOptions) {
  return showToast(message, 'warning', testId, options);
}
