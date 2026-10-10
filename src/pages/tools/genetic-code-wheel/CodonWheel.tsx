import { BASES, BASE_COLORS, CODON_TABLE, AA_COLORS } from "./codonData";

// SVG Codon Wheel component
export function CodonWheel({
  rotation,
  spinning,
  highlightCodon,
  blurOuter,
}: {
  rotation: number;
  spinning: boolean;
  highlightCodon: string | null;
  blurOuter: boolean;
}) {
  const cx = 250;
  const cy = 250;
  const r1 = 60;  // inner ring radius (1st base)
  const r2 = 120; // middle ring radius (2nd base)
  const r3 = 190; // outer ring radius (3rd base)
  const r4 = 240; // outermost (amino acid labels)

  function arcPath(startAngle: number, endAngle: number, innerR: number, outerR: number): string {
    const s1 = startAngle * (Math.PI / 180);
    const e1 = endAngle * (Math.PI / 180);
    const x1 = cx + innerR * Math.cos(s1);
    const y1 = cy + innerR * Math.sin(s1);
    const x2 = cx + outerR * Math.cos(s1);
    const y2 = cy + outerR * Math.sin(s1);
    const x3 = cx + outerR * Math.cos(e1);
    const y3 = cy + outerR * Math.sin(e1);
    const x4 = cx + innerR * Math.cos(e1);
    const y4 = cy + innerR * Math.sin(e1);
    const large = endAngle - startAngle > 180 ? 1 : 0;
    return `M${x1},${y1} L${x2},${y2} A${outerR},${outerR} 0 ${large} 1 ${x3},${y3} L${x4},${y4} A${innerR},${innerR} 0 ${large} 0 ${x1},${y1}Z`;
  }

  const segments: JSX.Element[] = [];
  const outerSegments: JSX.Element[] = [];

  // Ring 1: First base (center) — 4 sectors of 90°
  BASES.forEach((base1, i) => {
    const startAngle = i * 90 - 90;
    const endAngle = startAngle + 90;
    const midAngle = startAngle + 45;
    const colors = BASE_COLORS[base1];

    segments.push(
      <path
        key={`r1-${base1}`}
        d={arcPath(startAngle, endAngle, 20, r1)}
        fill={colors.bg}
        stroke="#fff"
        strokeWidth="2"
      />
    );
    const a = midAngle * (Math.PI / 180);
    const tx = cx + 40 * Math.cos(a);
    const ty = cy + 40 * Math.sin(a);
    segments.push(
      <text
        key={`r1t-${base1}`}
        x={tx}
        y={ty}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="18"
        fontWeight="800"
        fill="#fff"
        className="pointer-events-none select-none"
      >
        {base1}
      </text>
    );
  });

  // Ring 2: Second base — 16 sectors of 22.5°
  BASES.forEach((base1, i) => {
    BASES.forEach((base2, j) => {
      const startAngle = i * 90 + j * 22.5 - 90;
      const endAngle = startAngle + 22.5;
      const midAngle = startAngle + 11.25;
      const colors = BASE_COLORS[base2];

      segments.push(
        <path
          key={`r2-${base1}${base2}`}
          d={arcPath(startAngle, endAngle, r1, r2)}
          fill={colors.bg}
          stroke="#fff"
          strokeWidth="1.5"
        />
      );
      const a = midAngle * (Math.PI / 180);
      const tx = cx + 90 * Math.cos(a);
      const ty = cy + 90 * Math.sin(a);
      segments.push(
        <text
          key={`r2t-${base1}${base2}`}
          x={tx}
          y={ty}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="12"
          fontWeight="700"
          fill="#fff"
          transform={`rotate(${midAngle + 90}, ${tx}, ${ty})`}
          className="pointer-events-none select-none"
        >
          {base2}
        </text>
      );
    });
  });

  // Ring 3: Third base + Amino acid — 64 sectors of 5.625°
  BASES.forEach((base1, i) => {
    BASES.forEach((base2, j) => {
      BASES.forEach((base3, k) => {
        const startAngle = i * 90 + j * 22.5 + k * 5.625 - 90;
        const endAngle = startAngle + 5.625;
        const midAngle = startAngle + 2.8125;
        const codon = `${base1}${base2}${base3}`;
        const aa = CODON_TABLE[codon];
        const isHighlighted = highlightCodon === codon;
        const aaColor = AA_COLORS[aa.full] || "#e5e7eb";

        // Third base segment (stays sharp — part of inner rings)
        segments.push(
          <path
            key={`r3-${codon}`}
            d={arcPath(startAngle, endAngle, r2, r3)}
            fill={isHighlighted ? "#fbbf24" : aaColor}
            stroke="#fff"
            strokeWidth="1"
          />
        );

        // Third base letter
        const a3 = midAngle * (Math.PI / 180);
        const tx3 = cx + 155 * Math.cos(a3);
        const ty3 = cy + 155 * Math.sin(a3);
        segments.push(
          <text
            key={`r3t-${codon}`}
            x={tx3}
            y={ty3}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="8"
            fontWeight="700"
            fill="#1f2937"
            transform={`rotate(${midAngle + 90}, ${tx3}, ${ty3})`}
            className="pointer-events-none select-none"
          >
            {base3}
          </text>
        );

        // Amino acid outer label ring (blurrable)
        outerSegments.push(
          <path
            key={`r4-${codon}`}
            d={arcPath(startAngle, endAngle, r3, r4)}
            fill={isHighlighted ? "#fbbf24" : aaColor}
            stroke="#fff"
            strokeWidth="0.5"
            opacity={isHighlighted ? 1 : 0.85}
          />
        );

        // Amino acid abbreviation text (blurrable)
        const txAa = cx + 215 * Math.cos(a3);
        const tyAa = cy + 215 * Math.sin(a3);
        outerSegments.push(
          <text
            key={`r4t-${codon}`}
            x={txAa}
            y={tyAa}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="7"
            fontWeight="600"
            fill="#1f2937"
            transform={`rotate(${midAngle + 90}, ${txAa}, ${tyAa})`}
            className="pointer-events-none select-none"
          >
            {aa.three}
          </text>
        );
      });
    });
  });

  return (
    <svg
      viewBox="0 0 500 500"
      className="w-full max-w-[620px] mx-auto"
      style={{
        transform: `rotate(${rotation}deg)`,
        transition: spinning ? "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
      }}
    >
      <defs>
        <filter id="outerBlur">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      {segments}
      {/* Outer ring — amino acid labels (blurred when quiz is active) */}
      <g filter={blurOuter ? "url(#outerBlur)" : undefined} style={{ transition: "filter 0.5s ease" }}>
        {outerSegments}
      </g>
      {/* Center circle */}
      <circle cx={cx} cy={cy} r="20" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="2" />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="8"
        fontWeight="700"
        fill="hsl(var(--foreground))"
        className="pointer-events-none select-none"
      >
        5'→3'
      </text>

      {/* Ring labels */}
      <text x={cx} y={cy - r1 - 5} textAnchor="middle" fontSize="7" fill="hsl(var(--muted-foreground))" fontWeight="500" className="pointer-events-none select-none opacity-60">
        2nd base
      </text>
    </svg>
  );
}
