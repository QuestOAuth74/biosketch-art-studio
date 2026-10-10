import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Loader2, Mail, Users, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import EmailEditor from "@/components/admin/EmailEditor";
import { 
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface Profile {
  id: string;
  email: string;
  full_name: string;
  country: string | null;
}

interface EmailTemplate {
  id: string;
  name: string;
  icon: string;
  subject: string;
  message: string;
}

const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "welcome",
    name: "👋 Welcome Email",
    icon: "👋",
    subject: "Welcome to BioSketch!",
    message: `<p>Hi there!</p><p>We're excited to have you join BioSketch, the professional tool for creating scientific illustrations and diagrams.</p><p>Here are some resources to get you started:</p><ul><li>Watch our quick start tutorial</li><li>Browse community templates for inspiration</li><li>Try creating your first diagram</li></ul><p>If you have any questions or need help, don't hesitate to reach out.</p>`
  },
  {
    id: "new-feature",
    name: "✨ New Feature Announcement",
    icon: "✨",
    subject: "New Feature: [Feature Name] is Now Available!",
    message: `<p>Hello!</p><p>We're thrilled to announce a new feature that will enhance your BioSketch experience: <strong>[Feature Name]</strong>!</p><p><strong>What's new:</strong></p><ul><li>[Key benefit 1]</li><li>[Key benefit 2]</li><li>[Key benefit 3]</li></ul><p><strong>How to use it:</strong><br>[Brief instructions or link to documentation]</p><p>We'd love to hear your feedback on this new feature. Try it out and let us know what think!</p>`
  },
  {
    id: "maintenance",
    name: "🔧 Maintenance Notice",
    icon: "🔧",
    subject: "Scheduled Maintenance on [Date]",
    message: `<p>Hi everyone,</p><p>We'll be performing scheduled maintenance on BioSketch to improve performance and reliability.</p><p><strong>Maintenance Window:</strong></p><ul><li>Date: [Date]</li><li>Time: [Start Time] - [End Time] [Timezone]</li><li>Expected Duration: [Duration]</li></ul><p>During this time, the platform may be temporarily unavailable. We apologize for any inconvenience and appreciate your patience.</p><p>If you have any urgent concerns, please contact us before the maintenance window.</p>`
  },
  {
    id: "tips",
    name: "💡 Tips & Tutorial",
    icon: "💡",
    subject: "Pro Tips: Get More Out of BioSketch",
    message: `<p>Hello!</p><p>We wanted to share some tips and tricks to help you create even better scientific illustrations with BioSketch:</p><p><strong>Tip 1: [Tip Title]</strong><br>[Brief description and benefit]</p><p><strong>Tip 2: [Tip Title]</strong><br>[Brief description and benefit]</p><p><strong>Tip 3: [Tip Title]</strong><br>[Brief description and benefit]</p><p>Want to learn more? Check out our comprehensive tutorial library and video guides.</p>`
  },
  {
    id: "feedback",
    name: "📝 Feedback Request",
    icon: "📝",
    subject: "We'd Love Your Feedback!",
    message: `<p>Hi there!</p><p>Your opinion matters to us! We're always working to improve BioSketch, and your feedback helps shape the future of the platform.</p><p>We'd appreciate if you could take 2-3 minutes to answer a few questions:<br>[Survey Link]</p><p><strong>Topics we're curious about:</strong></p><ul><li>Your experience with [specific feature]</li><li>Features you'd like to see added</li><li>Overall satisfaction with the platform</li></ul><p>As a thank you, [optional: incentive like early access to new features, etc.]</p>`
  },
  {
    id: "community",
    name: "🌟 Community Highlight",
    icon: "🌟",
    subject: "Community Spotlight: Amazing Work from Our Users!",
    message: `<p>Hello!</p><p>We're constantly amazed by the incredible scientific illustrations created by our community. This week, we wanted to highlight some outstanding projects:</p><p><strong>Featured Project 1: [Project Name]</strong><br>Created by [User Name]<br>[Brief description or link]</p><p><strong>Featured Project 2: [Project Name]</strong><br>Created by [User Name]<br>[Brief description or link]</p><p>Want to be featured? Share your best work by [instructions for submission].</p>`
  },
  {
    id: "reengagement",
    name: "💚 We Miss You",
    icon: "💚",
    subject: "We Miss You! Come Back to BioSketch",
    message: `<p>Hi [Name],</p><p>We noticed you haven't been active on BioSketch lately, and we wanted to reach out. We've made some exciting improvements since your last visit:</p><p><strong>What's New:</strong></p><ul><li>[New feature or improvement 1]</li><li>[New feature or improvement 2]</li><li>[New feature or improvement 3]</li></ul><p>Your account and all your projects are waiting for you, exactly as you left them.</p><p>Need help getting started again? Our support team is here to assist you.</p>`
  },
  {
    id: "platform-update",
    name: "🚀 Platform Update",
    icon: "🚀",
    subject: "BioSketch Platform Update - [Version Number]",
    message: `<p>Hello!</p><p>We've just released a new platform update with improvements and bug fixes to enhance your experience.</p><p><strong>Release Highlights:</strong></p><ul><li>[Improvement 1]</li><li>[Improvement 2]</li><li>[Bug fix 1]</li><li>[Performance enhancement]</li></ul><p>Full release notes: [Link to release notes]</p><p>These changes are now live for all users. No action is required on your part.</p><p>If you encounter any issues or have questions about these updates, please don't hesitate to contact us.</p>`
  }
];

