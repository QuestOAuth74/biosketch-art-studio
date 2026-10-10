import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Omega } from "lucide-react";
import { useCanvas } from "@/contexts/CanvasContext";
import { Textbox } from "fabric";
import { toast } from "sonner";
import { normalizeEditingTextFont } from "@/lib/fontLoader";

const SPECIAL_CHARACTERS = {
  greek: {
    label: "Greek",
    symbols: [
      "α", "β", "γ", "δ", "ε", "ζ", "η", "θ", "ι", "κ", "λ", "μ",
      "ν", "ξ", "ο", "π", "ρ", "σ", "τ", "υ", "φ", "χ", "ψ", "ω",
      "Α", "Β", "Γ", "Δ", "Ε", "Ζ", "Η", "Θ", "Ι", "Κ", "Λ", "Μ",
      "Ν", "Ξ", "Ο", "Π", "Ρ", "Σ", "Τ", "Υ", "Φ", "Χ", "Ψ", "Ω"
    ]
  },
  math: {
    label: "Math",
    symbols: [
      "±", "∓", "×", "÷", "≠", "≈", "≡", "≤", "≥", "∞",
      "∫", "∑", "∏", "√", "∂", "∇", "∆", "∈", "∉", "⊂",
      "⊃", "∩", "∪", "∧", "∨", "¬", "⊕", "⊗", "∝", "∴"
    ]
  },
  arrows: {
    label: "Arrows",
    symbols: [
      "←", "→", "↑", "↓", "↔", "↕", "⇐", "⇒", "⇑", "⇓",
      "⇔", "⇕", "↖", "↗", "↘", "↙", "⟲", "⟳", "↺", "↻"
    ]
  },
  common: {
    label: "Common",
    symbols: [
      "°", "′", "″", "‰", "℃", "℉", "Å", "Ω", "µ", "Ø",
      "§", "¶", "†", "‡", "©", "®", "™", "‹", "›", "«",
      "»", "–", "—", "…", "·", "•", "◦", "▪", "▫", "★"
    ]
  }
};

const CHARACTER_NAMES: Record<string, string> = {
  // Greek lowercase
  "α": "alpha", "β": "beta", "γ": "gamma", "δ": "delta", "ε": "epsilon", "ζ": "zeta",
  "η": "eta", "θ": "theta", "ι": "iota", "κ": "kappa", "λ": "lambda", "μ": "mu",
  "ν": "nu", "ξ": "xi", "ο": "omicron", "π": "pi", "ρ": "rho", "σ": "sigma",
  "τ": "tau", "υ": "upsilon", "φ": "phi", "χ": "chi", "ψ": "psi", "ω": "omega",
  // Greek uppercase
  "Α": "Alpha", "Β": "Beta", "Γ": "Gamma", "Δ": "Delta", "Ε": "Epsilon", "Ζ": "Zeta",
  "Η": "Eta", "Θ": "Theta", "Ι": "Iota", "Κ": "Kappa", "Λ": "Lambda", "Μ": "Mu",
  "Ν": "Nu", "Ξ": "Xi", "Ο": "Omicron", "Π": "Pi", "Ρ": "Rho", "Σ": "Sigma",
  "Τ": "Tau", "Υ": "Upsilon", "Φ": "Phi", "Χ": "Chi", "Ψ": "Psi", "Ω": "Omega",
  // Math symbols
  "±": "plus-minus", "∓": "minus-plus", "×": "multiplication", "÷": "division",
  "≠": "not equal", "≈": "approximately equal", "≡": "identical to",
  "≤": "less than or equal", "≥": "greater than or equal", "∞": "infinity",
  "∫": "integral", "∑": "summation", "∏": "product", "√": "square root",
  "∂": "partial derivative", "∇": "nabla", "∆": "increment", "∈": "element of",
  "∉": "not element of", "⊂": "subset", "⊃": "superset", "∩": "intersection",
  "∪": "union", "∧": "logical and", "∨": "logical or", "¬": "not",
  "⊕": "direct sum", "⊗": "tensor product", "∝": "proportional to", "∴": "therefore",
  // Arrows
  "←": "left arrow", "→": "right arrow", "↑": "up arrow", "↓": "down arrow",
  "↔": "left-right arrow", "↕": "up-down arrow", "⇐": "left double arrow",
  "⇒": "right double arrow", "⇑": "up double arrow", "⇓": "down double arrow",
  "⇔": "left-right double arrow", "⇕": "up-down double arrow",
  "↖": "up-left arrow", "↗": "up-right arrow", "↘": "down-right arrow",
  "↙": "down-left arrow", "⟲": "anticlockwise arrow", "⟳": "clockwise arrow",
  "↺": "circular left", "↻": "circular right",
  // Common symbols
  "°": "degree", "′": "prime", "″": "double prime", "‰": "per mille",
  "℃": "celsius", "℉": "fahrenheit", "Å": "angstrom", "µ": "micro",
  "Ø": "diameter", "§": "section", "¶": "paragraph", "†": "dagger",
  "‡": "double dagger", "©": "copyright", "®": "registered", "™": "trademark",
  "‹": "single left angle", "›": "single right angle", "«": "left guillemet",
  "»": "right guillemet", "–": "en dash", "—": "em dash", "…": "ellipsis",
  "·": "middle dot", "•": "bullet", "◦": "white bullet", "▪": "black square",
  "▫": "white square", "★": "star"
};

