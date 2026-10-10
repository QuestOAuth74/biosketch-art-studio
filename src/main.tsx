import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { loadAllFonts } from "@/lib/fontLoader";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { PostHogProvider } from "@posthog/react";

// Load fonts as early as possible
loadAllFonts();

const posthogOptions = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
} as const;

createRoot(document.getElementById("root")!).render(
  <PostHogProvider
    apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN}
    options={posthogOptions}
  >
    <OnboardingProvider>
      <App />
    </OnboardingProvider>
  </PostHogProvider>
);
