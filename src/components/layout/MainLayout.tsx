import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => (
  <div className="min-h-screen notebook-page">
    <header className="border-b bg-background/80 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-2 text-sm">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to editor
        </Link>
        <span className="font-medium text-foreground">Biosketch.Art Studio</span>
      </div>
    </header>
    <main>{children}</main>
  </div>
);