const EmailNotifications = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [adminName, setAdminName] = useState("BioSketch Team");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [sendToAll, setSendToAll] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);
  const ITEMS_PER_PAGE = 20;

  // Fetch users with pagination and search
  const { data: usersData, isLoading: loadingUsers } = useQuery({
    queryKey: ['all-users', currentPage, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('id, email, full_name, country', { count: 'exact' })
        .not('email', 'is', null)
        .order('full_name');
      
      // Apply search filter
      if (searchQuery.trim()) {
        query = query.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
      }
      
      // Apply pagination
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      return { 
        users: data as Profile[], 
        totalCount: count || 0 
      };
    }
  });

  const users = usersData?.users || [];
  const totalCount = usersData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const showingFrom = totalCount > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0;
  const showingTo = Math.min(currentPage * ITEMS_PER_PAGE, totalCount);

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('send-bulk-email', {
        body: {
          recipientIds: sendToAll ? "all" : selectedUsers,
          subject,
          message,
          adminName,
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Emails sent successfully!",
          description: `Sent to ${data.sent} recipient(s)${data.failed > 0 ? `. Failed: ${data.failed}` : ''}`,
        });
        setSubject("");
        setMessage("");
        setSelectedUsers([]);
        setSendToAll(false);
        setSelectedTemplate("");
      } else {
        toast({
          title: "Failed to send emails",
          description: data.error || data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      console.error('Error sending emails:', error);
      toast({
        title: "Error sending emails",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleToggleUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = EMAIL_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setSubject(template.subject);
      setMessage(template.message);
      toast({
        title: "Template applied",
        description: "You can now customize the content before sending.",
      });
    }
  };

  const handleSelectAll = () => {
    if (users.length === 0) return;
    const visibleUserIds = users.map(u => u.id);
    
    // Check if all visible users are selected
    const allVisibleSelected = visibleUserIds.every(id => selectedUsers.includes(id));
    
    if (allVisibleSelected) {
      // Deselect all visible users
      setSelectedUsers(prev => prev.filter(id => !visibleUserIds.includes(id)));
    } else {
      // Select all visible users (add to existing selections)
      setSelectedUsers(prev => [...new Set([...prev, ...visibleUserIds])]);
    }
  };

  const handleSend = () => {
    if (!subject.trim()) {
      toast({
        title: "Subject required",
        description: "Please enter an email subject",
        variant: "destructive",
      });
      return;
    }
    if (!message.trim()) {
      toast({
        title: "Message required",
        description: "Please enter an email message",
        variant: "destructive",
      });
      return;
    }
    if (!sendToAll && selectedUsers.length === 0) {
      toast({
        title: "No recipients selected",
        description: "Please select at least one recipient or choose 'Send to All'",
        variant: "destructive",
      });
      return;
    }

    sendEmailMutation.mutate();
  };

  const recipientCount = sendToAll ? totalCount : selectedUsers.length;

  const getEmailPreviewHTML = () => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .email-container {
              background-color: #ffffff;
              border-radius: 8px;
              padding: 40px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .email-header {
              border-bottom: 3px solid #7C3AED;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .email-title {
              font-size: 24px;
              font-weight: bold;
              color: #1a1a1a;
              margin: 0 0 10px 0;
            }
            .email-from {
              color: #666;
              font-size: 14px;
            }
            .email-body {
              color: #333;
              font-size: 16px;
              line-height: 1.8;
              margin-bottom: 30px;
            }
            .email-body p {
              margin: 0 0 16px 0;
            }
            .email-body ul, .email-body ol {
              margin: 16px 0;
              padding-left: 24px;
            }
            .email-body li {
              margin-bottom: 8px;
            }
            .email-body a {
              color: #7C3AED;
              text-decoration: underline;
            }
            .email-body strong {
              font-weight: 600;
            }
            .email-footer {
              border-top: 1px solid #e5e5e5;
              padding-top: 20px;
              margin-top: 30px;
              color: #666;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="email-header">
              <h1 class="email-title">${subject || '(No Subject)'}</h1>
              <p class="email-from">From: ${adminName}</p>
            </div>
            <div class="email-body">
              ${message || '<em style="color: #999;">(No message content)</em>'}
            </div>
            <div class="email-footer">
              <p>Best regards,<br/>${adminName}<br/>BioSketch Team</p>
              <p style="margin-top: 20px; font-size: 12px; color: #999;">
                This is an automated email from BioSketch. Please do not reply to this email.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            onClick={() => navigate('/admin')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
          <h1 className="text-4xl font-bold">Email Notifications</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recipients Selection */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Recipients
              </CardTitle>
              <CardDescription>
                Select users to send emails to
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sendToAll"
                    checked={sendToAll}
                    onCheckedChange={(checked) => {
                      setSendToAll(checked as boolean);
                      if (checked) {
                        setSelectedUsers([]);
                      }
                    }}
                  />
                  <Label htmlFor="sendToAll" className="cursor-pointer font-bold">
                    Send to All Users ({totalCount})
                  </Label>
                </div>

                <Separator />

                {!sendToAll && (
                  <>
                    <Input
                      placeholder="Search by name or email..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full"
                    />
                    <p className="text-sm text-muted-foreground">
                      Showing {showingFrom} - {showingTo} of {totalCount} users
                      {selectedUsers.length > 0 && ` • ${selectedUsers.length} selected`}
                    </p>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAll}
                      className="w-full"
                    >
                      {users.length > 0 && users.every(u => selectedUsers.includes(u.id)) 
                        ? 'Deselect Page' 
                        : 'Select Page'}
                    </Button>

                    <ScrollArea className="h-[400px] pr-4">
                      {loadingUsers ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : users.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          No users found
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {users.map((user) => (
                            <div
                              key={user.id}
                              className="flex items-start space-x-2 p-2 rounded hover:bg-muted/50"
                            >
                              <Checkbox
                                id={user.id}
                                checked={selectedUsers.includes(user.id)}
                                onCheckedChange={() => handleToggleUser(user.id)}
                              />
                              <Label
                                htmlFor={user.id}
                                className="cursor-pointer flex-1"
                              >
                                <div className="font-medium">{user.full_name || 'No name'}</div>
                                <div className="text-xs text-muted-foreground">{user.email}</div>
                                {user.country && (
                                  <div className="text-xs text-muted-foreground">{user.country}</div>
                                )}
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                    
                    {totalPages > 1 && (
                      <Pagination className="mt-4">
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious 
                              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                              className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                          
                          {[...Array(totalPages)].map((_, idx) => {
                            const pageNum = idx + 1;
                            if (
                              pageNum === 1 || 
                              pageNum === totalPages || 
                              (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                            ) {
                              return (
                                <PaginationItem key={pageNum}>
                                  <PaginationLink
                                    onClick={() => setCurrentPage(pageNum)}
                                    isActive={currentPage === pageNum}
                                    className="cursor-pointer"
                                  >
                                    {pageNum}
                                  </PaginationLink>
                                </PaginationItem>
                              );
                            } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                              return <PaginationEllipsis key={pageNum} />;
                            }
                            return null;
                          })}
                          
                          <PaginationItem>
                            <PaginationNext 
                              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                              className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Email Composition */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Compose Email
              </CardTitle>
              <CardDescription>
                Send notifications to selected users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="template">Email Template</Label>
                  <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a template (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {EMAIL_TEMPLATES.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Select a pre-built template to get started. You can customize the content before sending.
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="adminName">Your Name</Label>
                  <Input
                    id="adminName"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="BioSketch Team"
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Subject *</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Important update from BioSketch"
                    maxLength={200}
                  />
                  <p className="text-xs text-muted-foreground">
                    {subject.length} / 200 characters
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message *</Label>
                  <EmailEditor 
                    content={message}
                    onChange={setMessage}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use the toolbar to format your message with bold, italic, lists, and links
                  </p>
                </div>

                <Separator />

                <div className="bg-muted/30 p-4 rounded-lg border-l-4 border-primary">
                  <p className="text-sm font-medium">
                    Ready to send to <span className="font-bold text-primary">{recipientCount}</span> recipient{recipientCount !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => setShowPreview(true)}
                    disabled={!subject || !message}
                    variant="outline"
                    className="flex-1"
                    size="lg"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Preview Email
                  </Button>
                  <Button
                    onClick={handleSend}
                    disabled={sendEmailMutation.isPending}
                    className="flex-1"
                    size="lg"
                  >
                    {sendEmailMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Email
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Email Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              This is how your email will appear to recipients
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <div 
              className="border rounded-lg overflow-hidden"
              dangerouslySetInnerHTML={{ __html: getEmailPreviewHTML() }}
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close Preview
            </Button>
            <Button onClick={() => {
              setShowPreview(false);
              handleSend();
            }}>
              <Send className="h-4 w-4 mr-2" />
              Send Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailNotifications;
