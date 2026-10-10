import { Link } from "react-router-dom";
import { Microscope } from "lucide-react";
import { DonateButton } from "@/components/donate/DonateButton";

export const Footer = () => {
  return (
    <footer className="border-t border-border/50 bg-card/50 mt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Microscope className="h-6 w-6 text-primary" />
              <span className="text-lg font-serif font-semibold text-foreground">BioSketch.Art</span>
            </div>
            <p className="text-sm text-muted-foreground">Professional scientific illustration software for researchers worldwide.</p>
          </div>

          {/* Product Links */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-foreground">Product</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/canvas" className="text-muted-foreground hover:text-primary transition-colors">
                  Canvas Editor
                </Link>
              </li>
              <li>
                <Link to="/community" className="text-muted-foreground hover:text-primary transition-colors">
                  Community
                </Link>
              </li>
              <li>
                <Link to="/projects" className="text-muted-foreground hover:text-primary transition-colors">
                  My Projects
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-muted-foreground hover:text-primary transition-colors">
                  About Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources Links */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-foreground">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/tutorials" className="text-muted-foreground hover:text-primary transition-colors">
                  Tutorials
                </Link>
              </li>
              <li>
                <Link to="/blog" className="text-muted-foreground hover:text-primary transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link to="/release-notes" className="text-muted-foreground hover:text-primary transition-colors">
                  Release Notes
                </Link>
              </li>
              <li>
                <a
                  href="https://discord.gg/yMz9PtnH37"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Join Our Discord
                </a>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-foreground">BIOSKETCH.ART</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/contact" className="text-muted-foreground hover:text-primary transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link to="/survey" className="text-muted-foreground hover:text-primary transition-colors">
                  Letter of Support
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-muted-foreground hover:text-primary transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/free-ai-credits" className="text-muted-foreground hover:text-primary transition-colors">
                  Free AI Credits
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Support / donate */}
        <div className="max-w-6xl mx-auto mt-10 pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground text-center sm:text-left">
            BioSketch is free and open — donations help keep it that way.
          </p>
          <DonateButton size="sm" label="Support BioSketch" />
        </div>

        {/* License */}
        <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-border/50 text-center text-sm text-muted-foreground space-y-2">
          <p>
            <a href="https://www.biosketch.art" className="hover:text-primary transition-colors">BioSketch.Art</a> by{" "}
            <a href="https://www.biosketch.art" className="hover:text-primary transition-colors">BioSketch Team</a> is licensed under{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/" className="hover:text-primary transition-colors">CC BY 4.0</a>
            <img src="https://mirrors.creativecommons.org/presskit/icons/cc.svg" alt="" className="inline-block ml-1" style={{ maxWidth: '1em', maxHeight: '1em' }} />
            <img src="https://mirrors.creativecommons.org/presskit/icons/by.svg" alt="" className="inline-block ml-1" style={{ maxWidth: '1em', maxHeight: '1em' }} />
          </p>
          <p>© {new Date().getFullYear()} BioSketch.Art Illustrator. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};
