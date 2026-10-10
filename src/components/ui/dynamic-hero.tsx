import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface RgbColor {
    r: number;
    g: number;
    b: number;
}

const parseRgbColor = (colorString: string): RgbColor | null => {
    if (!colorString) return null;
    const match = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
    if (match) {
        return {
            r: parseInt(match[1], 10),
            g: parseInt(match[2], 10),
            b: parseInt(match[3], 10),
        };
    }
    return null;
};

const PlayIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 5V19L19 12L8 5Z" />
    </svg>
);

export interface NavItem {
    id: string;
    label: string;
    href?: string;
    target?: string;
    onClick?: () => void;
}

type LineStyle = 'solid' | 'dashed' | 'dotted';

const LINE_STYLES: { id: LineStyle; label: string; dash: number[] }[] = [
    { id: 'solid', label: 'Solid', dash: [] },
    { id: 'dashed', label: 'Dashed', dash: [10, 5] },
    { id: 'dotted', label: 'Dotted', dash: [2, 4] },
];

interface HeroSectionProps {
    heading?: string;
    tagline?: string;
    buttonText?: string;
    imageUrl?: string;
    videoUrl?: string;
    navItems?: NavItem[];
    onButtonClick?: () => void;
}

const HeroSection = ({
    heading = "Something you really want",
    tagline = "You can't live without this product. I'm sure of it.",
    buttonText = "Get Started",
    imageUrl,
    videoUrl,
    navItems = [],
    onButtonClick,
}: HeroSectionProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const targetRef = useRef<HTMLButtonElement>(null);
    const mousePosRef = useRef<{ x: number | null; y: number | null }>({ x: null, y: null });
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
    const animationFrameIdRef = useRef<number | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [showVideo, setShowVideo] = useState(!!videoUrl);
    const [lineStyle, setLineStyle] = useState<LineStyle>('dashed');
    const lineStyleRef = useRef<LineStyle>('dashed');
    const [userCount, setUserCount] = useState<number | null>(null);
    const [recentAvatars, setRecentAvatars] = useState<(string | null)[]>([]);

    // Fetch social proof data
    useEffect(() => {
        supabase.rpc('get_user_count').then(({ data }) => {
            if (typeof data === 'number') setUserCount(data);
        });
        supabase
            .from('public_profiles')
            .select('avatar_url')
            .not('avatar_url', 'is', null)
            .order('created_at', { ascending: false })
            .limit(5)
            .then(({ data }) => {
                if (data) setRecentAvatars(data.map(d => d.avatar_url));
            });
    }, []);

    // Keep ref in sync so animation loop reads current value without dependency
    useEffect(() => {
        lineStyleRef.current = lineStyle;
    }, [lineStyle]);

    const resolvedCanvasColorsRef = useRef<{ strokeStyle: RgbColor }>({
        strokeStyle: { r: 128, g: 128, b: 128 },
    });

    useEffect(() => {
        const tempElement = document.createElement('div');
        tempElement.style.display = 'none';
        document.body.appendChild(tempElement);

        const updateResolvedColors = () => {
            tempElement.style.color = 'var(--foreground)';
            const computedFgColor = getComputedStyle(tempElement).color;
            const parsedFgColor = parseRgbColor(computedFgColor);
            if (parsedFgColor) {
                resolvedCanvasColorsRef.current.strokeStyle = parsedFgColor;
            } else {
                const isDarkMode = document.documentElement.classList.contains('dark');
                resolvedCanvasColorsRef.current.strokeStyle = isDarkMode ? { r: 250, g: 250, b: 250 } : { r: 10, g: 10, b: 10 };
            }
        };
        updateResolvedColors();
        const observer = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class' && mutation.target === document.documentElement) {
                    updateResolvedColors();
                    break;
                }
            }
        });
        observer.observe(document.documentElement, { attributes: true });
        return () => {
            observer.disconnect();
            if (tempElement.parentNode) {
                tempElement.parentNode.removeChild(tempElement);
            }
        };
    }, []);

    const drawArrow = useCallback(() => {
        if (!canvasRef.current || !targetRef.current || !ctxRef.current) return;

        const targetEl = targetRef.current;
        const ctx = ctxRef.current;
        const mouse = mousePosRef.current;

        const x0 = mouse.x;
        const y0 = mouse.y;

        if (x0 === null || y0 === null) return;

        const rect = targetEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const a = Math.atan2(cy - y0, cx - x0);
        const x1 = cx - Math.cos(a) * (rect.width / 2 + 12);
        const y1 = cy - Math.sin(a) * (rect.height / 2 + 12);

        const midX = (x0 + x1) / 2;
        const midY = (y0 + y1) / 2;
        const offset = Math.min(200, Math.hypot(x1 - x0, y1 - y0) * 0.5);
        const t = Math.max(-1, Math.min(1, (y0 - y1) / 200));
        const controlX = midX;
        const controlY = midY + offset * t;

        const r = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
        const opacity = Math.min(1.0, (r - Math.max(rect.width, rect.height) / 2) / 500);

        const arrowColor = resolvedCanvasColorsRef.current.strokeStyle;
        ctx.strokeStyle = `rgba(${arrowColor.r}, ${arrowColor.g}, ${arrowColor.b}, ${opacity})`;
        ctx.lineWidth = 2;

        // Get dash pattern from current line style
        const currentStyle = LINE_STYLES.find(s => s.id === lineStyleRef.current);
        const dashPattern = currentStyle?.dash ?? [10, 5];

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(controlX, controlY, x1, y1);
        ctx.setLineDash(dashPattern);
        ctx.stroke();
        ctx.restore();

        // Glowing yellow circle at cursor tip
        ctx.save();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(x0, y0, 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(250, 204, 21, ${Math.min(0.9, opacity + 0.3)})`;
        ctx.fill();
        // Outer glow
        ctx.beginPath();
        ctx.arc(x0, y0, 20, 0, Math.PI * 2);
        const glow = ctx.createRadialGradient(x0, y0, 3, x0, y0, 20);
        glow.addColorStop(0, `rgba(250, 204, 21, ${Math.min(0.4, opacity + 0.1)})`);
        glow.addColorStop(1, 'rgba(250, 204, 21, 0)');
        ctx.fillStyle = glow;
        ctx.fill();
        ctx.restore();

        // Arrowhead (always solid)
        const angle = Math.atan2(y1 - controlY, x1 - controlX);
        const headLength = 10 * (ctx.lineWidth / 1.5);
        ctx.beginPath();
        ctx.setLineDash([]);
        ctx.moveTo(x1, y1);
        ctx.lineTo(
            x1 - headLength * Math.cos(angle - Math.PI / 6),
            y1 - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(x1, y1);
        ctx.lineTo(
            x1 - headLength * Math.cos(angle + Math.PI / 6),
            y1 - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !targetRef.current) return;

        ctxRef.current = canvas.getContext("2d");
        const ctx = ctxRef.current;

        const updateCanvasSize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };

        const handleMouseMove = (e: MouseEvent) => {
            mousePosRef.current = { x: e.clientX, y: e.clientY };
        };

        window.addEventListener("resize", updateCanvasSize);
        window.addEventListener("mousemove", handleMouseMove);
        updateCanvasSize();

        const animateLoop = () => {
            if (ctx && canvas) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                drawArrow();
            }
            animationFrameIdRef.current = requestAnimationFrame(animateLoop);
        };

        animateLoop();

        return () => {
            window.removeEventListener("resize", updateCanvasSize);
            window.removeEventListener("mousemove", handleMouseMove);
            if (animationFrameIdRef.current) {
                cancelAnimationFrame(animationFrameIdRef.current);
            }
        };
    }, [drawArrow]);

    useEffect(() => {
        const videoElement = videoRef.current;
        if (videoElement && videoUrl) {
            const handleVideoEnd = () => {
                setShowVideo(false);
                videoElement.currentTime = 0;
            };

            if (showVideo) {
                videoElement.play().catch(error => {
                    console.error("HeroSection: Error playing video:", error);
                    setShowVideo(false);
                });
                videoElement.addEventListener('ended', handleVideoEnd);
            } else {
                videoElement.pause();
            }

            return () => {
                videoElement.removeEventListener('ended', handleVideoEnd);
            };
        }
    }, [showVideo, videoUrl]);

    const handlePlayButtonClick = () => {
        if (videoUrl) {
            setShowVideo(true);
        }
    };

    return (
        <div className="bg-background text-foreground flex flex-col">
            <style>{`
                @keyframes hero-fade-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .hero-fade-up {
                    animation: hero-fade-up 0.7s ease-out both;
                }
                .hero-fade-up-delay-1 { animation-delay: 0.1s; }
                .hero-fade-up-delay-2 { animation-delay: 0.25s; }
                .hero-fade-up-delay-3 { animation-delay: 0.4s; }
                .hero-fade-up-delay-4 { animation-delay: 0.55s; }
            `}</style>
            {navItems.length > 0 && (
                <nav className="w-full max-w-screen-md mx-auto flex flex-wrap justify-center sm:justify-between items-center px-4 sm:px-8 py-4 text-sm">
                    {navItems.map((item) => {
                        const commonProps = {
                            key: item.id,
                            className: "py-2 px-3 sm:px-4 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/10 dark:hover:bg-accent/20 focus:outline-none focus:ring-2 focus:ring-ring transition-colors duration-150 ease-in-out whitespace-nowrap",
                            onClick: item.onClick,
                        };
                        if (item.href) {
                            return (
                                <a key={item.id} href={item.href} target={item.target} rel={item.target === '_blank' ? 'noopener noreferrer' : undefined} className={commonProps.className} onClick={commonProps.onClick}>
                                    {item.label}
                                </a>
                            );
                        }
                        return (
                            <button key={item.id} type="button" className={commonProps.className} onClick={commonProps.onClick}>
                                {item.label}
                            </button>
                        );
                    })}
                </nav>
            )}

            <main className="flex-grow flex flex-col items-center justify-center">
                <div className="mt-8 sm:mt-10 lg:mt-14 flex flex-col items-center relative overflow-hidden px-4 py-8">
                    {/* Badge */}
                    <div className="hero-fade-up relative z-10 mb-4">
                        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold border border-primary/30 bg-primary/10 text-primary">
                            Free &amp; Open Source
                        </span>
                    </div>

                    <h1 className="hero-fade-up hero-fade-up-delay-1 text-foreground text-6xl sm:text-7xl lg:text-8xl font-extrabold text-center tracking-tighter leading-[1.0] relative z-10 max-w-4xl">
                        {heading}
                    </h1>
                    <p className="hero-fade-up hero-fade-up-delay-2 mt-5 block text-muted-foreground/90 text-center text-lg sm:text-xl lg:text-2xl max-w-2xl leading-relaxed relative z-10">
                        {tagline}
                    </p>
                </div>

                {/* CTA buttons */}
                <div className="hero-fade-up hero-fade-up-delay-3 mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                        ref={targetRef}
                        onClick={onButtonClick}
                        className="group relative py-3 px-8 rounded-xl bg-foreground text-background text-base font-semibold transition-all duration-200 hover:opacity-90 hover:shadow-lg hover:shadow-foreground/10 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                    >
                        <span className="flex items-center gap-2">
                            {buttonText}
                            <svg className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                        </span>
                    </button>
                    <a
                        href="/auth"
                        className="py-2.5 px-6 rounded-xl border border-border/80 hover:border-border bg-card/50 hover:bg-card text-foreground transition-all duration-200 flex items-center gap-2.5 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                    >
                        <svg width="18" height="18" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                            <path d="M256 128c0 70.7-57.3 128-128 128S0 198.7 0 128 57.3 0 128 0s128 57.3 128 128z" fill="#A6CE39"/>
                            <path d="M86.3 186.2H70.9V79.1h15.4v107.1zM108.9 79.1h41.6c39.6 0 57 28.3 57 53.6 0 27.5-21.5 53.6-56.8 53.6h-41.8V79.1zm15.4 93.3h24.5c34.9 0 42.9-26.5 42.9-39.7C191.7 111.2 178 93 149 93h-24.7v79.4zM88.7 56.8c0 5.5-4.5 10.1-10.1 10.1s-10.1-4.6-10.1-10.1c0-5.6 4.5-10.1 10.1-10.1s10.1 4.6 10.1 10.1z" fill="#fff"/>
                        </svg>
                        <span className="text-sm font-medium">Sign in with ORCID</span>
                    </a>
                </div>

                {/* Line style picker */}
                <div className="hero-fade-up hero-fade-up-delay-3 mt-5 flex items-center gap-1 rounded-full border border-border/40 bg-card/60 backdrop-blur-md p-1 shadow-sm">
                    {LINE_STYLES.map((style) => (
                        <button
                            key={style.id}
                            onClick={() => setLineStyle(style.id)}
                            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                                lineStyle === style.id
                                    ? 'bg-foreground text-background shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                            title={`${style.label} line`}
                        >
                            <svg width="20" height="6" viewBox="0 0 20 6" className="shrink-0">
                                <line
                                    x1="0" y1="3" x2="20" y2="3"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeDasharray={
                                        style.id === 'dashed' ? '5,3' :
                                        style.id === 'dotted' ? '1.5,3' :
                                        'none'
                                    }
                                />
                            </svg>
                            <span>{style.label}</span>
                        </button>
                    ))}
                </div>

                {/* Social proof */}
                {userCount !== null && (
                    <div className="hero-fade-up hero-fade-up-delay-4 mt-8 flex items-center gap-3 px-4 py-2.5 rounded-full border border-border/30 bg-card/40 backdrop-blur-sm">
                        <div className="flex items-center -space-x-2.5">
                            {recentAvatars.slice(0, 5).map((url, i) => (
                                <div
                                    key={i}
                                    className="w-7 h-7 rounded-full border-2 border-background overflow-hidden bg-muted shadow-sm ring-1 ring-border/20"
                                >
                                    {url ? (
                                        <img src={url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                                            <Users className="w-3 h-3 text-primary" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="h-4 w-px bg-border/50" />
                        <p className="text-sm text-muted-foreground">
                            Join <span className="font-semibold text-foreground">{userCount.toLocaleString()}+</span> scientists
                        </p>
                    </div>
                )}

                <div className="hero-fade-up hero-fade-up-delay-4 mt-14 lg:mt-18 w-full max-w-3xl mx-auto overflow-hidden px-4 sm:px-2">
                    <div
                        className="group/card rounded-[1.5rem] p-[1.5px] transition-all duration-500 hover:scale-[1.01]"
                        style={{
                            background: 'linear-gradient(135deg, hsl(var(--primary) / 0.3), rgba(180, 180, 180, 0.2), hsl(var(--primary) / 0.15), rgba(200, 200, 200, 0.2), hsl(var(--primary) / 0.3))',
                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06), 0 16px 48px rgba(0, 0, 0, 0.1), 0 0 60px hsl(var(--primary) / 0.08)',
                        }}
                    >
                        <div className="relative aspect-video rounded-[calc(1.5rem-1.5px)] bg-card flex items-center justify-center overflow-hidden">
                            {imageUrl && (
                                <img
                                    src={imageUrl}
                                    alt="Preview"
                                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
                                        showVideo ? 'opacity-0 pointer-events-none' : 'opacity-100'
                                    }`}
                                />
                            )}
                            {videoUrl && (
                                <video
                                    ref={videoRef}
                                    src={videoUrl}
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                    className={`w-full h-full object-cover transition-opacity duration-500 ${
                                        showVideo ? 'opacity-100' : 'opacity-0 pointer-events-none'
                                    }`}
                                />
                            )}
                            {!showVideo && videoUrl && imageUrl && (
                                <button
                                    onClick={handlePlayButtonClick}
                                    className="absolute bottom-4 left-4 sm:bottom-5 sm:left-5 z-20 p-3 sm:p-3.5 bg-background/60 hover:bg-background/80 text-foreground backdrop-blur-xl rounded-full transition-all duration-300 shadow-xl ring-1 ring-white/10 hover:ring-white/20 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring"
                                    aria-label="Play video"
                                >
                                    <PlayIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                                </button>
                            )}
                            {!imageUrl && !videoUrl && (
                                <div className="text-muted-foreground italic">Card Content Area</div>
                            )}
                        </div>
                    </div>
                </div>
                {/* AI Illustrator Features Carousel */}
                <div className="hero-fade-up hero-fade-up-delay-4 mt-16 w-full max-w-4xl mx-auto px-4">
                    <div className="text-center mb-6">
                        <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                            AI-Powered Illustration
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">Create publication-quality figures in seconds</p>
                    </div>
                    <style>{`
                        @keyframes ai-scroll {
                            0% { transform: translateX(0); }
                            100% { transform: translateX(-50%); }
                        }
                        .ai-carousel-track {
                            animation: ai-scroll 30s linear infinite;
                        }
                        .ai-carousel-track:hover {
                            animation-play-state: paused;
                        }
                    `}</style>
                    <div className="overflow-hidden rounded-2xl">
                        <div className="ai-carousel-track flex gap-4 w-max">
                            {[
                                { name: "Icon Generator", desc: "Generate scientific icons from text descriptions", icon: "🧬" },
                                { name: "Photo to 2D", desc: "Convert photographs into flat 2D illustrations", icon: "📷" },
                                { name: "Sketch to Illustration", desc: "Transform hand-drawn sketches into clean art", icon: "✏️" },
                                { name: "Text to Figure", desc: "Generate scientific schematics from descriptions", icon: "📝" },
                                { name: "Image to Figure", desc: "Convert images into publication-quality figures", icon: "🔄" },
                                { name: "Illustration Enhancer", desc: "Sharpen and refine illustrations to HD quality", icon: "✨" },
                                { name: "Reference to Figure", desc: "Convert reference images to 2D vector figures", icon: "🖼️" },
                                { name: "Icon Generator", desc: "Generate scientific icons from text descriptions", icon: "🧬" },
                                { name: "Photo to 2D", desc: "Convert photographs into flat 2D illustrations", icon: "📷" },
                                { name: "Sketch to Illustration", desc: "Transform hand-drawn sketches into clean art", icon: "✏️" },
                                { name: "Text to Figure", desc: "Generate scientific schematics from descriptions", icon: "📝" },
                                { name: "Image to Figure", desc: "Convert images into publication-quality figures", icon: "🔄" },
                                { name: "Illustration Enhancer", desc: "Sharpen and refine illustrations to HD quality", icon: "✨" },
                                { name: "Reference to Figure", desc: "Convert reference images to 2D vector figures", icon: "🖼️" },
                            ].map((feature, i) => (
                                <a
                                    key={i}
                                    href="/ai-illustrator"
                                    className="flex-shrink-0 w-[220px] rounded-xl border border-border/40 bg-card/80 backdrop-blur-sm p-4 hover:border-primary/40 hover:shadow-lg transition-all duration-200 group"
                                >
                                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-lg mb-3 group-hover:scale-110 transition-transform">
                                        {feature.icon}
                                    </div>
                                    <h3 className="text-sm font-semibold text-foreground mb-1">{feature.name}</h3>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">{feature.desc}</p>
                                </a>
                            ))}
                        </div>
                    </div>
                    <div className="text-center mt-5">
                        <a
                            href="/ai-illustrator"
                            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
                        >
                            Try AI Illustrator
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                        </a>
                    </div>
                </div>

            </main>
            <div className="h-8 sm:h-10 md:h-12"></div>
            <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-10"></canvas>
        </div>
    );
};

export { HeroSection };
