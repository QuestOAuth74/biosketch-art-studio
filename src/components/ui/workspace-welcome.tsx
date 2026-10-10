import * as React from "react";
import { motion } from "framer-motion";
import { PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface ActionItem {
  icon: React.ReactNode;
  label: string;
  isBeta?: boolean;
  onClick?: () => void;
  buttonProps?: ButtonProps;
}

export interface WorkspaceWelcomeProps {
  title: string;
  subtitle?: string;
  videoThumbnail: string;
  videoTitle: string;
  videoDescription: string;
  actions: ActionItem[];
  onPlayVideo?: () => void;
  className?: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 12,
    },
  },
};

export const WorkspaceWelcome = React.forwardRef<HTMLDivElement, WorkspaceWelcomeProps>(
  (
    {
      title,
      subtitle,
      videoThumbnail,
      videoTitle,
      videoDescription,
      actions,
      onPlayVideo,
      className,
    },
    ref
  ) => {
    return (
      <motion.div
        ref={ref}
        className={cn(
          "flex w-full flex-col items-center gap-8 rounded-lg p-4",
          className
        )}
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        {/* Header */}
        <motion.div className="text-center space-y-3" variants={itemVariants}>
          <h2 className="text-2xl md:text-3xl font-serif font-semibold text-foreground tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
              {subtitle}
            </p>
          )}
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          className="flex flex-wrap items-center justify-center gap-3"
          variants={itemVariants}
        >
          {actions.map((action, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 border-dashed transition-all duration-200 active:scale-[0.98]"
              onClick={action.onClick}
              {...action.buttonProps}
            >
              {action.icon}
              <span className="font-medium">{action.label}</span>
              {action.isBeta && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                  BETA
                </Badge>
              )}
            </Button>
          ))}
        </motion.div>

        {/* Video Card */}
        <motion.div
          className="relative w-full max-w-4xl rounded-2xl p-[3px]"
          variants={itemVariants}
          style={{
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6, #06b6d4, #8b5cf6, #3b82f6)",
            backgroundSize: "300% 300%",
            animation: "gradient-shift 4s ease infinite",
          }}
        >
          <style>{`
            @keyframes gradient-shift {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
          `}</style>
          <div className="relative w-full overflow-hidden rounded-[13px] bg-black shadow-2xl shadow-primary/20">
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src="https://www.youtube.com/embed/rETbE0cX0e8?autoplay=1&mute=1&loop=1&playlist=rETbE0cX0e8&rel=0&enablejsapi=1"
                title={videoTitle}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <div className="px-5 py-4 bg-gradient-to-t from-black/90 to-black/60">
              <h3 className="text-base font-semibold text-white">{videoTitle}</h3>
              <p className="text-sm text-white/70">{videoDescription}</p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  }
);

WorkspaceWelcome.displayName = "WorkspaceWelcome";
