import { useState } from 'react';
import { useMyPurchases } from '@/hooks/useMyPurchases';
import { PurchaseCreditsDialog } from './PurchaseCreditsDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Receipt, Download, Gift } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { generateInvoicePdf } from '@/lib/generateInvoice';
import { useAuth } from '@/contexts/AuthContext';

/**
 * User-facing table of AI credit purchases. Reads from `ai_credit_purchases`
 * via `useMyPurchases`, which is RLS-restricted to the caller. Shows date,
 * amount, generations granted, and a truncated session ID for support lookups.
 * Stripe emails full receipts automatically, so no receipt link is needed here.
 */
export function PurchaseHistoryPanel() {
  const { data: purchases, isLoading } = useMyPurchases();
  const { user } = useAuth();
  const [showPurchase, setShowPurchase] = useState(false);

  const handleDownloadInvoice = async (p: NonNullable<typeof purchases>[number]) => {
    await generateInvoicePdf({
      purchaseId: p.id,
      stripeSessionId: p.stripe_session_id,
      amountUsd: Number(p.amount_usd),
      generations: p.generations_granted,
      createdAt: p.created_at,
      customerEmail: user?.email ?? null,
      customerName: (user?.user_metadata?.full_name as string) ?? null,
    });
  };

  return (
    <>
      <div
        className="rounded-xl border border-border bg-muted/40 p-5"
        data-testid="purchase-history-panel"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Purchase History</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              title="Earn AI credits by sharing approved projects to the community"
            >
              <Link to="/free-ai-credits">
                <Gift className="h-3 w-3 mr-1" />
                Earn credits
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => setShowPurchase(true)}
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Buy generations
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : !purchases || purchases.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No purchases yet. Buy generations to top up your balance any time —
            they don't expire.
          </p>
        ) : (
          <div className="rounded-lg overflow-hidden border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Date</th>
                  <th className="text-left px-3 py-2 font-semibold">Amount</th>
                  <th className="text-left px-3 py-2 font-semibold">Generations</th>
                  <th className="text-left px-3 py-2 font-semibold hidden sm:table-cell">Reference</th>
                  <th className="text-right px-3 py-2 font-semibold">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card/80">
                {purchases.map((p) => {
                  const isRevoke = p.generations_granted < 0;
                  const isAdminGrant = p.stripe_session_id.startsWith('admin-grant:');
                  const label = isRevoke ? 'Revoked' : isAdminGrant ? 'Admin credit' : 'Purchase';
                  // Only real paid purchases get an invoice — no invoices for
                  // admin comps ($0) or revokes (negative).
                  const canDownloadInvoice = Number(p.amount_usd) > 0 && p.generations_granted > 0;
                  return (
                    <tr key={p.id}>
                      <td className="px-3 py-2 text-foreground">
                        {format(new Date(p.created_at), 'MMM d, yyyy')}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {Number(p.amount_usd) > 0 ? (
                          <span className="text-foreground">${Number(p.amount_usd).toFixed(2)}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">{label}</span>
                        )}
                      </td>
                      <td className={`px-3 py-2 tabular-nums ${isRevoke ? 'text-destructive' : 'text-foreground'}`}>
                        {p.generations_granted > 0 ? `+${p.generations_granted}` : p.generations_granted}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground text-xs font-mono hidden sm:table-cell">
                        {p.stripe_session_id.slice(-10)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {canDownloadInvoice ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleDownloadInvoice(p)}
                            title="Download PDF invoice"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            PDF
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-3">
          Receipts are emailed automatically at the time of purchase.
        </p>
      </div>

      <PurchaseCreditsDialog open={showPurchase} onOpenChange={setShowPurchase} />
    </>
  );
}
