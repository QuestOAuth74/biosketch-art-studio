// ── DNA/Protein Sequence Utilities ──

// Standard DNA complement map
const COMPLEMENT: Record<string, string> = {
  A: "T", T: "A", G: "C", C: "G",
  a: "t", t: "a", g: "c", c: "g",
  R: "Y", Y: "R", S: "S", W: "W",
  K: "M", M: "K", B: "V", V: "B",
  D: "H", H: "D", N: "N",
  r: "y", y: "r", s: "s", w: "w",
  k: "m", m: "k", b: "v", v: "b",
  d: "h", h: "d", n: "n",
};

// Standard genetic code (NCBI Table 1) — DNA codons
export const CODON_TABLE: Record<string, string> = {
  TTT: "F", TTC: "F", TTA: "L", TTG: "L",
  CTT: "L", CTC: "L", CTA: "L", CTG: "L",
  ATT: "I", ATC: "I", ATA: "I", ATG: "M",
  GTT: "V", GTC: "V", GTA: "V", GTG: "V",
  TCT: "S", TCC: "S", TCA: "S", TCG: "S",
  CCT: "P", CCC: "P", CCA: "P", CCG: "P",
  ACT: "T", ACC: "T", ACA: "T", ACG: "T",
  GCT: "A", GCC: "A", GCA: "A", GCG: "A",
  TAT: "Y", TAC: "Y", TAA: "*", TAG: "*",
  CAT: "H", CAC: "H", CAA: "Q", CAG: "Q",
  AAT: "N", AAC: "N", AAA: "K", AAG: "K",
  GAT: "D", GAC: "D", GAA: "E", GAG: "E",
  TGT: "C", TGC: "C", TGA: "*", TGG: "W",
  CGT: "R", CGC: "R", CGA: "R", CGG: "R",
  AGT: "S", AGC: "S", AGA: "R", AGG: "R",
  GGT: "G", GGC: "G", GGA: "G", GGG: "G",
};

// Amino acid 3-letter codes
const AA_THREE: Record<string, string> = {
  A: "Ala", R: "Arg", N: "Asn", D: "Asp", C: "Cys",
  E: "Glu", Q: "Gln", G: "Gly", H: "His", I: "Ile",
  L: "Leu", K: "Lys", M: "Met", F: "Phe", P: "Pro",
  S: "Ser", T: "Thr", W: "Trp", Y: "Tyr", V: "Val",
  "*": "Stop",
};

// Amino acid molecular weights (average, in Da)
const AA_MW: Record<string, number> = {
  A: 89.09, R: 174.20, N: 132.12, D: 133.10, C: 121.16,
  E: 147.13, Q: 146.15, G: 75.03, H: 155.16, I: 131.17,
  L: 131.17, K: 146.19, M: 149.21, F: 165.19, P: 115.13,
  S: 105.09, T: 119.12, W: 204.23, Y: 181.19, V: 117.15,
};

// ── Core functions ──

export function cleanSequence(raw: string): string {
  // Remove FASTA headers, numbers, spaces, newlines
  return raw
    .split("\n")
    .filter(l => !l.startsWith(">"))
    .join("")
    .replace(/[\s\d]/g, "")
    .toUpperCase();
}

export function complement(seq: string): string {
  return seq.split("").map(c => COMPLEMENT[c] || c).join("");
}

export function reverseComplement(seq: string): string {
  return complement(seq).split("").reverse().join("");
}

export function gcContent(seq: string): number {
  if (!seq.length) return 0;
  const gc = seq.split("").filter(c => c === "G" || c === "C").length;
  return (gc / seq.length) * 100;
}

export function translateFrame(seq: string, frame: number): string {
  let protein = "";
  for (let i = frame; i + 2 < seq.length; i += 3) {
    const codon = seq.slice(i, i + 3);
    protein += CODON_TABLE[codon] || "X";
  }
  return protein;
}

export function translateAllFrames(seq: string): { frame: string; protein: string; start: number }[] {
  const rc = reverseComplement(seq);
  return [
    { frame: "+1", protein: translateFrame(seq, 0), start: 1 },
    { frame: "+2", protein: translateFrame(seq, 1), start: 2 },
    { frame: "+3", protein: translateFrame(seq, 2), start: 3 },
    { frame: "-1", protein: translateFrame(rc, 0), start: 1 },
    { frame: "-2", protein: translateFrame(rc, 1), start: 2 },
    { frame: "-3", protein: translateFrame(rc, 2), start: 3 },
  ];
}

