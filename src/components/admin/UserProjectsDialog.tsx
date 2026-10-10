import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Eye, Globe, Lock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface Project {
  id: string;
  name: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  is_public: boolean;
  approval_status: string | null;
  view_count: number;
  cloned_count: number;
}

interface UserProjectsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  userProjects: Project[];
  userName: string;
  isLoading?: boolean;
}

export const UserProjectsDialog = ({
  isOpen,
  onClose,
  userProjects,
  userName,
  isLoading
}: UserProjectsDialogProps) => {
  const navigate = useNavigate();

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Approved</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Pending</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Rejected</Badge>;
      default:
        return <Badge variant="outline">No Status</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[80vh] border-[3px] border-foreground neo-shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Eye className="h-6 w-6 text-primary" />
            {userName}'s Projects ({userProjects?.length || 0})
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : userProjects?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg">No projects found for this user.</p>
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[60vh] border-[2px] border-foreground rounded-lg">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-bold">Project Name</TableHead>
                  <TableHead className="font-bold">Status</TableHead>
                  <TableHead className="font-bold text-center">Visibility</TableHead>
                  <TableHead className="font-bold text-center">Views</TableHead>
                  <TableHead className="font-bold text-center">Clones</TableHead>
                  <TableHead className="font-bold">Last Updated</TableHead>
                  <TableHead className="font-bold text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userProjects?.map((project) => (
                  <TableRow key={project.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium max-w-xs truncate">
                      {project.title || project.name || 'Untitled Project'}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(project.approval_status)}
                    </TableCell>
                    <TableCell className="text-center">
                      {project.is_public ? (
                        <div className="flex items-center justify-center gap-1 text-green-600">
                          <Globe className="h-4 w-4" />
                          <span className="text-xs">Public</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1 text-muted-foreground">
                          <Lock className="h-4 w-4" />
                          <span className="text-xs">Private</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {project.view_count}
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {project.cloned_count}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(project.updated_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigate(`/canvas/${project.id}`);
                          onClose();
                        }}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
