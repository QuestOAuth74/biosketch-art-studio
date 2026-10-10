import { Link } from "react-router-dom";
import { useBlogPosts } from "@/hooks/useBlogPosts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Eye, BarChart } from "lucide-react";
import { BlogPostsTable } from "@/components/admin/blog/BlogPostsTable";

const BlogManagement = () => {
  const { data: allResult } = useBlogPosts({});
  const { data: publishedResult } = useBlogPosts({ status: 'published' });
  const { data: draftResult } = useBlogPosts({ status: 'draft' });

  const allPosts = allResult?.posts || [];
  const publishedPosts = publishedResult?.posts || [];
  const draftPosts = draftResult?.posts || [];

  const totalViews = publishedPosts.reduce((sum, post) => sum + post.view_count, 0);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Blog Management</h1>
          <p className="text-muted-foreground">Manage your blog posts, categories, and tags</p>
        </div>
        <Button asChild>
          <Link to="/admin/blog/new">
            <Plus className="mr-2 h-4 w-4" />
            New Post
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Posts</CardDescription>
            <CardTitle className="text-3xl">{allPosts.length}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Published</CardDescription>
            <CardTitle className="text-3xl">{publishedPosts.length}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Drafts</CardDescription>
            <CardTitle className="text-3xl">{draftPosts.length}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Views</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Eye className="h-6 w-6" />
              {totalViews}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-4 mb-8">
        <Button variant="outline" asChild>
          <Link to="/admin/blog/categories">
            Manage Categories
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/admin/blog/tags">
            Manage Tags
          </Link>
        </Button>
      </div>

      {/* Posts Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Blog Posts</CardTitle>
          <CardDescription>View and manage all your blog posts</CardDescription>
        </CardHeader>
        <CardContent>
          <BlogPostsTable />
        </CardContent>
      </Card>
    </div>
  );
};

export default BlogManagement;
