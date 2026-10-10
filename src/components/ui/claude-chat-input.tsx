"use client";
import React, { useState, useRef, useEffect } from "react";
import { Plus, ChevronDown, ArrowUp, X, Loader2, Check, Archive } from "lucide-react";

export interface ClaudeChatMode {
  id: string;
  name: string;
  description: string;
  icon?: React.ReactNode;
}

export interface ClaudeChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onPaste?: (e: React.ClipboardEvent) => void;

  placeholder?: string;
  isGenerating?: boolean;
  disabled?: boolean;

  // Mode selector
  modes?: ClaudeChatMode[];
  selectedModeId?: string;
  onModeChange?: (id: string) => void;

  // Image attachment
  acceptsImage?: boolean;
  uploadedImage?: string | null;
  onImageFile?: (file: File) => void;
  onImageRemove?: () => void;

  // Validation hint (e.g., "needs image")
  hint?: string;

  // Optional slot rendered in the action bar, just left of the Send button.
  // Used by the parent to inject mode-specific controls (e.g. icon style picker).
  rightSlot?: React.ReactNode;
}

export const ClaudeChatInput: React.FC<ClaudeChatInputProps> = ({
  value,
  onChange,
  onSend,
  onPaste,
  placeholder,
  isGenerating = false,
  disabled = false,
  modes,
  selectedModeId,
  onModeChange,
  acceptsImage = false,
  uploadedImage = null,
  onImageFile,
  onImageRemove,
  hint,
  rightSlot,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 384) + "px";
    }
  }, [value]);

  // Click outside closes mode menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModeMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImageFile) onImageFile(file);
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (acceptsImage) setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && onImageFile && acceptsImage) onImageFile(file);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && (value.trim() || uploadedImage)) onSend();
    }
  };

  const hasContent = value.trim().length > 0 || !!uploadedImage;
  const selectedMode = modes?.find((m) => m.id === selectedModeId);

  return (
    <div
      className="relative w-full max-w-2xl mx-auto font-sans"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Main container */}
      <div
        className="flex flex-col items-stretch rounded-2xl cursor-text border border-slate-200 bg-white transition-shadow"
        style={{
          boxShadow: "0 1px 2px -1px rgba(0,0,0,0.06), 0 4px 12px -2px rgba(0,0,0,0.04)",
        }}
      >
        <div className="flex flex-col px-3 pt-3 pb-2 gap-2">
          {/* Attached image preview */}
          {uploadedImage && (
            <div className="flex gap-3 px-1 pb-1">
              <div className="relative group flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                <img
                  src={uploadedImage}
                  alt="attached"
                  className="w-full h-full object-cover"
                />
                {onImageRemove && (
                  <button
                    onClick={onImageRemove}
                    className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                    type="button"
                    aria-label="Remove image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Textarea */}
          <div className="relative mb-1">
            <div className="max-h-96 w-full overflow-y-auto break-words min-h-[2.5rem] pl-1">
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onPaste={onPaste}
                onKeyDown={handleKeyDown}
                placeholder={placeholder || "How can I help you today?"}
                className="w-full bg-transparent border-0 outline-none text-slate-900 text-[16px] placeholder:text-slate-400 resize-none overflow-hidden py-0 leading-relaxed block font-normal"
                rows={1}
                style={{ minHeight: "1.5em", fontFamily: "Inter, sans-serif" }}
              />
            </div>
          </div>

          {/* Action bar */}
          <div className="flex gap-2 w-full items-center">
            {/* Left: file upload + hint */}
            <div className="flex-1 flex items-center gap-1.5 min-w-0">
              {acceptsImage && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center justify-center h-8 w-8 rounded-lg active:scale-95 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
                  type="button"
                  aria-label="Upload image"
                  title="Upload image"
                >
                  <Plus className="w-5 h-5" strokeWidth={2.25} />
                </button>
              )}
              {hint && (
                <span className="text-[11px] text-primary font-medium truncate">
                  {hint}
                </span>
              )}
            </div>

            {/* Right: parent-supplied slot + mode selector + send */}
            <div className="flex items-center gap-1 shrink-0">
              {rightSlot}
              {/* Mode selector */}
              {modes && modes.length > 0 && selectedMode && onModeChange && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setIsModeMenuOpen(!isModeMenuOpen)}
                    className={`inline-flex items-center justify-center h-8 rounded-xl px-3 transition-colors text-xs ${
                      isModeMenuOpen
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                    type="button"
                  >
                    <span className="font-medium whitespace-nowrap">
                      {selectedMode.name}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 ml-1 opacity-75 transition-transform ${
                        isModeMenuOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isModeMenuOpen && (
                    <div className="absolute bottom-full right-0 mb-2 w-[280px] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col p-1.5">
                      {modes.map((mode) => (
                        <button
                          key={mode.id}
                          onClick={() => {
                            onModeChange(mode.id);
                            setIsModeMenuOpen(false);
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-xl flex items-start justify-between gap-2 hover:bg-slate-50 transition-colors"
                          type="button"
                        >
                          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {mode.icon && (
                                <span className="text-slate-600 shrink-0">
                                  {mode.icon}
                                </span>
                              )}
                              <span className="text-[13px] font-semibold text-slate-900 truncate">
                                {mode.name}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 leading-snug">
                              {mode.description}
                            </span>
                          </div>
                          {selectedModeId === mode.id && (
                            <Check className="w-4 h-4 text-[#D97757] mt-1 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Send */}
              <button
                onClick={onSend}
                disabled={disabled || !hasContent || isGenerating}
                className={`inline-flex items-center justify-center h-8 w-8 rounded-xl transition-colors active:scale-95 ${
                  hasContent && !disabled && !isGenerating
                    ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
                    : "bg-primary/25 text-white/70 cursor-default"
                }`}
                type="button"
                aria-label="Send message"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      {isDragging && acceptsImage && (
        <div className="absolute inset-0 bg-orange-50/90 border-2 border-dashed border-[#D97757] rounded-2xl z-50 flex flex-col items-center justify-center backdrop-blur-sm pointer-events-none">
          <Archive className="w-10 h-10 text-[#D97757] mb-2 animate-bounce" />
          <p className="text-[#D97757] font-semibold">Drop image to upload</p>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="text-center mt-4">
        <p className="text-xs text-slate-400">
          AI can make mistakes. Please check important information.
        </p>
      </div>
    </div>
  );
};

export default ClaudeChatInput;
