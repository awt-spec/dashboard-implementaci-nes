import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useUpdateSysdeTeamMember } from "@/hooks/useTeamMembers";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Upload, Linkedin, Github, Globe, Twitter, ImageIcon } from "lucide-react";

export function ProfileEditDialog({ member, open, onOpenChange }: { member: any; open: boolean; onOpenChange: (v: boolean) => void; }) {
  const update = useUpdateSysdeTeamMember();
  const qc = useQueryClient();
  const [bio, setBio] = useState(member?.bio || "");
  const [location, setLocation] = useState(member?.location || "");
  const [phone, setPhone] = useState(member?.phone || "");
  const [pronouns, setPronouns] = useState(member?.pronouns || "");
  const [hireDate, setHireDate] = useState(member?.hire_date || "");
  const [linkedin, setLinkedin] = useState(member?.social_links?.linkedin || "");
  const [github, setGithub] = useState(member?.social_links?.github || "");
  const [website, setWebsite] = useState(member?.social_links?.website || "");
  const [twitter, setTwitter] = useState(member?.social_links?.twitter || "");
  const [avatarUrl, setAvatarUrl] = useState(member?.avatar_url || "");
  const [coverUrl, setCoverUrl] = useState(member?.cover_url || "");
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File, kind: "avatar" | "cover") => {
    setUploading(kind);
    try {
      const ext = file.name.split(".").pop();
      const path = `${member.id}/${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("team-avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("team-avatars").getPublicUrl(path);
      if (kind === "avatar") setAvatarUrl(data.publicUrl);
      else setCoverUrl(data.publicUrl);
      toast.success(`${kind === "avatar" ? "Avatar" : "Portada"} subida`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(null);
    }
  };

  const handleSave = () => {
    update.mutate(
      {
        id: member.id,
        updates: {
          bio, location, phone, pronouns,
          hire_date: hireDate || null,
          avatar_url: avatarUrl || null,
          cover_url: coverUrl || null,
          social_links: { linkedin, github, website, twitter },
        } as any,
      },
      {
        onSuccess: () => {
          toast.success("Perfil actualizado");
          qc.invalidateQueries({ queryKey: ["member", member.id] });
          onOpenChange(false);
        },
        onError: (e: any) => toast.error(e.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar perfil de {member?.name}</DialogTitle></DialogHeader>

        <div className="space-y-4">
          {/* Cover preview */}
          <div className="relative">
            <div
              className="h-32 w-full rounded-lg bg-gradient-to-br from-primary/30 via-primary/10 to-muted bg-cover bg-center"
              style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
            />
            <Button
              size="sm"
              variant="secondary"
              className="absolute top-2 right-2 gap-1.5"
              onClick={() => coverInput.current?.click()}
              disabled={uploading === "cover"}
            >
              {uploading === "cover" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
              Cambiar portada
            </Button>
            <input
              ref={coverInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], "cover")}
            />
          </div>

          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-full bg-primary/15 border-4 border-background shadow-md overflow-hidden flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-primary">{member?.name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}</span>
              )}
            </div>
            <div>
              <Button size="sm" variant="outline" onClick={() => avatarInput.current?.click()} disabled={uploading === "avatar"}>
                {uploading === "avatar" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
                Cambiar avatar
              </Button>
              <input
                ref={avatarInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], "avatar")}
              />
              <p className="text-[11px] text-muted-foreground mt-1">PNG / JPG · cuadrado funciona mejor</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Bio corta</Label>
            <Textarea rows={3} value={bio} onChange={e => setBio(e.target.value)} placeholder="Cuéntanos sobre ti, tus intereses y áreas de expertise..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Ubicación</Label>
              <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Lima, Perú" />
            </div>
            <div className="space-y-2">
              <Label>Pronombres</Label>
              <Input value={pronouns} onChange={e => setPronouns(e.target.value)} placeholder="él/ella/elle" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+51 999 999 999" />
            </div>
            <div className="space-y-2">
              <Label>Fecha de ingreso</Label>
              <Input type="date" value={hireDate} onChange={e => setHireDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Redes sociales</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Linkedin className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-8" placeholder="LinkedIn URL" value={linkedin} onChange={e => setLinkedin(e.target.value)} />
              </div>
              <div className="relative">
                <Github className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-8" placeholder="GitHub URL" value={github} onChange={e => setGithub(e.target.value)} />
              </div>
              <div className="relative">
                <Globe className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-8" placeholder="Website / portfolio" value={website} onChange={e => setWebsite(e.target.value)} />
              </div>
              <div className="relative">
                <Twitter className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-8" placeholder="X / Twitter" value={twitter} onChange={e => setTwitter(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={update.isPending}>
            {update.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
