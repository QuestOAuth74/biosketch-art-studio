import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Globe, FlaskConical } from 'lucide-react';

interface StatItem {
  label: string;
  count: number;
  percentage: number;
}

const COUNTRY_FLAGS: Record<string, string> = {
  "Afghanistan": "🇦🇫", "Albania": "🇦🇱", "Algeria": "🇩🇿", "Andorra": "🇦🇩", "Angola": "🇦🇴",
  "Argentina": "🇦🇷", "Armenia": "🇦🇲", "Australia": "🇦🇺", "Austria": "🇦🇹", "Azerbaijan": "🇦🇿",
  "Bahamas": "🇧🇸", "Bahrain": "🇧🇭", "Bangladesh": "🇧🇩", "Barbados": "🇧🇧", "Belarus": "🇧🇾",
  "Belgium": "🇧🇪", "Belize": "🇧🇿", "Benin": "🇧🇯", "Bhutan": "🇧🇹", "Bolivia": "🇧🇴",
  "Bosnia and Herzegovina": "🇧🇦", "Botswana": "🇧🇼", "Brazil": "🇧🇷", "Brunei": "🇧🇳",
  "Bulgaria": "🇧🇬", "Burkina Faso": "🇧🇫", "Burundi": "🇧🇮", "Cabo Verde": "🇨🇻",
  "Cambodia": "🇰🇭", "Cameroon": "🇨🇲", "Canada": "🇨🇦", "Chad": "🇹🇩", "Chile": "🇨🇱",
  "China": "🇨🇳", "Colombia": "🇨🇴", "Congo": "🇨🇬", "Costa Rica": "🇨🇷", "Croatia": "🇭🇷",
  "Cuba": "🇨🇺", "Cyprus": "🇨🇾", "Czech Republic": "🇨🇿", "Denmark": "🇩🇰",
  "Dominican Republic": "🇩🇴", "Ecuador": "🇪🇨", "Egypt": "🇪🇬", "El Salvador": "🇸🇻",
  "Estonia": "🇪🇪", "Ethiopia": "🇪🇹", "Fiji": "🇫🇯", "Finland": "🇫🇮", "France": "🇫🇷",
  "Gabon": "🇬🇦", "Gambia": "🇬🇲", "Georgia": "🇬🇪", "Germany": "🇩🇪", "Ghana": "🇬🇭",
  "Greece": "🇬🇷", "Guatemala": "🇬🇹", "Guinea": "🇬🇳", "Guyana": "🇬🇾", "Haiti": "🇭🇹",
  "Honduras": "🇭🇳", "Hungary": "🇭🇺", "Iceland": "🇮🇸", "India": "🇮🇳", "Indonesia": "🇮🇩",
  "Iran": "🇮🇷", "Iraq": "🇮🇶", "Ireland": "🇮🇪", "Israel": "🇮🇱", "Italy": "🇮🇹",
  "Jamaica": "🇯🇲", "Japan": "🇯🇵", "Jordan": "🇯🇴", "Kazakhstan": "🇰🇿", "Kenya": "🇰🇪",
  "Kuwait": "🇰🇼", "Kyrgyzstan": "🇰🇬", "Laos": "🇱🇦", "Latvia": "🇱🇻", "Lebanon": "🇱🇧",
  "Liberia": "🇱🇷", "Libya": "🇱🇾", "Lithuania": "🇱🇹", "Luxembourg": "🇱🇺",
  "Madagascar": "🇲🇬", "Malawi": "🇲🇼", "Malaysia": "🇲🇾", "Maldives": "🇲🇻", "Mali": "🇲🇱",
  "Malta": "🇲🇹", "Mauritius": "🇲🇺", "Mexico": "🇲🇽", "Moldova": "🇲🇩", "Monaco": "🇲🇨",
  "Mongolia": "🇲🇳", "Montenegro": "🇲🇪", "Morocco": "🇲🇦", "Mozambique": "🇲🇿",
  "Myanmar": "🇲🇲", "Namibia": "🇳🇦", "Nepal": "🇳🇵", "Netherlands": "🇳🇱",
  "New Zealand": "🇳🇿", "Nicaragua": "🇳🇮", "Niger": "🇳🇪", "Nigeria": "🇳🇬", "Norway": "🇳🇴",
  "Oman": "🇴🇲", "Pakistan": "🇵🇰", "Palestine": "🇵🇸", "Panama": "🇵🇦", "Paraguay": "🇵🇾",
  "Peru": "🇵🇪", "Philippines": "🇵🇭", "Poland": "🇵🇱", "Portugal": "🇵🇹", "Qatar": "🇶🇦",
  "Romania": "🇷🇴", "Russia": "🇷🇺", "Rwanda": "🇷🇼", "Saudi Arabia": "🇸🇦", "Senegal": "🇸🇳",
  "Serbia": "🇷🇸", "Singapore": "🇸🇬", "Slovakia": "🇸🇰", "Slovenia": "🇸🇮",
  "Somalia": "🇸🇴", "South Africa": "🇿🇦", "South Korea": "🇰🇷", "Spain": "🇪🇸",
  "Sri Lanka": "🇱🇰", "Sudan": "🇸🇩", "Sweden": "🇸🇪", "Switzerland": "🇨🇭", "Syria": "🇸🇾",
  "Taiwan": "🇹🇼", "Tajikistan": "🇹🇯", "Tanzania": "🇹🇿", "Thailand": "🇹🇭", "Togo": "🇹🇬",
  "Trinidad and Tobago": "🇹🇹", "Tunisia": "🇹🇳", "Turkey": "🇹🇷", "Uganda": "🇺🇬",
  "Ukraine": "🇺🇦", "United Arab Emirates": "🇦🇪", "United Kingdom": "🇬🇧",
  "United States": "🇺🇸", "Uruguay": "🇺🇾", "Uzbekistan": "🇺🇿", "Venezuela": "🇻🇪",
  "Vietnam": "🇻🇳", "Yemen": "🇾🇪", "Zambia": "🇿🇲", "Zimbabwe": "🇿🇼",
  "Democratic Republic of the Congo": "🇨🇩", "South Sudan": "🇸🇸", "North Korea": "🇰🇵",
  "North Macedonia": "🇲🇰", "Eswatini": "🇸🇿", "Timor-Leste": "🇹🇱",
  "Papua New Guinea": "🇵🇬", "Suriname": "🇸🇷", "Turkmenistan": "🇹🇲",
};

