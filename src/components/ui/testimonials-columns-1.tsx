"use client";
import React from "react";
import { motion } from "framer-motion";
import { Star, ThumbsUp, ThumbsDown } from "lucide-react";

export interface ColumnTestimonial {
  text: string;
  image?: string;
  name: string;
  role: string;
  rating?: number | "thumbs_up" | "thumbs_down";
  source?: "testimonial" | "canvas";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || "?").toUpperCase();
}

export const TestimonialsColumn = (props: {
  className?: string;
  testimonials: ColumnTestimonial[];
  duration?: number;
}) => {
  if (props.testimonials.length === 0) return null;

  return (
    <div className={props.className}>
      <motion.div
        animate={{
          translateY: "-50%",
        }}
        transition={{
          duration: props.duration || 10,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
        className="flex flex-col gap-6 pb-6"
      >
        {[
          ...new Array(2).fill(0).map((_, index) => (
            <React.Fragment key={index}>
              {props.testimonials.map((t, i) => (
                <div
                  className="p-8 rounded-3xl bg-white/80 backdrop-blur-md border border-slate-200 max-w-xs w-full"
                  style={{ boxShadow: "0 4px 16px -4px rgba(15, 23, 42, 0.08)" }}
                  key={i}
                >
                  {/* Rating: stars for testimonials, thumbs for canvas reviews */}
                  {t.source === "testimonial" && typeof t.rating === "number" && (
                    <div className="flex gap-0.5 mb-3">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`h-3.5 w-3.5 ${
                            s <= (t.rating as number)
                              ? "fill-amber-400 text-amber-400"
                              : "fill-none text-slate-300"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                  {t.source === "canvas" && t.rating === "thumbs_up" && (
                    <div className="flex items-center gap-1.5 mb-3">
                      <ThumbsUp
                        className="h-3.5 w-3.5 text-emerald-500 fill-emerald-500"
                        strokeWidth={2.5}
                      />
                      <span className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider">
                        Liked it
                      </span>
                    </div>
                  )}
                  {t.source === "canvas" && t.rating === "thumbs_down" && (
                    <div className="flex items-center gap-1.5 mb-3">
                      <ThumbsDown className="h-3.5 w-3.5 text-slate-400" strokeWidth={2.5} />
                      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                        Constructive feedback
                      </span>
                    </div>
                  )}

                  {/* Quote */}
                  <p
                    className="text-sm text-slate-700 leading-relaxed italic"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  >
                    "{t.text}"
                  </p>

                  {/* User row */}
                  <div className="flex items-center gap-3 mt-5">
                    {t.image ? (
                      <img
                        width={40}
                        height={40}
                        src={t.image}
                        alt={t.name}
                        className="h-10 w-10 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {getInitials(t.name)}
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <div
                        className="font-semibold text-slate-900 text-sm tracking-tight leading-5 truncate"
                        style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-0.01em" }}
                      >
                        {t.name}
                      </div>
                      <div className="text-xs text-slate-500 leading-5 tracking-tight truncate">
                        {t.role}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </React.Fragment>
          )),
        ]}
      </motion.div>
    </div>
  );
};
