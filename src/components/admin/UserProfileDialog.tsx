import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Globe, GraduationCap, Calendar, FolderOpen, Quote, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface UserAnalytics {
  id: string;
  email: string;
  full_name: string;
  country: string | null;
  field_of_study: string | null;
  avatar_url: string | null;
  quote: string | null;
  created_at: string;
  project_count: number;
}

interface UserProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserAnalytics | null;
  onViewProjects: () => void;
}

export const UserProfileDialog = ({
  isOpen,
  onClose,
  user,
  onViewProjects
}: UserProfileDialogProps) => {
  if (!user) return null;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl border-[3px] border-foreground neo-shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <User className="h-6 w-6 text-primary" />
            User Profile
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Avatar and Name Section */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 border-[2px] border-foreground">
              <AvatarImage src={user.avatar_url || undefined} alt={user.full_name} />
              <AvatarFallback className="text-xl bg-primary/10 text-primary">
                {getInitials(user.full_name || user.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-2xl font-bold">{user.full_name || 'No name provided'}</h3>
              <div className="flex items-center gap-2 text-muted-foreground mt-1">
                <Mail className="h-4 w-4" />
                <span className="text-sm">{user.email}</span>
              </div>
            </div>
          </div>

          {/* Quote Section */}
          {user.quote && (
            <Card className="border-[2px] border-foreground bg-muted/30">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <Quote className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
                  <p className="italic text-foreground">{user.quote}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-[2px] border-foreground">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Country</p>
                    <p className="font-semibold">{user.country || 'Not specified'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[2px] border-foreground">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Field of Study</p>
                    <p className="font-semibold">{user.field_of_study || 'Not specified'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[2px] border-foreground">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Joined</p>
                    <p className="font-semibold">{format(new Date(user.created_at), 'MMM d, yyyy')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[2px] border-foreground">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <FolderOpen className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Projects</p>
                    <p className="font-semibold text-xl">{user.project_count}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={onViewProjects}
              className="flex-1"
              variant="default"
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              View Projects ({user.project_count})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
