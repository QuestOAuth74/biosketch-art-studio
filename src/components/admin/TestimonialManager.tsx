import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Trash2, Globe, Sparkles, RefreshCw, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Testimonial {
  id: string;
  name: string;
  country: string;
  scientific_discipline: string;
  message: string;
  created_at: string;
  is_approved: boolean;
  rating: number;
}

export const TestimonialManager = () => {
  const { toast } = useToast();
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchTestimonials = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("testimonials")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error('Error fetching testimonials:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch testimonials",
      });
    } else {
      setTestimonials(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTestimonials();
  }, []);

  const handleApprove = async (id: string) => {
    const { error } = await supabase
      .from("testimonials")
      .update({ is_approved: true })
      .eq("id", id);

    if (error) {
      console.error('Error approving testimonial:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to approve testimonial",
      });
    } else {
      toast({
        title: "Success",
        description: "Testimonial approved successfully",
      });
      fetchTestimonials();
    }
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase
      .from("testimonials")
      .update({ is_approved: false })
      .eq("id", id);

    if (error) {
      console.error('Error rejecting testimonial:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to reject testimonial",
      });
    } else {
      toast({
        title: "Success",
        description: "Testimonial rejected",
      });
      fetchTestimonials();
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    const { error } = await supabase
      .from("testimonials")
      .delete()
      .eq("id", deleteId);

    if (error) {
      console.error('Error deleting testimonial:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete testimonial",
      });
    } else {
      toast({
        title: "Success",
        description: "Testimonial deleted successfully",
      });
      fetchTestimonials();
    }
    setDeleteId(null);
  };

  const pendingCount = testimonials.filter((t) => !t.is_approved).length;
  const approvedCount = testimonials.filter((t) => t.is_approved).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-muted-foreground">Loading testimonials...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Testimonials Management</CardTitle>
            <Button onClick={fetchTestimonials} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
          <div className="flex gap-4 mt-4">
            <Badge variant="secondary" className="text-sm">
              Pending: {pendingCount}
            </Badge>
            <Badge variant="default" className="text-sm">
              Approved: {approvedCount}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {testimonials.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No testimonials yet
            </p>
          ) : (
            <div className="space-y-4">
              {testimonials.map((testimonial) => (
                <Card
                  key={testimonial.id}
                  className={`${
                    testimonial.is_approved ? "border-green-500" : "border-yellow-500"
                  } border-2`}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-lg">{testimonial.name}</h3>
                            <div className="flex flex-wrap gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                <Globe className="h-3 w-3 mr-1" />
                                {testimonial.country}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                <Sparkles className="h-3 w-3 mr-1" />
                                {testimonial.scientific_discipline}
                              </Badge>
                            </div>
                          </div>
                          <Badge
                            variant={testimonial.is_approved ? "default" : "secondary"}
                          >
                            {testimonial.is_approved ? "Approved" : "Pending"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(testimonial.created_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        <div className="flex gap-0.5 my-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-4 w-4 ${
                                star <= testimonial.rating
                                  ? "fill-primary text-primary"
                                  : "fill-none text-muted-foreground"
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-base leading-relaxed border-l-4 border-primary pl-4 py-2">
                          "{testimonial.message}"
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        {testimonial.is_approved ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReject(testimonial.id)}
                            className="whitespace-nowrap"
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Unapprove
                          </Button>
                        ) : (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleApprove(testimonial.id)}
                            className="whitespace-nowrap"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteId(testimonial.id)}
                          className="whitespace-nowrap"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
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

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Testimonial</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this testimonial? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};