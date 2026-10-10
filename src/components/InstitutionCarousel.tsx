import brown from "@/assets/institutions/brown.png";
import harvardMed from "@/assets/institutions/harvard-med.png";
import ucsd from "@/assets/institutions/uc-san-diego.png";
import upenn from "@/assets/institutions/upenn.png";
import yaleMed from "@/assets/institutions/yale-med.png";

export function InstitutionCarousel() {
  const institutions = [
    { name: "Brown University", logo: brown },
    { name: "Harvard Medical School", logo: harvardMed },
    { name: "UC San Diego", logo: ucsd },
    { name: "University of Pennsylvania", logo: upenn },
    { name: "Yale School of Medicine", logo: yaleMed },
  ];

  // Duplicate institutions array for seamless loop
  const duplicatedInstitutions = [...institutions, ...institutions];

  return (
    <div className="py-12 animate-fade-in [animation-delay:200ms] overflow-hidden bg-[hsl(var(--cream))]">
      <div className="max-w-7xl mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-semibold font-source-serif mb-2">
            <span className="highlighter-bg">Trusted by Scientists</span>
          </h2>
          <p className="text-lg handwritten text-muted-foreground">
            ~ From leading research institutions worldwide ~
          </p>
        </div>
        
        {/* Marquee Container */}
        <div className="relative">
          {/* Gradient Overlays */}
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[hsl(var(--cream))] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[hsl(var(--cream))] to-transparent z-10 pointer-events-none" />
          
          {/* Scrolling Content */}
          <div className="flex gap-8 animate-marquee hover:[animation-play-state:paused]">
            {duplicatedInstitutions.map((inst, index) => {
              const rotation = (index % 2 === 0 ? -1.5 : 1.5) + (index % 3) * 0.5;
              return (
                <div
                  key={index}
                  className="flex-shrink-0 w-56"
                  style={{ transform: `rotate(${rotation}deg)` }}
                >
                  <div className="relative p-6 bg-background border-2 border-[hsl(var(--pencil-gray))] paper-shadow hover:scale-105 hover:rotate-0 transition-all duration-300 group">
                    {/* Washi tape decoration */}
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-16 h-6 bg-[hsl(var(--highlighter-yellow)_/_0.6)] border border-[hsl(var(--highlighter-yellow))] rotate-[-3deg]" />
                    
                    {/* Logo container */}
                    <div className="h-20 flex items-center justify-center mt-2">
                      <img
                        src={inst.logo}
                        alt={inst.name}
                        className="max-h-16 max-w-full object-contain opacity-80 group-hover:opacity-100 transition-all duration-300"
                      />
                    </div>
                    
                    {/* Institution name in handwritten font */}
                    <p className="text-center mt-3 text-xs font-medium text-muted-foreground handwritten">
                      {inst.name}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
