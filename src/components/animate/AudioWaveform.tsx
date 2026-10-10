import { useMemo } from "react";
import { generateWaveformData } from "@/lib/audioUtils";
import { Volume2 } from "lucide-react";

interface AudioWaveformProps {
  audioBuffer: AudioBuffer;
  trackAreaWidth: number;
  duration: number; // animation duration in seconds
}

export function AudioWaveform({
  audioBuffer,
  trackAreaWidth,
  duration,
}: AudioWaveformProps) {
  // How much of the waveform to show (clip audio to animation duration)
  const audioDuration = audioBuffer.duration;
  const visibleRatio = Math.min(1, duration / audioDuration);
  const displayWidth = audioDuration <= duration ? trackAreaWidth : trackAreaWidth * (audioDuration / duration);
  const clippedWidth = Math.min(trackAreaWidth, displayWidth);

  const barCount = Math.max(1, Math.floor(clippedWidth / 2));
  const waveformData = useMemo(
    () => generateWaveformData(audioBuffer, Math.max(1, Math.floor(displayWidth / 2))),
    [audioBuffer, displayWidth]
  );

  // Only show the portion that maps to visible timeline
  const visibleBars = Math.min(barCount, waveformData.length);

  const trackHeight = 32;
  const barMaxHeight = trackHeight - 4;

  return (
    <div className="flex" style={{ height: trackHeight }}>
      {/* Label area */}
      <div
        className="w-[180px] shrink-0 flex items-center gap-2 px-3"
        style={{
          background: "rgba(139,92,246,0.04)",
          borderBottom: "1px solid var(--aw-border)",
          borderRight: "1px solid var(--aw-border)",
        }}
      >
        <Volume2 className="h-3.5 w-3.5" style={{ color: "rgba(139,92,246,0.6)" }} />
        <span
          className="text-[13px] font-medium truncate"
          style={{ color: "var(--aw-text-2)" }}
        >
          Audio
        </span>
      </div>

      {/* Waveform area */}
      <div
        className="relative flex-1"
        style={{
          minWidth: trackAreaWidth,
          borderBottom: "1px solid var(--aw-border)",
          background: "rgba(139,92,246,0.02)",
        }}
      >
        <svg
          width={clippedWidth}
          height={trackHeight}
          className="absolute left-0 top-0"
          style={{ overflow: "visible" }}
        >
          {Array.from({ length: visibleBars }, (_, i) => {
            const amplitude = waveformData[i] ?? 0;
            const barHeight = Math.max(1, amplitude * barMaxHeight);
            const x = i * 2;
            const y = (trackHeight - barHeight) / 2;

            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={1.2}
                height={barHeight}
                rx={0.5}
                fill="rgba(139,92,246,0.3)"
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}
