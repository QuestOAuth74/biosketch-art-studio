import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, Trash2, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface InactiveUser {
  id: string;
  email: string;
  full_name: string;
  country: string | null;
  field_of_study: string | null;
  created_at: string;
  last_login_at: string | null;
}

export const InactiveUserCleanup = () => {
  const [minDaysOld, setMinDaysOld] = useState("30");
  const [users, setUsers] = useState<InactiveUser[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 25;

  const handlePreview = async () => {
    setIsSearching(true);
    setHasSearched(false);
    setSelectedIds(new Set());
    try {
      const { data, error } = await supabase.functions.invoke("cleanup-inactive-users", {
        body: { mode: "preview", minDaysOld: parseInt(minDaysOld) },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setUsers(data.users || []);
      setHasSearched(true);
      setCurrentPage(1);
      if (data.count === 0) {
        toast.info("No inactive users found for this time period");
      }
    } catch (error: any) {
      console.error("Preview error:", error);
      toast.error(error.message || "Failed to fetch inactive users");
    } finally {
      setIsSearching(false);
    }
  };

  const toggleUser = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === users.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(users.map((u) => u.id)));
    }
  };

  const handleDelete = async () => {
    setConfirmOpen(false);
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("cleanup-inactive-users", {
        body: { mode: "delete", userIds: Array.from(selectedIds) },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success(`Deleted ${data.deleted} users`, {
        description: data.failed > 0 ? `${data.failed} failed` : undefined,
      });

      // Remove deleted users from list
      setUsers((prev) => prev.filter((u) => !selectedIds.has(u.id)));
      setSelectedIds(new Set());
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error(error.message || "Failed to delete users");
    } finally {
      setIsDeleting(false);
    }
  };

  const totalPages = Math.ceil(users.length / ITEMS_PER_PAGE);
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return users.slice(start, start + ITEMS_PER_PAGE);
  }, [users, currentPage]);

  return (
    <Card className="border border-border/50 bg-background/80 backdrop-blur-sm rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trash2 className="h-4 w-4" />
          Inactive User Cleanup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Find and remove users who signed up but never created a project within a given time period.
        </p>

        <div className="flex items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Signed up more than</Label>
            <Select value={minDaysOld} onValueChange={setMinDaysOld}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days ago</SelectItem>
                <SelectItem value="14">14 days ago</SelectItem>
                <SelectItem value="30">30 days ago</SelectItem>
                <SelectItem value="60">60 days ago</SelectItem>
                <SelectItem value="90">90 days ago</SelectItem>
                <SelectItem value="180">180 days ago</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handlePreview} disabled={isSearching} className="gap-2 h-9">
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Find Inactive Users
          </Button>
        </div>

        {hasSearched && users.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-sm">
            No users match this criteria.
          </div>
        )}

        {users.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                Found <Badge variant="destructive">{users.length}</Badge> inactive users (0 projects)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleAll}
                  className="text-xs h-7"
                >
                  {selectedIds.size === users.length ? "Deselect All" : "Select All"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={selectedIds.size === 0 || isDeleting}
                  onClick={() => setConfirmOpen(true)}
                  className="gap-1.5 text-xs h-7"
                >
                  {isDeleting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                  Delete Selected ({selectedIds.size})
                </Button>
              </div>
            </div>

            <div className="border rounded-md overflow-auto max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 sticky top-0 bg-background"></TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background">Name</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background">Email</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background">Country</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background">Field</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background">Signed Up</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background">Last Login</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((u) => (
                    <TableRow key={u.id} className="text-xs">
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(u.id)}
                          onCheckedChange={() => toggleUser(u.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>{u.country || "—"}</TableCell>
                      <TableCell>{u.field_of_study || "—"}</TableCell>
                      <TableCell>
                        {u.created_at ? format(new Date(u.created_at), "MMM d, yyyy") : "—"}
                      </TableCell>
                      <TableCell>
                        {u.last_login_at
                          ? format(new Date(u.last_login_at), "MMM d, yyyy")
                          : <span className="text-destructive">Never</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, users.length)} of {users.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-xs px-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Delete {selectedIds.size} users permanently?
              </DialogTitle>
              <DialogDescription>
                This will permanently delete {selectedIds.size} user accounts and all their associated data.
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
              >
                Yes, delete {selectedIds.size} users
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