export interface ORF {
  frame: string;
  start: number; // 1-based position in the original strand
  end: number;
  length: number; // in codons (amino acids)
  protein: string;
}

export function findORFs(seq: string, minCodons: number = 30): ORF[] {
  const orfs: ORF[] = [];

  function scanFrame(dna: string, frameName: string, isReverse: boolean) {
    const frameOffset = parseInt(frameName.replace(/[+-]/, "")) - 1;
    for (let i = frameOffset; i + 2 < dna.length; i += 3) {
      const codon = dna.slice(i, i + 3);
      if (codon === "ATG") {
        // Found start codon, read until stop
        let protein = "M";
        let j = i + 3;
        while (j + 2 < dna.length) {
          const c = dna.slice(j, j + 3);
          const aa = CODON_TABLE[c] || "X";
          if (aa === "*") break;
          protein += aa;
          j += 3;
        }
        if (protein.length >= minCodons) {
          const startPos = isReverse ? dna.length - i : i + 1;
          const endPos = isReverse ? dna.length - j + 1 : j + 3;
          orfs.push({
            frame: frameName,
            start: Math.min(startPos, endPos),
            end: Math.max(startPos, endPos),
            length: protein.length,
            protein,
          });
        }
        // Skip past this ORF to avoid nested ORFs in same frame
        i = j;
      }
    }
  }

  const rc = reverseComplement(seq);
  scanFrame(seq, "+1", false);
  scanFrame(seq, "+2", false);
  scanFrame(seq, "+3", false);
  scanFrame(rc, "-1", true);
  scanFrame(rc, "-2", true);
  scanFrame(rc, "-3", true);

  return orfs.sort((a, b) => b.length - a.length);
}

export interface SeqStats {
  length: number;
  gcPercent: number;
  aCount: number;
  tCount: number;
  gCount: number;
  cCount: number;
  meltingTemp: number; // basic Tm for short oligos
  molecularWeight: number; // ssDNA approximate
}

export function sequenceStats(seq: string): SeqStats {
  const a = seq.split("").filter(c => c === "A").length;
  const t = seq.split("").filter(c => c === "T").length;
  const g = seq.split("").filter(c => c === "G").length;
  const c = seq.split("").filter(c => c === "C").length;
  const len = seq.length;

  // Basic Tm (Wallace rule for <14 nt, nearest-neighbor approx for longer)
  let tm = 0;
  if (len > 0 && len <= 14) {
    tm = 2 * (a + t) + 4 * (g + c); // Wallace rule
  } else if (len > 14) {
    tm = 64.9 + 41 * (g + c - 16.4) / len; // basic salt-adjusted
  }

  // ssDNA MW: avg ~330 Da per nucleotide
  const mw = len * 330;

  return {
    length: len,
    gcPercent: len > 0 ? ((g + c) / len) * 100 : 0,
    aCount: a, tCount: t, gCount: g, cCount: c,
    meltingTemp: tm,
    molecularWeight: mw,
  };
}

export function proteinStats(protein: string): { length: number; mw: number; composition: Record<string, number> } {
  const clean = protein.replace(/\*/g, "");
  const composition: Record<string, number> = {};
  let mw = 0;
  for (const aa of clean) {
    composition[aa] = (composition[aa] || 0) + 1;
    mw += AA_MW[aa] || 0;
  }
  // Subtract water for peptide bonds
  if (clean.length > 1) mw -= (clean.length - 1) * 18.02;
  return { length: clean.length, mw, composition };
}

export function toFasta(seq: string, header: string = "sequence", lineWidth: number = 60): string {
  const lines = [`>${header}`];
  for (let i = 0; i < seq.length; i += lineWidth) {
    lines.push(seq.slice(i, i + lineWidth));
  }
  return lines.join("\n");
}

export function aaToThreeLetter(protein: string): string {
  return protein.split("").map(aa => AA_THREE[aa] || aa).join("-");
}
