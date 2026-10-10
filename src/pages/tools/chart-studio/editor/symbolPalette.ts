// Chart Studio — symbol palette. Mirrors the Simple Canvas tool's SpecialCharactersPalette
// exactly so users see the same picker in both tools.

export const SPECIAL_CHARACTERS = {
  greek: {
    label: "Greek",
    symbols: [
      "α", "β", "γ", "δ", "ε", "ζ", "η", "θ", "ι", "κ", "λ", "μ",
      "ν", "ξ", "ο", "π", "ρ", "σ", "τ", "υ", "φ", "χ", "ψ", "ω",
      "Α", "Β", "Γ", "Δ", "Ε", "Ζ", "Η", "Θ", "Ι", "Κ", "Λ", "Μ",
      "Ν", "Ξ", "Ο", "Π", "Ρ", "Σ", "Τ", "Υ", "Φ", "Χ", "Ψ", "Ω",
    ],
  },
  math: {
    label: "Math",
    symbols: [
      "±", "∓", "×", "÷", "≠", "≈", "≡", "≤", "≥", "∞",
      "∫", "∑", "∏", "√", "∂", "∇", "∆", "∈", "∉", "⊂",
      "⊃", "∩", "∪", "∧", "∨", "¬", "⊕", "⊗", "∝", "∴",
    ],
  },
  arrows: {
    label: "Arrows",
    symbols: [
      "←", "→", "↑", "↓", "↔", "↕", "⇐", "⇒", "⇑", "⇓",
      "⇔", "⇕", "↖", "↗", "↘", "↙", "⟲", "⟳", "↺", "↻",
    ],
  },
  common: {
    label: "Common",
    symbols: [
      "°", "′", "″", "‰", "℃", "℉", "Å", "Ω", "µ", "Ø",
      "§", "¶", "†", "‡", "©", "®", "™", "‹", "›", "«",
      "»", "–", "—", "…", "·", "•", "◦", "▪", "▫", "★",
    ],
  },
} as const;

export const CHARACTER_NAMES: Record<string, string> = {
  "α": "alpha", "β": "beta", "γ": "gamma", "δ": "delta", "ε": "epsilon", "ζ": "zeta",
  "η": "eta", "θ": "theta", "ι": "iota", "κ": "kappa", "λ": "lambda", "μ": "mu",
  "ν": "nu", "ξ": "xi", "ο": "omicron", "π": "pi", "ρ": "rho", "σ": "sigma",
  "τ": "tau", "υ": "upsilon", "φ": "phi", "χ": "chi", "ψ": "psi", "ω": "omega",
  "Α": "Alpha", "Β": "Beta", "Γ": "Gamma", "Δ": "Delta", "Ε": "Epsilon", "Ζ": "Zeta",
  "Η": "Eta", "Θ": "Theta", "Ι": "Iota", "Κ": "Kappa", "Λ": "Lambda", "Μ": "Mu",
  "Ν": "Nu", "Ξ": "Xi", "Ο": "Omicron", "Π": "Pi", "Ρ": "Rho", "Σ": "Sigma",
  "Τ": "Tau", "Υ": "Upsilon", "Φ": "Phi", "Χ": "Chi", "Ψ": "Psi", "Ω": "Omega",
  "±": "plus-minus", "∓": "minus-plus", "×": "multiplication", "÷": "division",
  "≠": "not equal", "≈": "approximately equal", "≡": "identical to",
  "≤": "less than or equal", "≥": "greater than or equal", "∞": "infinity",
  "∫": "integral", "∑": "summation", "∏": "product", "√": "square root",
  "∂": "partial derivative", "∇": "nabla", "∆": "increment", "∈": "element of",
  "∉": "not element of", "⊂": "subset", "⊃": "superset", "∩": "intersection",
  "∪": "union", "∧": "logical and", "∨": "logical or", "¬": "not",
  "⊕": "direct sum", "⊗": "tensor product", "∝": "proportional to", "∴": "therefore",
  "←": "left arrow", "→": "right arrow", "↑": "up arrow", "↓": "down arrow",
  "↔": "left-right arrow", "↕": "up-down arrow", "⇐": "left double arrow",
  "⇒": "right double arrow", "⇑": "up double arrow", "⇓": "down double arrow",
  "⇔": "left-right double arrow", "⇕": "up-down double arrow",
  "↖": "up-left arrow", "↗": "up-right arrow", "↘": "down-right arrow",
  "↙": "down-left arrow", "⟲": "anticlockwise arrow", "⟳": "clockwise arrow",
  "↺": "circular left", "↻": "circular right",
  "°": "degree", "′": "prime", "″": "double prime", "‰": "per mille",
  "℃": "celsius", "℉": "fahrenheit", "Å": "angstrom", "µ": "micro",
  "Ø": "diameter", "§": "section", "¶": "paragraph", "†": "dagger",
  "‡": "double dagger", "©": "copyright", "®": "registered", "™": "trademark",
  "‹": "single left angle", "›": "single right angle", "«": "left guillemet",
  "»": "right guillemet", "–": "en dash", "—": "em dash", "…": "ellipsis",
  "·": "middle dot", "•": "bullet", "◦": "white bullet", "▪": "black square",
  "▫": "white square", "★": "star",
};

export type CategoryKey = keyof typeof SPECIAL_CHARACTERS;
