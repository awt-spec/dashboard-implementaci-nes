import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  SupportPresentationView,
  type PresentationSnapshot,
} from "@/components/support/SupportPresentationView";

interface SharedRow {
  id: string;
  client_id: string | null;
  title: string;
  selected_slides: number[];
  presentation_snapshot: PresentationSnapshot;
  expires_at: string;
}

export default function SharedSupportPresentation() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("shared_support_presentations")
        .select("id, client_id, title, selected_slides, presentation_snapshot, expires_at")
        .eq("token", token)
        .maybeSingle();
      if (error || !data) {
        setError("Presentación no encontrada o expirada.");
        setLoading(false);
        return;
      }
      if (new Date(data.expires_at) < new Date()) {
        setError("Esta presentación ha expirado.");
        setLoading(false);
        return;
      }
      setData(data as any);
      setLoading(false);
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-10 w-10 text-warning mx-auto mb-3" />
            <h1 className="text-lg font-bold mb-1">No disponible</h1>
            <p className="text-sm text-muted-foreground">{error || "Esta presentación no existe."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <SupportPresentationView
      title={data.title}
      selectedSlides={data.selected_slides}
      snapshot={data.presentation_snapshot}
      sharedPresentationId={data.id}
      clientId={data.client_id}
    />
  );
}
