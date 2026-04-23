import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Report from "./pages/Report";
import SharedPresentation from "./pages/SharedPresentation";
import SharedSupportPresentation from "./pages/SharedSupportPresentation";
import SharedTicketHistory from "./pages/SharedTicketHistory";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import MemberProfile from "./pages/MemberProfile";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min — data considered fresh, no refetch
      gcTime: 10 * 60 * 1000,   // 10 min — keep in cache after unmount
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AuthGate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!user) return <Login />;
  return <Index />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AuthGate />} />
            <Route path="/report" element={<Report />} />
            <Route path="/shared/:token" element={<SharedPresentation />} />
            <Route path="/shared-support/:token" element={<SharedSupportPresentation />} />
            <Route path="/historial-caso/:token" element={<SharedTicketHistory />} />
            <Route path="/team/:memberId" element={<MemberProfile />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
