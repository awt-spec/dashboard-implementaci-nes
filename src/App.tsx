import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

// Eager (cargan siempre): Index (hub principal post-login), Login (gate)
import Index from "./pages/Index";
import Login from "./pages/Login";

// Lazy: rutas raramente visitadas o pesadas. Bajan el initial bundle ~30-40%.
//   • Report      → admin pesado
//   • Shared*     → rutas públicas con token, baja frecuencia
//   • MemberProfile → on-demand
//   • NotFound    → fallback
const Report                    = lazy(() => import("./pages/Report"));
const SharedPresentation        = lazy(() => import("./pages/SharedPresentation"));
const SharedSupportPresentation = lazy(() => import("./pages/SharedSupportPresentation"));
const SharedTicketHistory       = lazy(() => import("./pages/SharedTicketHistory"));
const MemberProfile             = lazy(() => import("./pages/MemberProfile"));
const NotFound                  = lazy(() => import("./pages/NotFound"));

// Spinner consistente con AuthGate — evita flash visual al cambiar de ruta lazy.
function RouteSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );
}

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
  if (loading) return <RouteSpinner />;
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
          <Suspense fallback={<RouteSpinner />}>
            <Routes>
              <Route path="/" element={<AuthGate />} />
              <Route path="/report" element={<Report />} />
              <Route path="/shared/:token" element={<SharedPresentation />} />
              <Route path="/shared-support/:token" element={<SharedSupportPresentation />} />
              <Route path="/historial-caso/:token" element={<SharedTicketHistory />} />
              <Route path="/team/:memberId" element={<MemberProfile />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
