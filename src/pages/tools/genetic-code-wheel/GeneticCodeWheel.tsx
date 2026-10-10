import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RotateCcw, Trophy, Dna, ChevronRight, HelpCircle, Volume2, VolumeX, Star, Users, FlaskConical, TestTubes } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SEOHead } from "@/components/SEO/SEOHead";
import { cn } from "@/lib/utils";
import { Web3MediaHero } from "@/components/ui/web3media-hero";
import { supabase } from "@/integrations/supabase/client";

import { useTrackToolVisit } from "@/hooks/useToolVisits";
import { Palette } from "lucide-react";
import { CODON_TABLE, ALL_AMINO_ACIDS, BASES, BASE_COLORS, AMINO_ACID_FACTS, getRandomCodon, getCodonAngle, getChoices } from "./codonData";
import { playSpinSound, playSelectSound, playCorrectSound, playWrongSound, playLandSound, fireConfetti } from "./sounds";
import { CodonWheel } from "./CodonWheel";

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Free Genetic Code Wheel Game - BioSketch",
  description: "Interactive genetic code wheel quiz. Spin the codon wheel and identify amino acids from mRNA triplet sequences. Learn the genetic code through play.",
  url: "https://biosketch.art/genetic-code-wheel",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function GeneticCodeWheel() {
  useTrackToolVisit("codons");
  const navigate = useNavigate();
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [currentCodon, setCurrentCodon] = useState<string | null>(null);
  const [choices, setChoices] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [blurOuterRing, setBlurOuterRing] = useState(false);
  const spinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickHandlesRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Game stats & rating
  const [gameStats, setGameStats] = useState<{ total_plays: number; total_ratings: number; rating_sum: number }>({
    total_plays: 0, total_ratings: 0, rating_sum: 0,
  });
  const [userRating, setUserRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [hasRated, setHasRated] = useState(false);

  const avgRating = gameStats.total_ratings > 0 ? gameStats.rating_sum / gameStats.total_ratings : 0;

  // Load stats from Supabase + check localStorage for prior rating
  useEffect(() => {
    const stored = localStorage.getItem("codon_game_rating");
    if (stored) {
      setUserRating(Number(stored));
      setHasRated(true);
    }
    fetchGameStats();
  }, []);

  const fetchGameStats = async () => {
    const { data } = await supabase
      .from("site_settings")
      .select("setting_value")
      .eq("setting_key", "codon_game_stats")
      .single();
    if (data?.setting_value) {
      const val = data.setting_value as any;
      setGameStats({
        total_plays: val.total_plays || 0,
        total_ratings: val.total_ratings || 0,
        rating_sum: val.rating_sum || 0,
      });
    }
  };

  const incrementPlayCount = async () => {
    // Only count once per unique visitor (persisted in localStorage)
    if (localStorage.getItem("codon_game_counted")) return;
    localStorage.setItem("codon_game_counted", "1");

    const { data, error } = await supabase.rpc("increment_codon_play_count");
    if (!error && data) {
      setGameStats(data as any);
    }
  };

  const submitRating = async (rating: number) => {
    setUserRating(rating);
    setHasRated(true);
    localStorage.setItem("codon_game_rating", String(rating));

    const previousRating = Number(localStorage.getItem("codon_game_rating_prev") || "0");
    localStorage.setItem("codon_game_rating_prev", String(rating));

    const { data, error } = await supabase.rpc("submit_codon_rating", {
      new_rating: rating,
      previous_rating: previousRating,
    });
    if (!error && data) {
      setGameStats(data as any);
    }
  };

  const spinWheel = useCallback(() => {
    if (spinning) return;

    setSelectedAnswer(null);
    setIsCorrect(null);
    setShowHint(false);
    setBlurOuterRing(false);
    setSpinning(true);
    incrementPlayCount();

    // Blur the outer ring 3 seconds before the wheel stops (at 1200ms of 4200ms spin)
    blurTimeoutRef.current = setTimeout(() => setBlurOuterRing(true), 1200);

    // Pick the codon first so we can align the wheel
    const codon = getRandomCodon();
    const codonAngle = getCodonAngle(codon);

    // The pointer is at the top (-90° in SVG coordinates).
    // For the codon segment to align with the pointer after rotation R:
    //   (codonAngle + R) mod 360 === -90 mod 360 === 270
    // So target R mod 360 = (270 - codonAngle + 360) % 360
    const target = ((270 - codonAngle) % 360 + 360) % 360;

    // Ensure at least 4 full spins forward, then land on the target angle
    const minRotation = rotation + 1440;
    const remainder = ((minRotation % 360) + 360) % 360;
    const diff = ((target - remainder) % 360 + 360) % 360;
    const newRotation = minRotation + diff + Math.floor(Math.random() * 3) * 360;

    // Play spinning tick sounds
    if (soundEnabled) {
      tickHandlesRef.current.forEach(clearTimeout);
      tickHandlesRef.current = playSpinSound(4000);
    }

    setRotation(newRotation);

    spinTimeoutRef.current = setTimeout(() => {
      setCurrentCodon(codon);
      const aa = CODON_TABLE[codon];
      setChoices(getChoices(aa.full));
      setSpinning(false);
      if (soundEnabled) playLandSound();
    }, 4200);
  }, [spinning, rotation, soundEnabled]);

  const handleAnswer = (answer: string) => {
    if (selectedAnswer || !currentCodon) return;

    if (soundEnabled) playSelectSound();
    setBlurOuterRing(false);

    const correct = CODON_TABLE[currentCodon].full;
    setSelectedAnswer(answer);
    const isRight = answer === correct;
    setIsCorrect(isRight);
    setTotalAttempts((t) => t + 1);

    if (isRight) {
      setScore((s) => s + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > bestStreak) setBestStreak(newStreak);
      // Correct feedback: sound + confetti
      setTimeout(() => {
        if (soundEnabled) playCorrectSound();
        fireConfetti();
      }, 150);
    } else {
      setStreak(0);
      if (soundEnabled) setTimeout(() => playWrongSound(), 150);
    }
  };

  const resetGame = () => {
    setScore(0);
    setTotalAttempts(0);
    setStreak(0);
    setBestStreak(0);
    setCurrentCodon(null);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setChoices([]);
    setRotation(0);
    setShowHint(false);
    setBlurOuterRing(false);
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
  };

  const correctAnswer = currentCodon ? CODON_TABLE[currentCodon] : null;

  return (
    <div className="min-h-screen bg-background">
      <style>{`
        @keyframes gcw-fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .gcw-fade-1 { animation: gcw-fade-up 0.4s ease-out 0.1s both; }
        .gcw-fade-2 { animation: gcw-fade-up 0.4s ease-out 0.2s both; }
        .gcw-fade-3 { animation: gcw-fade-up 0.4s ease-out 0.3s both; }
      `}</style>

      <SEOHead
        title="Free Genetic Code Wheel Game - Interactive Codon Quiz | BioSketch"
        description="Interactive genetic code wheel quiz. Spin the codon wheel and identify amino acids from mRNA triplet sequences. Learn all 64 codons, 20 amino acids, and start/stop signals through play. Free, no signup."
        canonical="https://biosketch.art/genetic-code-wheel"
        keywords="genetic code wheel, codon wheel, amino acid quiz, mRNA codons, molecular biology game, genetics education, codon table interactive, genetic code quiz, biology learning tool"
        structuredData={structuredData}
      />

      {/* Hero Header */}
      <div className="gcw-fade-1 max-w-7xl mx-auto px-4 pt-6">
        <Web3MediaHero
          title="Genetic Code"
          highlightedText="Wheel"
          subtitle="Spin the codon wheel, identify amino acids from mRNA triplet sequences, and master the genetic code through play."
          className="border-2 border-dashed border-border/60"
          glowColor="rgba(16, 185, 129, 0.25)"
          highlightGradient="linear-gradient(90deg, #10b981 0%, #34d399 50%, #10b981 100%)"
          floatingIcons={[
            {
              icon: <Dna className="w-7 h-7 text-emerald-500" />,
              label: "DNA",
              position: { x: "8%", y: "20%" },
            },
            {
              icon: <FlaskConical className="w-7 h-7 text-emerald-500" />,
              label: "Codons",
              position: { x: "86%", y: "22%" },
            },
            {
              icon: <Trophy className="w-7 h-7 text-emerald-500" />,
              label: "Quiz",
              position: { x: "10%", y: "68%" },
            },
            {
              icon: <TestTubes className="w-7 h-7 text-emerald-500" />,
              label: "Amino",
              position: { x: "84%", y: "65%" },
            },
          ]}
        >
          <div className="flex flex-col items-center text-center max-w-4xl px-4 py-14 md:py-16 gap-5">
            <h1 className="font-serif font-semibold text-foreground tracking-tight"
              style={{ fontSize: "clamp(32px, 5vw, 56px)", lineHeight: "1.15" }}
            >
              Genetic Code
              <br />
              <span className="text-primary">
                Wheel
              </span>
            </h1>
            <p className="text-muted-foreground max-w-lg leading-relaxed" style={{ fontSize: "clamp(14px, 2vw, 16px)" }}>
              Spin the codon wheel, identify amino acids from mRNA triplet sequences, and master the genetic code through play.
            </p>

            {/* Controls row */}
            <div className="flex items-center gap-3 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/")}
                className="rounded-xl border-border/40 bg-card/40 backdrop-blur-sm"
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Back
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl border-border/40 bg-card/40 backdrop-blur-sm"
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={soundEnabled ? "Mute sounds" : "Enable sounds"}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={resetGame}
                className="rounded-xl border-border/40 bg-card/40 backdrop-blur-sm"
              >
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Reset
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const svgEl = document.querySelector('.gcw-fade-2 svg[viewBox="0 0 500 500"]');
                  if (!svgEl) return;
                  const clone = svgEl.cloneNode(true) as SVGSVGElement;
                  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                  clone.removeAttribute('style'); // remove rotation transform
                  const data = new XMLSerializer().serializeToString(clone);
                  sessionStorage.setItem('codon_svg_import', data);
                  navigate('/canvas');
                }}
                className="rounded-xl border-border/40 bg-card/40 backdrop-blur-sm"
              >
                <Palette className="h-4 w-4 mr-1.5" />
                Open in Canvas
              </Button>
            </div>
          </div>
        </Web3MediaHero>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[220px,1fr,340px] gap-6">
          {/* Left Sidebar — Quote, Community Stats & Rating */}
          <div className="space-y-5 lg:sticky lg:top-6 lg:self-start gcw-fade-2">
            {/* Inspirational Quote */}
            <div className="group rounded-xl border-2 border-dashed border-border/60 hover:border-border bg-card/60 p-4 space-y-2.5 transition-all duration-300 hover:shadow-lg relative overflow-hidden">
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-0 group-hover:opacity-[0.015] transition-opacity duration-500 pointer-events-none"
                style={{
                  backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--foreground)) 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              />
              <p className="relative z-10 text-sm font-semibold italic text-foreground leading-relaxed">
                "Believe nothing you hear, and only one half that you see."
              </p>
              <div className="relative z-10 text-[11px] text-muted-foreground space-y-1">
                <p className="font-medium">— Edgar Allan Poe</p>
                <p className="leading-relaxed">
                  From the short story <span className="italic">The System of Dr. Tarr and Prof. Fether</span> (1845). This quote reflects a skeptical view of perception, suggesting that one should be cautious about accepting information from others and even their own observations.
                </p>
              </div>
            </div>

            {/* Community Stats & Rating */}
            <div className="group rounded-xl border-2 border-dashed border-border/60 hover:border-border bg-card/60 p-5 space-y-4 transition-all duration-300 hover:shadow-lg relative overflow-hidden">
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-0 group-hover:opacity-[0.015] transition-opacity duration-500 pointer-events-none"
                style={{
                  backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--foreground)) 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              />
              <div className="relative z-10">
                {/* Decoders Count */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Community</span>
                  </div>
                </div>
                <div className="text-center py-2">
                  <div className="text-3xl font-bold text-foreground">{gameStats.total_plays.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground mt-1">decoders thus far</div>
                </div>

              </div>
            </div>

            {/* Quick Reference */}
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground font-medium py-1 transition-colors duration-200">
                All 20 Amino Acids
              </summary>
              <div className="mt-2 grid grid-cols-1 gap-0.5 p-3 rounded-xl bg-card/60 border-2 border-dashed border-border/60">
                {ALL_AMINO_ACIDS.filter((a) => a !== "Stop").map((aa) => {
                  const info = Object.values(CODON_TABLE).find((v) => v.full === aa);
                  return (
                    <div key={aa} className="flex items-center justify-between px-1 py-0.5">
                      <span className="truncate">{aa}</span>
                      <span className="font-mono ml-1">{info?.one}</span>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between px-1 py-0.5 border-t border-dashed border-border/30 mt-1 pt-1">
                  <span>Stop</span>
                  <span className="font-mono">*</span>
                </div>
              </div>
            </details>
          </div>

          {/* Center — Wheel */}
          <div className="space-y-6 gcw-fade-2">
            {/* Instructions */}
            <div className="text-center space-y-1">
              <p className="text-sm text-muted-foreground">
                Read the triplet sequence from the <strong>center outwards</strong> (5' → 3'). mRNA notation shown (replace U with T for DNA).
              </p>
            </div>

            {/* Wheel */}
            <div className="relative">
              {/* Pointer */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
                <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[18px] border-l-transparent border-r-transparent border-t-primary" />
              </div>

              <CodonWheel
                rotation={rotation}
                spinning={spinning}
                highlightCodon={currentCodon && !spinning ? currentCodon : null}
                blurOuter={blurOuterRing}
              />
            </div>

            {/* Spin Button */}
            <div className="text-center">
              <button
                onClick={spinWheel}
                disabled={spinning}
                className={cn(
                  "relative inline-flex items-center gap-2.5 px-10 h-13 rounded-xl text-base font-semibold",
                  "bg-card/60 backdrop-blur-sm",
                  "border-2 border-dashed border-border/60 hover:border-border",
                  "shadow-sm hover:shadow-lg",
                  "text-foreground",
                  "transition-all duration-300 ease-out",
                  "hover:scale-[1.03] hover:-translate-y-0.5",
                  "active:scale-[0.97]",
                  "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0",
                  spinning && "animate-pulse"
                )}
              >
                <RotateCcw className={cn("h-5 w-5", spinning && "animate-spin")} />
                {spinning ? "Spinning..." : currentCodon && !selectedAnswer ? "Spin Again" : "Spin the Wheel"}
              </button>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-3">
              {BASES.map((base) => (
                <div key={base} className="flex items-center gap-1.5">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: BASE_COLORS[base].bg }}
                  />
                  <span className="text-xs text-muted-foreground font-medium">
                    {base} — {base === "U" ? "Uracil" : base === "C" ? "Cytosine" : base === "A" ? "Adenine" : "Guanine"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Quiz & Score */}
          <div className="space-y-5 gcw-fade-3">
            {/* Score Card */}
            <div className="group rounded-xl border-2 border-dashed border-border/60 hover:border-border bg-card/60 p-5 transition-all duration-300 hover:shadow-lg relative overflow-hidden">
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-0 group-hover:opacity-[0.015] transition-opacity duration-500 pointer-events-none"
                style={{
                  backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--foreground)) 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Score</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {totalAttempts > 0
                      ? `${Math.round((score / totalAttempts) * 100)}%`
                      : "—"}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-2xl font-bold text-foreground">{score}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Correct</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">{totalAttempts}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Attempts</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-primary">{bestStreak}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Best Streak</div>
                  </div>
                </div>
                {streak >= 3 && (
                  <div className="mt-3 text-center text-sm font-medium text-primary">
                    {streak} in a row!
                  </div>
                )}
              </div>
            </div>

            {/* Quiz Card */}
            {currentCodon && !spinning ? (
              <div className="group rounded-xl border-2 border-dashed border-border/60 hover:border-border bg-card/60 p-5 space-y-4 transition-all duration-300 hover:shadow-lg relative overflow-hidden">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 opacity-0 group-hover:opacity-[0.015] transition-opacity duration-500 pointer-events-none"
                  style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--foreground)) 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                  }}
                />
                <div className="relative z-10 space-y-4">
                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">What amino acid does this codon code for?</p>
                    <div className="flex items-center justify-center gap-1">
                      {currentCodon.split("").map((base, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-lg font-bold text-white"
                          style={{ backgroundColor: BASE_COLORS[base].bg }}
                        >
                          {base}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      DNA equivalent: {currentCodon.replace(/U/g, "T")}
                    </p>
                  </div>

                  {/* Hint */}
                  {!selectedAnswer && (
                    <button
                      onClick={() => setShowHint(!showHint)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mx-auto transition-colors duration-200"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      {showHint ? "Hide hint" : "Show hint"}
                    </button>
                  )}
                  {showHint && !selectedAnswer && correctAnswer && (
                    <p className="text-xs text-center text-muted-foreground italic">
                      One-letter code: {correctAnswer.one}
                    </p>
                  )}

                  {/* Answer Choices */}
                  <div className="grid grid-cols-1 gap-2">
                    {choices.map((choice) => {
                      const aa = Object.values(CODON_TABLE).find((v) => v.full === choice);
                      let extraClass = "hover:bg-muted/50 border-border/60";

                      if (selectedAnswer) {
                        if (choice === correctAnswer?.full) {
                          extraClass = "bg-green-50 border-green-500 text-green-700 dark:bg-green-950 dark:text-green-400";
                        } else if (choice === selectedAnswer && !isCorrect) {
                          extraClass = "bg-red-50 border-red-500 text-red-700 dark:bg-red-950 dark:text-red-400";
                        } else {
                          extraClass = "opacity-50 border-border/60";
                        }
                      }

                      return (
                        <button
                          key={choice}
                          onClick={() => handleAnswer(choice)}
                          disabled={!!selectedAnswer}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border-2 border-dashed text-left text-sm transition-all duration-200",
                            extraClass
                          )}
                        >
                          <span className="font-medium">{choice}</span>
                          <span className="text-xs text-muted-foreground">
                            {aa?.three} ({aa?.one})
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Result + Facts */}
                  {selectedAnswer && correctAnswer && (
                    <div className="space-y-3">
                      <p
                        className={cn(
                          "text-sm font-semibold text-center",
                          isCorrect ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                        )}
                      >
                        {isCorrect ? "Correct!" : `Incorrect — it's ${correctAnswer.full} (${correctAnswer.three})`}
                      </p>

                      {/* Amino Acid Facts */}
                      {AMINO_ACID_FACTS[correctAnswer.full] && (
                        <div className="rounded-xl bg-card/60 border-2 border-dashed border-border/60 p-3.5 space-y-2 text-xs animate-fade-in">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="font-bold text-sm text-foreground">{correctAnswer.full}</span>
                            <span className="text-muted-foreground font-mono">({correctAnswer.three} / {correctAnswer.one})</span>
                          </div>
                          <div className="space-y-1.5">
                            <div>
                              <span className="font-semibold text-muted-foreground">Type: </span>
                              <span className="text-foreground">{AMINO_ACID_FACTS[correctAnswer.full].property}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-muted-foreground">Role: </span>
                              <span className="text-foreground">{AMINO_ACID_FACTS[correctAnswer.full].role}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-muted-foreground">Codons: </span>
                              <span className="font-mono text-foreground">{AMINO_ACID_FACTS[correctAnswer.full].codons.join(", ")}</span>
                            </div>
                            <div className="pt-1.5 border-t border-dashed border-border/50 italic text-muted-foreground">
                              {AMINO_ACID_FACTS[correctAnswer.full].funFact}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-center gap-3 pt-1">
                        <button
                          onClick={spinWheel}
                          className={cn(
                            "inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold",
                            "bg-card/60 backdrop-blur-sm",
                            "border-2 border-dashed border-border/60 hover:border-border",
                            "shadow-sm hover:shadow-lg",
                            "text-foreground",
                            "transition-all duration-300 ease-out",
                            "hover:scale-[1.04] hover:-translate-y-0.5",
                            "active:scale-[0.96]",
                            "animate-fade-in"
                          )}
                        >
                          <RotateCcw className="h-4 w-4" />
                          Spin Again
                        </button>
                        <button
                          onClick={spinWheel}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold",
                            "bg-primary/80 backdrop-blur-sm",
                            "border-2 border-primary/40",
                            "shadow-sm hover:shadow-lg",
                            "text-primary-foreground",
                            "transition-all duration-300 ease-out",
                            "hover:bg-primary/90 hover:scale-[1.04] hover:-translate-y-0.5",
                            "active:scale-[0.96]",
                            "animate-fade-in [animation-delay:100ms]"
                          )}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              !spinning && (
                <div className="rounded-xl border-2 border-dashed border-border/60 bg-card/60 p-8 text-center space-y-3 transition-all duration-300">
                  <Dna className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    Spin the wheel to get a codon and test your knowledge!
                  </p>
                </div>
              )
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
