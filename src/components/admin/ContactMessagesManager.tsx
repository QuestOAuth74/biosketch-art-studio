import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Mail, Trash2, Eye, EyeOff, StickyNote, MapPin, Calendar, Reply, Loader2, Check } from "lucide-react";
import { format } from "date-fns";

export const ContactMessagesManager = () => {
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [adminName, setAdminName] = useState("BioSketch Support Team");
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();

  const { data: messages, isLoading } = useQuery({
    queryKey: ["contact-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const updateReadStatus = useMutation({
    mutationFn: async ({ id, is_read }: { id: string; is_read: boolean }) => {
      const { error } = await supabase
        .from("contact_messages")
        .update({ is_read })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-messages"] });
      toast.success("Message status updated");
    },
    onError: (error) => {
      console.error('Error updating message status:', error);
      toast.error("Failed to update message status");
    },
  });

  const updateNotes = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from("contact_messages")
        .update({ admin_notes: notes })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-messages"] });
      toast.success("Notes saved");
      setNotesDialogOpen(false);
    },
    onError: (error) => {
      console.error('Error saving notes:', error);
      toast.error("Failed to save notes");
    },
  });

  const deleteMessage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contact_messages")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-messages"] });
      toast.success("Message deleted");
      setDeleteDialogOpen(false);
    },
    onError: (error) => {
      console.error('Error deleting message:', error);
      toast.error("Failed to delete message");
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("contact_messages")
        .update({ is_read: true })
        .eq("is_read", false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-messages"] });
      toast.success("All messages marked as read");
    },
    onError: (error) => {
      console.error('Error marking all messages as read:', error);
      toast.error("Failed to mark all messages as read");
    },
  });

  const sendReply = useMutation({
    mutationFn: async ({ 
      recipientEmail, 
      recipientName, 
      replyMessage, 
      adminName,
      originalMessage 
    }: {
      recipientEmail: string;
      recipientName: string;
      replyMessage: string;
      adminName: string;
      originalMessage: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('send-contact-reply', {
        body: {
          recipientEmail,
          recipientName,
          replyMessage,
          adminName,
          originalMessage
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-messages"] });
      toast.success("Reply sent successfully!");
      setReplyDialogOpen(false);
      setReplyMessage('');
      // Mark message as read after replying
      if (selectedMessage && !selectedMessage.is_read) {
        updateReadStatus.mutate({ id: selectedMessage.id, is_read: true });
      }
    },
    onError: (error) => {
      console.error('Error sending reply:', error);
      toast.error("Failed to send reply: " + error.message);
    }
  });

  const filteredMessages = messages?.filter(msg => 
    showUnreadOnly ? !msg.is_read : true
  ) || [];

  const unreadCount = messages?.filter(msg => !msg.is_read).length || 0;

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedMessages);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedMessages(newExpanded);
  };

  const truncateMessage = (message: string, id: string) => {
    const isExpanded = expandedMessages.has(id);
    if (message.length <= 200 || isExpanded) return message;
    return message.substring(0, 200) + "...";
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Contact Messages
              </CardTitle>
              <CardDescription>
                Total: {messages?.length || 0} | Unread: {unreadCount}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllAsRead.mutate()}
                disabled={unreadCount === 0 || markAllAsRead.isPending}
              >
                <Check className="h-4 w-4 mr-2" />
                Mark All as Read
              </Button>
              <Button
                variant={showUnreadOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              >
                {showUnreadOnly ? "Show All" : "Unread Only"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Loading messages...</p>
          ) : filteredMessages.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {showUnreadOnly ? "No unread messages" : "No messages yet"}
            </p>
          ) : (
            <div className="space-y-4">
              {filteredMessages.map((message) => (
                <Card key={message.id} className="border-border/60">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-lg">{message.full_name}</h3>
                          <Badge variant={message.is_read ? "secondary" : "default"}>
                            {message.is_read ? "Read" : "Unread"}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {message.email}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {message.country}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(message.created_at), "MMM d, yyyy HH:mm")}
                          </span>
                        </div>

                        <div className="pt-2">
                          <p className="text-sm whitespace-pre-wrap">
                            {truncateMessage(message.message, message.id)}
                          </p>
                          {message.message.length > 200 && (
                            <Button
                              variant="link"
                              size="sm"
                              className="p-0 h-auto"
                              onClick={() => toggleExpanded(message.id)}
                            >
                              {expandedMessages.has(message.id) ? "Show less" : "Read more"}
                            </Button>
                          )}
                        </div>

                        {message.admin_notes && (
                          <div className="mt-2 p-2 bg-muted/50 rounded-md border border-border/40">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Admin Notes:</p>
                            <p className="text-sm">{message.admin_notes}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateReadStatus.mutate({ 
                            id: message.id, 
                            is_read: !message.is_read 
                          })}
                          title={message.is_read ? "Mark as unread" : "Mark as read"}
                        >
                          {message.is_read ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setSelectedMessage(message);
                            setReplyMessage('');
                            setReplyDialogOpen(true);
                          }}
                          title="Reply to message"
                        >
                          <Reply className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setSelectedMessage(message);
                            setAdminNotes(message.admin_notes || "");
                            setNotesDialogOpen(true);
                          }}
                          title="Add/Edit notes"
                        >
                          <StickyNote className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setSelectedMessage(message);
                            setDeleteDialogOpen(true);
                          }}
                          title="Delete message"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reply Dialog */}
      <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reply to Contact Message</DialogTitle>
            <DialogDescription>
              Sending reply to {selectedMessage?.full_name} ({selectedMessage?.email})
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Original Message Context */}
            <div className="bg-muted/30 border-l-4 border-primary p-4 rounded">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                Original Message:
              </p>
              <p className="text-sm whitespace-pre-wrap">
                {selectedMessage?.message}
              </p>
            </div>

            {/* Admin Name Input */}
            <div className="space-y-2">
              <Label>Your Name (optional)</Label>
              <Input 
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="BioSketch Support Team"
              />
            </div>

            {/* Reply Message */}
            <div className="space-y-2">
              <Label>Your Reply</Label>
              <Textarea
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder="Type your reply here..."
                rows={8}
                className="resize-none"
                maxLength={5000}
              />
              <p className="text-xs text-muted-foreground">
                {replyMessage.length} / 5000 characters
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => sendReply.mutate({
                recipientEmail: selectedMessage?.email,
                recipientName: selectedMessage?.full_name,
                replyMessage,
                adminName: adminName || 'BioSketch Support Team',
                originalMessage: selectedMessage?.message
              })}
              disabled={!replyMessage.trim() || sendReply.isPending}
            >
              {sendReply.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Reply'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notes Dialog */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admin Notes</DialogTitle>
            <DialogDescription>
              Add internal notes for this message from {selectedMessage?.full_name}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            placeholder="Enter notes here..."
            rows={5}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => updateNotes.mutate({ 
                id: selectedMessage?.id, 
                notes: adminNotes 
              })}
            >
              Save Notes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message from {selectedMessage?.full_name}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMessage.mutate(selectedMessage?.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
