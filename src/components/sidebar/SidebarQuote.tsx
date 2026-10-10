import { useMemo } from "react";
import { Scroll } from "lucide-react";

interface Quote {
  text: string;
  author: string;
  source?: string;
}

const QUOTES: Quote[] = [
  // ── Stoics ──
  { text: "We suffer more often in imagination than in reality.", author: "Seneca", source: "Letters to Lucilius" },
  { text: "The happiness of your life depends upon the quality of your thoughts.", author: "Marcus Aurelius", source: "Meditations" },
  { text: "Waste no more time arguing about what a good man should be. Be one.", author: "Marcus Aurelius", source: "Meditations" },
  { text: "It is not that we have a short time to live, but that we waste a great deal of it.", author: "Seneca", source: "On the Shortness of Life" },
  { text: "Man is not worried by real problems so much as by his imagined anxieties about real problems.", author: "Epictetus", source: "Discourses" },
  { text: "He who fears death will never do anything worthy of a living man.", author: "Seneca", source: "Letters to Lucilius" },
  { text: "The impediment to action advances action. What stands in the way becomes the way.", author: "Marcus Aurelius", source: "Meditations" },
  { text: "First say to yourself what you would be; and then do what you have to do.", author: "Epictetus", source: "Discourses" },
  { text: "No man is free who is not master of himself.", author: "Epictetus" },
  { text: "If it is not right do not do it; if it is not true do not say it.", author: "Marcus Aurelius", source: "Meditations" },
  { text: "Difficulties strengthen the mind, as labor does the body.", author: "Seneca" },
  { text: "The soul becomes dyed with the colour of its thoughts.", author: "Marcus Aurelius", source: "Meditations" },
  { text: "Luck is what happens when preparation meets opportunity.", author: "Seneca" },
  { text: "How long are you going to wait before you demand the best for yourself?", author: "Epictetus" },
  { text: "He suffers more than necessary, who suffers before it is necessary.", author: "Seneca" },
  { text: "You have power over your mind, not outside events. Realize this, and you will find strength.", author: "Marcus Aurelius", source: "Meditations" },
  { text: "Wealth consists not in having great possessions, but in having few wants.", author: "Epictetus" },
  { text: "Begin at once to live, and count each separate day as a separate life.", author: "Seneca" },
  { text: "The best revenge is not to be like your enemy.", author: "Marcus Aurelius", source: "Meditations" },
  { text: "Make the best use of what is in your power, and take the rest as it happens.", author: "Epictetus" },

  // ── Ancient Greek ──
  { text: "The unexamined life is not worth living.", author: "Socrates" },
  { text: "Knowing yourself is the beginning of all wisdom.", author: "Aristotle" },
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle" },
  { text: "The measure of a man is what he does with power.", author: "Plato" },
  { text: "No great mind has ever existed without a touch of madness.", author: "Aristotle" },
  { text: "The only true wisdom is in knowing you know nothing.", author: "Socrates" },
  { text: "Educating the mind without educating the heart is no education at all.", author: "Aristotle" },
  { text: "He who is not a good servant will not be a good master.", author: "Plato" },
  { text: "Character is simply habit long continued.", author: "Plutarch" },
  { text: "What we achieve inwardly will change outer reality.", author: "Plutarch" },

  // ── Renaissance ──
  { text: "All our knowledge has its origins in our perceptions.", author: "Leonardo da Vinci" },
  { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { text: "The greater danger for most of us lies not in setting our aim too high and falling short, but in setting our aim too low and reaching our mark.", author: "Michelangelo" },
  { text: "Everyone sees what you appear to be, few experience what you really are.", author: "Niccolo Machiavelli", source: "The Prince" },
  { text: "It is not titles that honour men, but men that honour titles.", author: "Niccolo Machiavelli" },
  { text: "In the middle of difficulty lies opportunity.", author: "Leon Battista Alberti" },
  { text: "I have learned to seek my happiness by limiting my desires, rather than in attempting to satisfy them.", author: "John Stuart Mill" },
  { text: "There is nothing either good or bad, but thinking makes it so.", author: "William Shakespeare", source: "Hamlet" },
  { text: "To be, or not to be, that is the question.", author: "William Shakespeare", source: "Hamlet" },
  { text: "Study without desire spoils the memory, and it retains nothing that it takes in.", author: "Leonardo da Vinci" },

  // ── More Stoics ──
  { text: "Dwell on the beauty of life. Watch the stars, and see yourself running with them.", author: "Marcus Aurelius", source: "Meditations" },
  { text: "Sometimes even to live is an act of courage.", author: "Seneca" },
  { text: "True happiness is to enjoy the present, without anxious dependence upon the future.", author: "Seneca" },
  { text: "A gem cannot be polished without friction, nor a man perfected without trials.", author: "Seneca" },
  { text: "Very little is needed to make a happy life; it is all within yourself, in your way of thinking.", author: "Marcus Aurelius", source: "Meditations" },
  { text: "Don't explain your philosophy. Embody it.", author: "Epictetus" },
  { text: "The whole future lies in uncertainty: live immediately.", author: "Seneca" },
  { text: "It is the power of the mind to be unconquerable.", author: "Seneca" },
  { text: "Accept the things to which fate binds you, and love the people with whom fate brings you together.", author: "Marcus Aurelius", source: "Meditations" },
  { text: "To be everywhere is to be nowhere.", author: "Seneca", source: "Letters to Lucilius" },
];

/**
 * Returns a deterministic quote index based on the current date.
 * Changes once per day at midnight.
 */
function getDailyQuoteIndex(total: number): number {
  const now = new Date();
  // Days since epoch — changes at midnight local time
  const daysSinceEpoch = Math.floor(now.getTime() / 86_400_000);
  return daysSinceEpoch % total;
}

export function SidebarQuote() {
  const quote = useMemo(() => {
    const idx = getDailyQuoteIndex(QUOTES.length);
    return QUOTES[idx];
  }, []);

  return (
    <div className="rounded-xl bg-muted/60 border border-border/50 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Scroll className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold uppercase tracking-wider">Daily Reflection</h3>
      </div>
      <blockquote className="text-sm italic text-foreground/80 leading-relaxed">
        &ldquo;{quote.text}&rdquo;
      </blockquote>
      <p className="mt-2.5 text-xs font-medium text-muted-foreground">
        -- {quote.author}
        {quote.source && (
          <span className="font-normal">, {quote.source}</span>
        )}
      </p>
    </div>
  );
}
