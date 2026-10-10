// Complete codon table: codon → { full, three, one }
export const CODON_TABLE: Record<string, { full: string; three: string; one: string }> = {
  UUU: { full: "Phenylalanine", three: "Phe", one: "F" },
  UUC: { full: "Phenylalanine", three: "Phe", one: "F" },
  UUA: { full: "Leucine", three: "Leu", one: "L" },
  UUG: { full: "Leucine", three: "Leu", one: "L" },
  CUU: { full: "Leucine", three: "Leu", one: "L" },
  CUC: { full: "Leucine", three: "Leu", one: "L" },
  CUA: { full: "Leucine", three: "Leu", one: "L" },
  CUG: { full: "Leucine", three: "Leu", one: "L" },
  AUU: { full: "Isoleucine", three: "Ile", one: "I" },
  AUC: { full: "Isoleucine", three: "Ile", one: "I" },
  AUA: { full: "Isoleucine", three: "Ile", one: "I" },
  AUG: { full: "Methionine", three: "Met", one: "M" },
  GUU: { full: "Valine", three: "Val", one: "V" },
  GUC: { full: "Valine", three: "Val", one: "V" },
  GUA: { full: "Valine", three: "Val", one: "V" },
  GUG: { full: "Valine", three: "Val", one: "V" },
  UCU: { full: "Serine", three: "Ser", one: "S" },
  UCC: { full: "Serine", three: "Ser", one: "S" },
  UCA: { full: "Serine", three: "Ser", one: "S" },
  UCG: { full: "Serine", three: "Ser", one: "S" },
  CCU: { full: "Proline", three: "Pro", one: "P" },
  CCC: { full: "Proline", three: "Pro", one: "P" },
  CCA: { full: "Proline", three: "Pro", one: "P" },
  CCG: { full: "Proline", three: "Pro", one: "P" },
  ACU: { full: "Threonine", three: "Thr", one: "T" },
  ACC: { full: "Threonine", three: "Thr", one: "T" },
  ACA: { full: "Threonine", three: "Thr", one: "T" },
  ACG: { full: "Threonine", three: "Thr", one: "T" },
  GCU: { full: "Alanine", three: "Ala", one: "A" },
  GCC: { full: "Alanine", three: "Ala", one: "A" },
  GCA: { full: "Alanine", three: "Ala", one: "A" },
  GCG: { full: "Alanine", three: "Ala", one: "A" },
  UAU: { full: "Tyrosine", three: "Tyr", one: "Y" },
  UAC: { full: "Tyrosine", three: "Tyr", one: "Y" },
  UAA: { full: "Stop", three: "Stop", one: "*" },
  UAG: { full: "Stop", three: "Stop", one: "*" },
  CAU: { full: "Histidine", three: "His", one: "H" },
  CAC: { full: "Histidine", three: "His", one: "H" },
  CAA: { full: "Glutamine", three: "Gln", one: "Q" },
  CAG: { full: "Glutamine", three: "Gln", one: "Q" },
  AAU: { full: "Asparagine", three: "Asn", one: "N" },
  AAC: { full: "Asparagine", three: "Asn", one: "N" },
  AAA: { full: "Lysine", three: "Lys", one: "K" },
  AAG: { full: "Lysine", three: "Lys", one: "K" },
  GAU: { full: "Aspartate", three: "Asp", one: "D" },
  GAC: { full: "Aspartate", three: "Asp", one: "D" },
  GAA: { full: "Glutamate", three: "Glu", one: "E" },
  GAG: { full: "Glutamate", three: "Glu", one: "E" },
  UGU: { full: "Cysteine", three: "Cys", one: "C" },
  UGC: { full: "Cysteine", three: "Cys", one: "C" },
  UGA: { full: "Stop", three: "Stop", one: "*" },
  UGG: { full: "Tryptophan", three: "Trp", one: "W" },
  CGU: { full: "Arginine", three: "Arg", one: "R" },
  CGC: { full: "Arginine", three: "Arg", one: "R" },
  CGA: { full: "Arginine", three: "Arg", one: "R" },
  CGG: { full: "Arginine", three: "Arg", one: "R" },
  AGU: { full: "Serine", three: "Ser", one: "S" },
  AGC: { full: "Serine", three: "Ser", one: "S" },
  AGA: { full: "Arginine", three: "Arg", one: "R" },
  AGG: { full: "Arginine", three: "Arg", one: "R" },
  GGU: { full: "Glycine", three: "Gly", one: "G" },
  GGC: { full: "Glycine", three: "Gly", one: "G" },
  GGA: { full: "Glycine", three: "Gly", one: "G" },
  GGG: { full: "Glycine", three: "Gly", one: "G" },
};

// All unique amino acids for answer choices
export const ALL_AMINO_ACIDS = Array.from(
  new Set(Object.values(CODON_TABLE).map((v) => v.full))
).sort();

export const BASES = ["U", "C", "A", "G"] as const;

