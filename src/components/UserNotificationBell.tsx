import { useState, useEffect } from 'react';
import { Bell, Check, Trash2, MailOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  subject: string;
  message: string;
  sender_name: string;
  is_read: boolean;
  created_at: string;
  link?: string | null;
  notification_type?: string | null;
}

export const UserNotificationBell = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const { data: notifications = [], isFetching } = useQuery<Notification[]>({
    queryKey: ['user-notifications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['user-notifications', user?.id] });

  // Re-fetch whenever the popover opens
  useEffect(() => {
    if (isOpen) invalidate();
  }, [isOpen]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('user-notifications-bell')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => invalidate()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from('user_notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
    invalidate();
  };

  const markAsUnread = async (notificationId: string) => {
    await supabase
      .from('user_notifications')
      .update({ is_read: false })
      .eq('id', notificationId);
    invalidate();
  };

  const deleteNotification = async (notificationId: string) => {
    await supabase
      .from('user_notifications')
      .delete()
      .eq('id', notificationId);
    invalidate();
  };

  const deleteAllNotifications = async () => {
    if (!user) return;
    await supabase
      .from('user_notifications')
      .delete()
      .eq('user_id', user.id);
    invalidate();
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase
      .from('user_notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    invalidate();
  };

  const formatRelativeTime = (timestamp: string) =>
    formatDistanceToNow(new Date(timestamp), { addSuffix: true });

  if (!user) return null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          {isFetching ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-sm">Notifications</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="h-auto p-1 text-xs"
              >
                <Check className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={deleteAllNotifications}
                className="h-auto p-1 text-xs text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear all
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="h-[400px]">
          {isFetching && notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-12 w-12 mx-auto mb-2 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`w-full text-left p-4 border-b border-border last:border-b-0 ${
                    !notification.is_read ? 'bg-accent/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {!notification.is_read && (
                          <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                        <p className="font-semibold text-sm line-clamp-1">
                          {notification.subject}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                        <span>{notification.sender_name}</span>
                        <span>{formatRelativeTime(notification.created_at)}</span>
                      </div>
                      {notification.link && (
                        <a
                          href={notification.link}
                          className="inline-flex items-center justify-center w-full mb-2 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                          onClick={() => markAsRead(notification.id)}
                        >
                          {['group_invitation', 'project_invitation', 'page_invitation'].includes(notification.notification_type ?? '')
                            ? 'Accept Invitation →'
                            : 'View Project →'}
                        </a>
                      )}
                      <div className="flex items-center gap-1">
                        {notification.is_read ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsUnread(notification.id);
                            }}
                          >
                            <MailOpen className="h-3 w-3 mr-1" />
                            Mark unread
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Mark read
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
