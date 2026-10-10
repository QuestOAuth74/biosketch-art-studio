import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AiGateProvider } from "@/contexts/AiGateContext";
import { MainLayout } from "@/components/layout/MainLayout";
import Canvas from "./pages/Canvas";
import ReleaseNotes from "./pages/ReleaseNotes";
import Terms from "./pages/Terms";
import NotFound from "./pages/NotFound";
import {
  Tools,
  GeneticCodeWheel,
  Gantt,
  SmilesEditor,
  MolecularWeight,
  BufferCalculator,
  LatexEditor,
  HeatmapGenerator,
  Pedigree,
  DilutionCalculator,
  PunnettSquare,
  PhyloTree,
  GelElectrophoresis,
  UnitConverter,
  DnaTools,
  PlasmidViewer,
  VolcanoPlot,
  DoseResponse,
  KaplanMeier,
  EnzymeKinetics,
  ScatterPlot,
  ChromosomeIdeogram,
  ProteinDomains,
  BoxWhiskerPlot,
  BarChartErrorBars,
  ViolinPlot,
  CorrelationMatrix,
  ForestPlot,
  ROCCurve,
  VennDiagram,
  SankeyDiagram,
  CIProportionCalculator,
  ChiSquareTest,
  RadarChart,
  ChartStudio,
  ChartStudioLanding,
} from "./pages/tools";
import SimpleCanvas from "./pages/SimpleCanvas";
import About from "./pages/About";
import { AboutDialog } from "@/components/app/AboutDialog";
import { AppSplash } from "@/components/app/AppSplash";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      networkMode: 'always',
    },
    mutations: { retry: 0 },
  },
});

const RedirectSimpleCanvas = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/canvas/${id}`} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AiGateProvider>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AppSplash />
            <AboutDialog />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<SimpleCanvas />} />
                <Route path="/canvas" element={<SimpleCanvas />} />
                <Route path="/canvas/:id" element={<SimpleCanvas />} />
                <Route path="/advanced-canvas" element={<Canvas />} />
                <Route path="/advanced-canvas/:id" element={<Canvas />} />
                <Route path="/simple-canvas" element={<Navigate to="/canvas" replace />} />
                <Route path="/simple-canvas/:id" element={<RedirectSimpleCanvas />} />
                <Route path="/release-notes" element={<MainLayout><ReleaseNotes /></MainLayout>} />
                <Route path="/terms" element={<MainLayout><Terms /></MainLayout>} />
                <Route path="/about" element={<MainLayout><About /></MainLayout>} />
                <Route path="/tools" element={<MainLayout><Tools /></MainLayout>} />
                <Route path="/genetic-code-wheel" element={<MainLayout><GeneticCodeWheel /></MainLayout>} />
                <Route path="/pedigree" element={<Pedigree />} />
                <Route path="/gantt" element={<Gantt />} />
                <Route path="/chart-studio" element={<ChartStudio />} />
                <Route path="/chart-studio-intro" element={<MainLayout><ChartStudioLanding /></MainLayout>} />
                <Route path="/smiles" element={<SmilesEditor />} />
                <Route path="/molecular-weight" element={<MainLayout><MolecularWeight /></MainLayout>} />
                <Route path="/buffer-calculator" element={<MainLayout><BufferCalculator /></MainLayout>} />
                <Route path="/latex" element={<LatexEditor />} />
                <Route path="/heatmap" element={<HeatmapGenerator />} />
                <Route path="/dilution-calculator" element={<MainLayout><DilutionCalculator /></MainLayout>} />
                <Route path="/punnett-square" element={<MainLayout><PunnettSquare /></MainLayout>} />
                <Route path="/phylo-tree" element={<PhyloTree />} />
                <Route path="/gel-electrophoresis" element={<MainLayout><GelElectrophoresis /></MainLayout>} />
                <Route path="/unit-converter" element={<MainLayout><UnitConverter /></MainLayout>} />
                <Route path="/dna-tools" element={<MainLayout><DnaTools /></MainLayout>} />
                <Route path="/plasmid-viewer" element={<MainLayout><PlasmidViewer /></MainLayout>} />
                <Route path="/volcano-plot" element={<MainLayout><VolcanoPlot /></MainLayout>} />
                <Route path="/dose-response" element={<MainLayout><DoseResponse /></MainLayout>} />
                <Route path="/kaplan-meier" element={<MainLayout><KaplanMeier /></MainLayout>} />
                <Route path="/enzyme-kinetics" element={<MainLayout><EnzymeKinetics /></MainLayout>} />
                <Route path="/scatter-plot" element={<MainLayout><ScatterPlot /></MainLayout>} />
                <Route path="/chromosome-ideogram" element={<MainLayout><ChromosomeIdeogram /></MainLayout>} />
                <Route path="/protein-domains" element={<MainLayout><ProteinDomains /></MainLayout>} />
                <Route path="/box-whisker-plot" element={<MainLayout><BoxWhiskerPlot /></MainLayout>} />
                <Route path="/bar-chart" element={<MainLayout><BarChartErrorBars /></MainLayout>} />
                <Route path="/violin-plot" element={<MainLayout><ViolinPlot /></MainLayout>} />
                <Route path="/correlation-matrix" element={<MainLayout><CorrelationMatrix /></MainLayout>} />
                <Route path="/forest-plot" element={<MainLayout><ForestPlot /></MainLayout>} />
                <Route path="/roc-curve" element={<MainLayout><ROCCurve /></MainLayout>} />
                <Route path="/venn-diagram" element={<MainLayout><VennDiagram /></MainLayout>} />
                <Route path="/sankey-diagram" element={<MainLayout><SankeyDiagram /></MainLayout>} />
                <Route path="/ci-proportion" element={<MainLayout><CIProportionCalculator /></MainLayout>} />
                <Route path="/chi-square" element={<MainLayout><ChiSquareTest /></MainLayout>} />
                <Route path="/radar-chart" element={<MainLayout><RadarChart /></MainLayout>} />
                <Route path="*" element={<MainLayout><NotFound /></MainLayout>} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </ThemeProvider>
      </AiGateProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
