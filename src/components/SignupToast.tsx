import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { LastSignup } from "@/hooks/useRecentSignups";

const STORAGE_KEY = "biosketch_signup_toast_last_shown";
const DISMISS_KEY = "biosketch_signup_toast_dismissed";
const DISMISS_DURATION = 24 * 60 * 60 * 1000;

const getCountryFlag = (countryName: string): string => {
  const flagMap: Record<string, string> = {
    'United States': '🇺🇸', 'United Kingdom': '🇬🇧', 'Canada': '🇨🇦',
    'Australia': '🇦🇺', 'Germany': '🇩🇪', 'France': '🇫🇷',
    'India': '🇮🇳', 'Brazil': '🇧🇷', 'Japan': '🇯🇵',
    'China': '🇨🇳', 'Spain': '🇪🇸', 'Italy': '🇮🇹',
    'Netherlands': '🇳🇱', 'Sweden': '🇸🇪', 'Norway': '🇳🇴',
    'Denmark': '🇩🇰', 'Finland': '🇫🇮', 'Poland': '🇵🇱',
    'Mexico': '🇲🇽', 'Argentina': '🇦🇷', 'Chile': '🇨🇱',
    'South Korea': '🇰🇷', 'Singapore': '🇸🇬', 'Switzerland': '🇨🇭',
    'Belgium': '🇧🇪', 'Austria': '🇦🇹', 'Portugal': '🇵🇹',
    'Ireland': '🇮🇪', 'New Zealand': '🇳🇿', 'South Africa': '🇿🇦',
    'Nigeria': '🇳🇬', 'Kenya': '🇰🇪', 'Egypt': '🇪🇬',
    'Turkey': '🇹🇷', 'Russia': '🇷🇺', 'Colombia': '🇨🇴',
    'Thailand': '🇹🇭', 'Philippines': '🇵🇭', 'Indonesia': '🇮🇩',
    'Malaysia': '🇲🇾', 'Pakistan': '🇵🇰', 'Bangladesh': '🇧🇩',
    'Taiwan': '🇹🇼', 'Israel': '🇮🇱', 'Saudi Arabia': '🇸🇦',
    'UAE': '🇦🇪', 'Greece': '🇬🇷', 'Czech Republic': '🇨🇿',
    'Romania': '🇷🇴', 'Hungary': '🇭🇺', 'Peru': '🇵🇪',
  };
  return flagMap[countryName] || '🌍';
};

const timeAgo = (dateStr: string): string => {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

interface SignupToastProps {
  signup: LastSignup;
}

export const SignupToast = ({ signup }: SignupToastProps) => {
  const [hasShown, setHasShown] = useState(false);
  const toastIdRef = useRef<string | number | undefined>();

  const isDismissedFor24Hours = () => {
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (!dismissed) return false;
      const dismissedTime = parseInt(dismissed);
      return (Date.now() - dismissedTime) < DISMISS_DURATION;
    } catch {
      return false;
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current);
    }
  };

  const renderToastContent = () => {
    const country = signup.country || "somewhere";
    const field = signup.field_of_study;
    const time = signup.created_at ? timeAgo(signup.created_at) : "recently";
    const flag = signup.country ? getCountryFlag(signup.country) : '🌍';

    return (
      <div className="relative w-full">
        <div className="flex items-start gap-3">
          <span className="text-3xl flex-shrink-0">{flag}</span>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-gray-900 leading-snug">
              Someone from {country}
              {field && <span className="text-blue-700"> ({field})</span>}
              {" "}signed up {time}
            </p>
            <p className="text-xs text-gray-500 mt-1.5">Welcome to BioSketch! 😊🎉</p>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (hasShown) return;
    if (!signup.created_at) return;
    if (isDismissedFor24Hours()) return;

    // Only show if the signup is within the last 24 hours
    const signupTime = new Date(signup.created_at).getTime();
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    if (signupTime < twentyFourHoursAgo) return;

    // Check if we already showed this exact signup
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const { created_at } = JSON.parse(stored);
        if (created_at === signup.created_at) return;
      }
    } catch { /* ignore */ }

    const timer = setTimeout(() => {
      const id = toast(renderToastContent(), {
        duration: 15000,
        position: "bottom-center",
        className: "professional-signup-toast",
        style: {
          background: "#FFFFFF",
          border: "1px solid #E5E7EB",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)",
          color: "#000000",
          minWidth: "360px",
          padding: "16px",
        },
      });
      toastIdRef.current = id;

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ created_at: signup.created_at, timestamp: Date.now() })
      );
      setHasShown(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, [signup, hasShown]);

  return null;
};
