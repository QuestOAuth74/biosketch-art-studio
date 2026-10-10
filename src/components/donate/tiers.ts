// Donation tiers — three Stripe Payment Links. Editing here changes the
// picker modal everywhere (footer, home page, post-3-projects prompt).

export interface DonationTier {
  amount: number;              // USD
  url: string;                 // Stripe Payment Link
  label: string;               // short pill label
  description: string;         // one-line story about what this funds
  emoji: string;               // vibe
  popular?: boolean;           // highlight one tier as the recommended pick
  // Per-tier color scheme — mirrors the color-coded section cards on the
  // home page bento. Full Tailwind class names (not composed strings) so
  // JIT can see them at build time.
  colors: {
    accent: string;      // "text-{color}-600" for amount + arrow
    ring: string;        // "ring-{color}-400/40" for popular badge/border
    softBg: string;      // "bg-{color}-50" for card background
    softBorder: string;  // "border-{color}-200" for card border
    chipBg: string;      // "bg-{color}-100" for emoji chip background
  };
}

export const DONATION_TIERS: DonationTier[] = [
  {
    amount: 5,
    url: 'https://buy.stripe.com/14A8wO76tgujbVL53p7IY00',
    label: 'Coffee & code',
    description: 'A round of coffees to keep the team building.',
    emoji: '☕',
    colors: {
      accent: 'text-amber-700',
      ring: 'ring-amber-400/50',
      softBg: 'bg-amber-50',
      softBorder: 'border-amber-200',
      chipBg: 'bg-amber-100',
    },
  },
  {
    amount: 10,
    url: 'https://buy.stripe.com/5kQdR84Yl1zp3pf1Rd7IY02',
    label: 'Fuel the mission',
    description: 'Covers a week of AI model costs for the community.',
    emoji: '🌱',
    popular: true,
    colors: {
      accent: 'text-emerald-700',
      ring: 'ring-emerald-400/50',
      softBg: 'bg-emerald-50',
      softBorder: 'border-emerald-200',
      chipBg: 'bg-emerald-100',
    },
  },
  {
    amount: 20,
    url: 'https://buy.stripe.com/28EdR8gH33Hxgc153p7IY01',
    label: 'Champion',
    description: 'Sponsors a new AI feature or major infrastructure upgrade.',
    emoji: '🚀',
    colors: {
      accent: 'text-violet-700',
      ring: 'ring-violet-400/50',
      softBg: 'bg-violet-50',
      softBorder: 'border-violet-200',
      chipBg: 'bg-violet-100',
    },
  },
];