function aggregate(values: (string | null)[]): StatItem[] {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const v of values) {
    if (!v) continue;
    counts[v] = (counts[v] || 0) + 1;
    total++;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({
      label,
      count,
      percentage: Math.round((count / total) * 100),
    }));
}

// Build a case-insensitive lookup for flag matching
const FLAG_LOOKUP = new Map<string, string>();
for (const [name, flag] of Object.entries(COUNTRY_FLAGS)) {
  FLAG_LOOKUP.set(name.toLowerCase().trim(), flag);
}

function getFlag(country: string): string {
  return FLAG_LOOKUP.get(country.toLowerCase().trim()) || '🏳️';
}

const BAR_COLORS = [
  'bg-primary',
  'bg-primary/80',
  'bg-primary/60',
  'bg-primary/45',
  'bg-primary/30',
];

export function UserStatsCharts() {
  const [countries, setCountries] = useState<StatItem[]>([]);
  const [specialties, setSpecialties] = useState<StatItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll<T>(table: string, select: string, filter?: (q: any) => any): Promise<T[]> {
      const PAGE = 1000;
      let all: T[] = [];
      let from = 0;
      while (true) {
        let q = supabase.from(table).select(select).range(from, from + PAGE - 1);
        if (filter) q = filter(q);
        const { data } = await q;
        if (!data || data.length === 0) break;
        all = all.concat(data as T[]);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return all;
    }

    (async () => {
      const [countryProjects, profiles] = await Promise.all([
        fetchAll<any>(
          'canvas_projects',
          'profiles!inner(country)',
          (q: any) => q.not('profiles.country', 'is', null)
        ),
        fetchAll<any>('profiles', 'field_of_study'),
      ]);

      setCountries(aggregate(countryProjects.map((r: any) => r.profiles?.country)));
      setSpecialties(aggregate(profiles.map((d: any) => d.field_of_study)));
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto rounded-xl border border-border/40 bg-card p-6 space-y-4">
        <Skeleton className="h-5 w-40" />
        {[...Array(5)].map((_, j) => (
          <div key={j} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-full rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (countries.length === 0 && specialties.length === 0) return null;

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-lg rounded-xl border border-border/40 bg-card p-6 space-y-8">
        {/* Projects by Country */}
        {countries.length > 0 && (
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-5">
              <Globe className="h-4 w-4 text-primary" />
              Projects by Country
            </h3>
            <div className="space-y-4">
              {countries.map((item, i) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <span className="text-xl leading-none">{getFlag(item.label)}</span>
                      {item.label}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">{item.percentage}%</span>
                  </div>
                  <div className="h-5 w-full rounded-full bg-muted/50 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${BAR_COLORS[i]} transition-all duration-700 ease-out`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Users by Specialty */}
        {specialties.length > 0 && (
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-5">
              <FlaskConical className="h-4 w-4 text-primary" />
              Users by Specialty
            </h3>
            <div className="space-y-4">
              {specialties.map((item, i) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                    <span className="text-xs font-semibold text-muted-foreground">{item.percentage}%</span>
                  </div>
                  <div className="h-5 w-full rounded-full bg-muted/50 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${BAR_COLORS[i]} transition-all duration-700 ease-out`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
