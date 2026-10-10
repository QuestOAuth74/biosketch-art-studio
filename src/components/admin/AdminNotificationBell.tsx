import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Bell, FolderOpen, MessageSquare, Image, Mail, MessageCircle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { AdminTestIds } from '@/lib/test-ids';
import { useAdminNotificationCounts } from '@/hooks/useAdminNotificationCounts';

interface NotificationItemProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  onClick: () => void;
}

const NotificationItem = ({ icon, label, count, onClick }: NotificationItemProps) => (
  <button
    onClick={onClick}
    className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors"
  >
    <div className="flex items-center gap-3">
      <div className="text-muted-foreground">{icon}</div>
      <span className="text-sm font-medium">{label}</span>
    </div>
    <Badge variant="secondary" className="text-xs">
      {count}
    </Badge>
  </button>
);

export const AdminNotificationBell = () => {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  // Replace manual polling with React Query hook
  // This uses RPC function to batch 5 queries into 1 call
  // and caches results for 5 minutes with automatic background refresh
  const { data: counts, isLoading } = useAdminNotificationCounts();

  const totalCount = counts
    ? counts.pendingProjects +
      counts.pendingTestimonials +
      counts.pendingIconSubmissions +
      counts.unreadMessages +
      counts.totalFeedback
    : 0;

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ 
      behavior: 'smooth',
      block: 'start'
    });
    setOpen(false);
  };

  const clearAllNotifications = async () => {
    if (!counts) return;

    try {
      const promises = [];

      // Mark all unread contact messages as read
      if (counts.unreadMessages > 0) {
        promises.push(
          supabase
            .from('contact_messages')
            .update({ is_read: true })
            .eq('is_read', false)
        );
      }

      // Mark all unviewed tool feedback as viewed
      if (counts.totalFeedback > 0) {
        promises.push(
          supabase
            .from('tool_feedback')
            .update({ is_viewed: true })
            .eq('is_viewed', false)
        );
      }

      // Execute all updates
      if (promises.length > 0) {
        await Promise.all(promises);

        toast.success('Notifications cleared', {
          description: `Marked ${counts.unreadMessages} messages and ${counts.totalFeedback} feedback as viewed`
        });

        // Invalidate cache to trigger refresh
        queryClient.invalidateQueries({ queryKey: ['admin-notification-counts'] });
      }
    } catch (error) {
      console.error('Error clearing notifications:', error);
      toast.error('Failed to clear notifications', {
        description: 'Please try again'
      });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          title="Admin Notifications"
          data-testid={AdminTestIds.NOTIFICATION_BELL}
        >
          <Bell className="h-5 w-5" />
          {totalCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]"
              data-testid={AdminTestIds.NOTIFICATION_COUNT}
            >
              {totalCount > 99 ? '99+' : totalCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent align="end" className="w-80">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Pending Reviews</h3>
            <Badge variant="secondary">{totalCount}</Badge>
          </div>
          
          <Separator />
          
          {totalCount > 0 ? (
            <>
              <div className="space-y-2">
                {counts && counts.pendingProjects > 0 && (
                  <NotificationItem
                    icon={<FolderOpen className="h-4 w-4" />}
                    label="Submitted Projects"
                    count={counts.pendingProjects}
                    onClick={() => scrollToSection('submitted-projects')}
                  />
                )}

                {counts && counts.pendingTestimonials > 0 && (
                  <NotificationItem
                    icon={<MessageSquare className="h-4 w-4" />}
                    label="Testimonials"
                    count={counts.pendingTestimonials}
                    onClick={() => scrollToSection('testimonials')}
                  />
                )}

                {counts && counts.pendingIconSubmissions > 0 && (
                  <NotificationItem
                    icon={<Image className="h-4 w-4" />}
                    label="Icon Submissions"
                    count={counts.pendingIconSubmissions}
                    onClick={() => scrollToSection('icon-submissions')}
                  />
                )}

                {counts && counts.unreadMessages > 0 && (
                  <NotificationItem
                    icon={<Mail className="h-4 w-4" />}
                    label="Contact Messages"
                    count={counts.unreadMessages}
                    onClick={() => scrollToSection('contact-messages')}
                  />
                )}

                {counts && counts.totalFeedback > 0 && (
                  <NotificationItem
                    icon={<MessageCircle className="h-4 w-4" />}
                    label="Tool Feedback"
                    count={counts.totalFeedback}
                    onClick={() => scrollToSection('tool-feedback')}
                  />
                )}
              </div>

              {counts && (counts.unreadMessages > 0 || counts.totalFeedback > 0) && (
                <>
                  <Separator />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={clearAllNotifications}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Clear All Notifications
                  </Button>
                </>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No pending items</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
