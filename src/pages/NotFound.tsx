import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Bot, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const BIOSKETCH_LOGO =
  "https://tljsbmpglwmzyaoxsqyj.supabase.co/storage/v1/object/sign/icon%20site/biosketch%20art-min.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zOWUxYTMwMi1lYjJkLTQxOGUtYjdkZS1hZGE0M2NhNTI0NDUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpY29uIHNpdGUvYmlvc2tldGNoIGFydC1taW4ucG5nIiwiaWF0IjoxNzYwODM2MjgxLCJleHAiOjIwNzYxOTYyODF9.LDw-xwHK6WmdeLwiG_BwtT0jX3N6fjdOvZmoUcI4FP0";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{
        background:
          "linear-gradient(180deg, #FAF9F5 0%, #F5F4EE 50%, #FAF9F5 100%)",
      }}
    >
      <div className="max-w-2xl w-full text-center">
        {/* Icon pair — BioSketch logo meets a friendly android */}
        <div className="flex items-center justify-center gap-6 md:gap-10 mb-10">
          <div className="relative">
            <div className="pointer-events-none absolute -inset-3 rounded-full bg-primary/15 blur-2xl" />
            <img
              src={BIOSKETCH_LOGO}
              alt="BioSketch"
              className="relative h-24 w-24 md:h-32 md:w-32 object-contain drop-shadow-md"
            />
          </div>
          <div className="text-4xl md:text-5xl font-bold text-muted-foreground/50 select-none">
            +
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute -inset-3 rounded-full bg-rose-300/30 blur-2xl" />
            <div className="relative h-24 w-24 md:h-32 md:w-32 rounded-full bg-white border border-border shadow-md flex items-center justify-center">
              <Bot className="h-14 w-14 md:h-16 md:w-16 text-rose-500" strokeWidth={1.5} />
            </div>
          </div>
        </div>

        {/* Headline */}
        <h1
          className="text-5xl md:text-6xl font-bold text-foreground leading-tight tracking-tight mb-4"
          style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-0.03em" }}
        >
          You are now on{" "}
          <span className="italic font-crimson text-primary">Mars</span>.
        </h1>

        <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-md mx-auto mb-10">
          The page you were looking for drifted off into deep space. Let's get
          you back to Earth.
        </p>

        {/* CTA */}
        <Button
          onClick={() => navigate("/")}
          size="lg"
          className="gap-2 shadow-md hover:shadow-lg transition-shadow"
        >
          <ArrowLeft className="h-4 w-4" />
          Go back to home page
        </Button>

        {/* Bad path — tiny + muted */}
        <p className="mt-10 text-xs text-muted-foreground/60 font-mono truncate">
          {location.pathname}
        </p>
      </div>
    </div>
  );
};

export default NotFound;