// Colors for each base
export const BASE_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  U: { bg: "#dc2626", text: "#ffffff", ring: "#b91c1c" },
  C: { bg: "#2563eb", text: "#ffffff", ring: "#1d4ed8" },
  A: { bg: "#16a34a", text: "#ffffff", ring: "#15803d" },
  G: { bg: "#d97706", text: "#ffffff", ring: "#b45309" },
};

// Amino acid color groups for the outer ring — vivid, saturated
export const AA_COLORS: Record<string, string> = {
  Phenylalanine: "#f9a8b8", Leucine: "#fdba74", Isoleucine: "#fde047",
  Methionine: "#6ee7b7", Valine: "#5eead4", Serine: "#67e8f9",
  Proline: "#7dd3fc", Threonine: "#93c5fd", Alanine: "#a5b4fc",
  Tyrosine: "#c4b5fd", Stop: "#f87171", Histidine: "#d8b4fe",
  Glutamine: "#f9a8d4", Asparagine: "#f0abfc", Lysine: "#e879f9",
  Aspartate: "#fca5a5", Glutamate: "#fb923c", Cysteine: "#6ee7b7",
  Tryptophan: "#5eead4", Arginine: "#93c5fd", Glycine: "#a5b4fc",
};

// Key facts about each amino acid
export const AMINO_ACID_FACTS: Record<string, { property: string; role: string; funFact: string; codons: string[] }> = {
  Phenylalanine: {
    property: "Nonpolar, aromatic",
    role: "Precursor to tyrosine and neurotransmitters (dopamine, norepinephrine). Essential amino acid obtained from diet.",
    funFact: "People with phenylketonuria (PKU) cannot metabolize this amino acid, which is why diet soda labels warn about phenylalanine content.",
    codons: ["UUU", "UUC"],
  },
  Leucine: {
    property: "Nonpolar, aliphatic, branched-chain",
    role: "Activates mTOR signaling pathway to stimulate muscle protein synthesis. Most abundant amino acid in proteins.",
    funFact: "One of the three branched-chain amino acids (BCAAs) popular in sports nutrition supplements.",
    codons: ["UUA", "UUG", "CUU", "CUC", "CUA", "CUG"],
  },
  Isoleucine: {
    property: "Nonpolar, aliphatic, branched-chain",
    role: "Important for muscle metabolism, immune function, and hemoglobin synthesis. Essential amino acid.",
    funFact: "Its name means 'equal leucine' because it has the same molecular formula as leucine but a different structure (isomer).",
    codons: ["AUU", "AUC", "AUA"],
  },
  Methionine: {
    property: "Nonpolar, sulfur-containing",
    role: "Start codon (AUG) — initiates nearly all protein synthesis. Precursor to S-adenosylmethionine (SAM), a key methyl donor.",
    funFact: "AUG is the universal start codon. Every newly synthesized protein begins with methionine (often removed later).",
    codons: ["AUG"],
  },
  Valine: {
    property: "Nonpolar, aliphatic, branched-chain",
    role: "Third branched-chain amino acid. Important for muscle growth, tissue repair, and energy production.",
    funFact: "A single valine-to-glutamate substitution at position 6 of beta-globin causes sickle cell disease.",
    codons: ["GUU", "GUC", "GUA", "GUG"],
  },
  Serine: {
    property: "Polar, uncharged, hydroxyl group",
    role: "Key phosphorylation site in cell signaling (serine kinases). Precursor to glycine, cysteine, and sphingolipids.",
    funFact: "Serine proteases (like trypsin and chymotrypsin) use a serine residue in their active site to cleave peptide bonds.",
    codons: ["UCU", "UCC", "UCA", "UCG", "AGU", "AGC"],
  },
  Proline: {
    property: "Nonpolar, cyclic (imino acid)",
    role: "Creates rigid kinks in protein chains. Major component of collagen (every third residue).",
    funFact: "Technically an imino acid, not an amino acid — its side chain loops back to the backbone nitrogen, creating a ring.",
    codons: ["CCU", "CCC", "CCA", "CCG"],
  },
  Threonine: {
    property: "Polar, uncharged, hydroxyl group",
    role: "Phosphorylation site in signaling. Important for mucin production and gut barrier integrity. Essential amino acid.",
    funFact: "The last of the 20 standard amino acids to be discovered (1936 by William Cumming Rose).",
    codons: ["ACU", "ACC", "ACA", "ACG"],
  },
  Alanine: {
    property: "Nonpolar, simplest chiral amino acid",
    role: "Major substrate in the glucose-alanine cycle between muscle and liver. Common in alpha-helices.",
    funFact: "Second simplest amino acid after glycine. The alanine scan is a technique where residues are systematically replaced with alanine to study protein function.",
    codons: ["GCU", "GCC", "GCA", "GCG"],
  },
  Tyrosine: {
    property: "Polar, aromatic, hydroxyl group",
    role: "Precursor to thyroid hormones, dopamine, epinephrine, and melanin. Key phosphorylation target (tyrosine kinases).",
    funFact: "Named from the Greek 'tyros' (cheese), where it was first discovered in casein protein in 1846.",
    codons: ["UAU", "UAC"],
  },
  Histidine: {
    property: "Polar, positively charged (at physiological pH ~6), aromatic",
    role: "Found in enzyme active sites (acts as proton shuttle). Component of hemoglobin's oxygen binding site.",
    funFact: "Its imidazole side chain has a pKa near physiological pH (~6.0), making it nature's favorite acid-base catalyst.",
    codons: ["CAU", "CAC"],
  },
  Glutamine: {
    property: "Polar, uncharged, amide group",
    role: "Most abundant free amino acid in blood. Fuel source for rapidly dividing cells (immune cells, gut epithelium).",
    funFact: "Cancer cells are often 'glutamine-addicted' — they consume it at extraordinary rates to fuel rapid growth.",
    codons: ["CAA", "CAG"],
  },
  Asparagine: {
    property: "Polar, uncharged, amide group",
    role: "Common site for N-linked glycosylation of proteins. Important for protein folding.",
    funFact: "First amino acid to be discovered (1806, from asparagus juice) — giving it its name.",
    codons: ["AAU", "AAC"],
  },
  Lysine: {
    property: "Polar, positively charged",
    role: "Essential for collagen cross-linking, histone modification (methylation, acetylation), and carnitine synthesis.",
    funFact: "Histone lysine modifications are central to epigenetics — acetylation opens chromatin, methylation can activate or silence genes.",
    codons: ["AAA", "AAG"],
  },
  Aspartate: {
    property: "Polar, negatively charged",
    role: "Key metabolite in the urea cycle and purine/pyrimidine biosynthesis. Neurotransmitter in the brain (excitatory).",
    funFact: "Aspartame (artificial sweetener) is a dipeptide of aspartate and phenylalanine — two amino acids combined.",
    codons: ["GAU", "GAC"],
  },
  Glutamate: {
    property: "Polar, negatively charged",
    role: "Primary excitatory neurotransmitter in the brain. Central to nitrogen metabolism and the citric acid cycle.",
    funFact: "Monosodium glutamate (MSG) is the sodium salt of glutamate — responsible for the 'umami' taste sensation.",
    codons: ["GAA", "GAG"],
  },
  Cysteine: {
    property: "Polar, sulfur-containing (thiol group)",
    role: "Forms disulfide bonds that stabilize protein 3D structure. Key component of glutathione (major antioxidant).",
    funFact: "Disulfide bonds between cysteines give hair its shape — perms work by breaking and reforming these bonds.",
    codons: ["UGU", "UGC"],
  },
  Tryptophan: {
    property: "Nonpolar, aromatic (largest side chain)",
    role: "Precursor to serotonin, melatonin, and niacin (vitamin B3). Absorbs UV light at 280 nm (used to measure protein concentration).",
    funFact: "The 'turkey makes you sleepy' myth — tryptophan is a serotonin/melatonin precursor, but turkey has no more than other meats.",
    codons: ["UGG"],
  },
  Arginine: {
    property: "Polar, positively charged, guanidinium group",
    role: "Precursor to nitric oxide (vasodilator). Important for immune function, wound healing, and histone-DNA interactions.",
    funFact: "Has the most complex side chain of any amino acid, with a guanidinium group that stays positively charged in nearly all biological conditions.",
    codons: ["CGU", "CGC", "CGA", "CGG", "AGA", "AGG"],
  },
  Glycine: {
    property: "Nonpolar, simplest amino acid (H side chain)",
    role: "Inhibitory neurotransmitter. Every third residue in collagen. Provides conformational flexibility to proteins.",
    funFact: "The only amino acid that is not chiral (no L or D form) because its side chain is just a hydrogen atom.",
    codons: ["GGU", "GGC", "GGA", "GGG"],
  },
  Stop: {
    property: "Not an amino acid",
    role: "UAA (ochre), UAG (amber), UGA (opal) — signal the ribosome to terminate translation and release the polypeptide.",
    funFact: "Stop codons were named after the color of a mutant bacteriophage strain: 'amber' was named after the discoverer Harris Bernstein ('Bernstein' means 'amber' in German).",
    codons: ["UAA", "UAG", "UGA"],
  },
};

export function getRandomCodon(): string {
  const codons = Object.keys(CODON_TABLE);
  return codons[Math.floor(Math.random() * codons.length)];
}

// Calculate the center angle of a codon's segment on the wheel
export function getCodonAngle(codon: string): number {
  const i = BASES.indexOf(codon[0] as typeof BASES[number]);
  const j = BASES.indexOf(codon[1] as typeof BASES[number]);
  const k = BASES.indexOf(codon[2] as typeof BASES[number]);
  const startAngle = i * 90 + j * 22.5 + k * 5.625 - 90;
  return startAngle + 2.8125; // center of the segment
}

export function getChoices(correctAnswer: string): string[] {
  const wrong = ALL_AMINO_ACIDS.filter((a) => a !== correctAnswer);
  const shuffledWrong = wrong.sort(() => Math.random() - 0.5).slice(0, 3);
  const choices = [...shuffledWrong, correctAnswer].sort(() => Math.random() - 0.5);
  return choices;
}