export const SpecialCharactersPalette = () => {
  const { canvas } = useCanvas();

  const findEditingTextObject = (canvas: any | null): Textbox | null => {
    if (!canvas) return null;

    // 1) Prefer the active object if it's a text in editing mode
    const active = canvas.getActiveObject() as any;
    if (
      active &&
      (active.type === "textbox" || active.type === "text") &&
      active.isEditing
    ) {
      return active as Textbox;
    }

    // 2) Fallback: scan all objects for a text that is currently editing
    const objects = canvas.getObjects() as any[];
    for (const obj of objects) {
      if (
        (obj.type === "textbox" || obj.type === "text") &&
        obj.isEditing
      ) {
        return obj as Textbox;
      }
    }

    return null;
  };

  const insertCharacter = (char: string) => {
    if (!canvas) return;

    const textObj = findEditingTextObject(canvas);

    if (!textObj) {
      // No text box is actively being edited — guide the user
      toast.error("Double-click a text label to edit, then click a symbol to insert it.", {
        duration: 2000,
      });
      return;
    }

    // Normalize font BEFORE inserting to ensure special characters render
    normalizeEditingTextFont(textObj);

    const currentText = textObj.text || "";
    const cursorPos =
      typeof textObj.selectionStart === "number"
        ? textObj.selectionStart
        : currentText.length;

    // Manual text insertion to avoid insertChars duplication issues
    const newText =
      currentText.substring(0, cursorPos) +
      char +
      currentText.substring(cursorPos);
    
    textObj.text = newText;
    
    const newCursorPos = cursorPos + char.length;
    textObj.selectionStart = newCursorPos;
    textObj.selectionEnd = newCursorPos;

    // Force Fabric to recalc dimensions and redraw immediately
    if (typeof (textObj as any).initDimensions === "function") {
      (textObj as any).initDimensions();
    }
    if (typeof (textObj as any).setCoords === "function") {
      (textObj as any).setCoords();
    }
    textObj.dirty = true;
    canvas.requestRenderAll();
  };

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
            >
              <Omega className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Special Characters - Double-click a label to edit first</p>
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="w-80" align="start">
        <Tabs defaultValue="greek" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="greek" className="text-xs">Greek</TabsTrigger>
            <TabsTrigger value="math" className="text-xs">Math</TabsTrigger>
            <TabsTrigger value="arrows" className="text-xs">Arrows</TabsTrigger>
            <TabsTrigger value="common" className="text-xs">Common</TabsTrigger>
          </TabsList>
          
          {Object.entries(SPECIAL_CHARACTERS).map(([key, category]) => (
            <TabsContent key={key} value={key} className="mt-2">
              <div className="grid grid-cols-10 gap-1 max-h-48 overflow-y-auto">
                {category.symbols.map((symbol) => (
                  <Tooltip key={symbol}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-8 w-8 p-0 text-base hover:bg-primary hover:text-primary-foreground"
                        onClick={() => insertCharacter(symbol)}
                      >
                        {symbol}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="capitalize">{CHARACTER_NAMES[symbol] || symbol}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </PopoverContent>
    </Popover>
  );
};
