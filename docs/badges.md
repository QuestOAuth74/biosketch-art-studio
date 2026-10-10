# User Badges — Icon Design Reference

Source of truth: [`src/components/profile/ProfileBadges.tsx`](../src/components/profile/ProfileBadges.tsx)

There are **20 badges** across 8 categories. Each entry below lists the badge name, criterion for earning it, the current Lucide reference icon (placeholder), the color slot in `colorMap`, and the tier if any.

---

## 1. Profile completion

| Name | Criterion | Current icon | Color | Tier |
|---|---|---|---|---|
| Say Cheese | Uploaded a profile photo | `Camera` | sky | — |
| Storyteller | Author bio ≥ 10 chars | `FileText` | indigo | — |
| Quotable | Profile quote ≥ 5 chars | `Quote` | pink | — |

## 2. Shared projects

| Name | Criterion | Current icon | Color | Tier |
|---|---|---|---|---|
| First Share | 1 public project | `Share2` | emerald | — |
| Contributor | 3 public projects | `Medal` | amber | bronze |
| Prolific | 10 public projects | `Trophy` | yellow | gold |

## 3. Project creation

| Name | Criterion | Current icon | Color | Tier |
|---|---|---|---|---|
| Creator | 5 total projects | `FolderOpen` | blue | — |
| Architect | 20 total projects | `Gem` | violet | silver |

## 4. Views (community reach)

| Name | Criterion | Current icon | Color | Tier |
|---|---|---|---|---|
| Getting Noticed | 10 total views | `Eye` | teal | — |
| In the Spotlight | 100 total views | `Star` | amber | silver |
| Viral | 1,000 total views | `Flame` | orange | gold |

## 5. Likes (community appreciation)

| Name | Criterion | Current icon | Color | Tier |
|---|---|---|---|---|
| First Like | 1 like received | `Heart` | rose | — |
| Popular | 10 likes | `Heart` | rose | bronze |
| Community Favorite | 50 likes | `Crown` | rose | gold |

## 6. Clones (impact)

| Name | Criterion | Current icon | Color | Tier |
|---|---|---|---|---|
| Inspiring | 1 clone of your project | `Copy` | cyan | — |
| Influential | 10 clones of your projects | `Zap` | cyan | silver |

## 7. Collaboration

| Name | Criterion | Current icon | Color | Tier |
|---|---|---|---|---|
| Team Player | 1 collaboration joined | `Users` | violet | — |
| Power Collaborator | 5 collaborations | `Shield` | violet | silver |

## 8. Overall milestones

| Name | Criterion | Current icon | Color | Tier |
|---|---|---|---|---|
| Rising Star | 50+ total (views + likes + clones) | `Sparkles` | amber | silver |
| Legend | 500+ total (views + likes + clones) | `Award` | yellow | gold |

---

## Design notes

- **Tiers used**: `bronze`, `silver`, `gold`. Currently signaled with a ring around the badge (`ring-yellow-400/60` gold, `ring-slate-300/60` silver, `ring-amber-600/40` bronze). If tier should show *in the icon itself*, plan a variant per tier.
- **Duplicate icons**: `Heart` is reused across two badges (First Like + Popular). Consider a distinct icon per badge to avoid visual repetition.
- **Icon change at top tier**: The `rose`-colored "likes" trio keeps a Heart for First Like + Popular, then swaps to `Crown` at Community Favorite. Decide whether to keep the Heart shape across all three tiers, or let the icon change with the milestone.
- **Ring tint isn't tokenized** — if tier ring colors should live in the design system, plan tokens like `--tier-gold-ring`, etc.
- **Color slot semantics**: the color name in `colorMap` maps to a `bg` (`bg-{color}-50`), a `text` (`text-{color}-600`), and an `iconBg` (`bg-{color}-500/15`). Icons render inside the `iconBg` circle in the current UI, so transparent PNG/SVG works well.

## Adding, renaming, or removing badges

Edit the `badges: Badge[]` array in `ProfileBadges.tsx`. Each entry is self-describing:

```ts
{
  id: 'unique-slug',
  name: 'Display Name',
  description: 'Tooltip description',
  icon: LucideIconComponent,
  earned: <boolean expression using props>,
  color: 'sky' | 'indigo' | 'pink' | ...,
  tier?: 'bronze' | 'silver' | 'gold',
}
```

The component derives everything else (which badges are earned, which are locked, the display cap of 10 slots) from that array.
