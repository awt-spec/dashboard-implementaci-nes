import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  UserPlus, Phone, Mail, Building2, Crown, Star, Shield,
  Users, Pencil, Trash2, ChevronDown, ChevronUp
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Contact {
  id: string;
  client_id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  role_type: string;
  is_decision_maker: boolean;
  is_primary_contact: boolean;
  notes: string;
}

const ROLE_TYPES = [
  { value: "sponsor", label: "Sponsor / Patrocinador", icon: Crown, color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  { value: "gerente", label: "Gerente de Proyecto", icon: Shield, color: "bg-primary/10 text-primary border-primary/30" },
  { value: "director", label: "Director / VP", icon: Star, color: "bg-purple-500/10 text-purple-600 border-purple-500/30" },
  { value: "coordinador", label: "Coordinador", icon: Users, color: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  { value: "tecnico", label: "Técnico / Especialista", icon: Building2, color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  { value: "equipo", label: "Equipo", icon: Users, color: "bg-muted text-muted-foreground border-border" },
];

interface ContactsTabProps {
  clientId: string;
}

export function ContactsTab({ clientId }: ContactsTabProps) {
  const { role } = useAuth();
  const canEdit = role === "admin" || role === "pm";
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();

  // Form state
  const [form, setForm] = useState({
    name: "", email: "", phone: "", position: "", department: "",
    role_type: "equipo", is_decision_maker: false, is_primary_contact: false, notes: "",
  });

  const resetForm = () => setForm({
    name: "", email: "", phone: "", position: "", department: "",
    role_type: "equipo", is_decision_maker: false, is_primary_contact: false, notes: "",
  });

  const fetchContacts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("client_contacts")
      .select("*")
      .eq("client_id", clientId)
      .order("is_primary_contact", { ascending: false })
      .order("is_decision_maker", { ascending: false })
      .order("role_type");
    if (!error && data) setContacts(data as Contact[]);
    setLoading(false);
  };

  useEffect(() => { fetchContacts(); }, [clientId]);

  const handleSave = async () => {
    if (!form.name) {
      toast({ title: "Nombre requerido", variant: "destructive" });
      return;
    }
    if (editingContact) {
      const { error } = await supabase.from("client_contacts").update({ ...form }).eq("id", editingContact.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Contacto actualizado" });
    } else {
      const { error } = await supabase.from("client_contacts").insert([{ ...form, client_id: clientId }]);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Contacto agregado" });
    }
    setDialogOpen(false);
    resetForm();
    setEditingContact(null);
    fetchContacts();
  };

  const handleEdit = (c: Contact) => {
    setEditingContact(c);
    setForm({
      name: c.name, email: c.email, phone: c.phone, position: c.position,
      department: c.department, role_type: c.role_type,
      is_decision_maker: c.is_decision_maker, is_primary_contact: c.is_primary_contact, notes: c.notes,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este contacto?")) return;
    await supabase.from("client_contacts").delete().eq("id", id);
    toast({ title: "Contacto eliminado" });
    fetchContacts();
  };

  const decisionMakers = contacts.filter(c => c.is_decision_maker);
  const primaryContact = contacts.find(c => c.is_primary_contact);
  const grouped = ROLE_TYPES.map(rt => ({
    ...rt,
    contacts: contacts.filter(c => c.role_type === rt.value),
  })).filter(g => g.contacts.length > 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">Equipo del Cliente</h3>
          <p className="text-xs text-muted-foreground">{contacts.length} contactos registrados</p>
        </div>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { resetForm(); setEditingContact(null); } }}>
            <DialogTrigger asChild>
              <Button size="sm"><UserPlus className="h-4 w-4 mr-2" />Agregar Contacto</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingContact ? "Editar Contacto" : "Nuevo Contacto"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Nombre *</label>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Juan Pérez" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Cargo</label>
                    <Input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} placeholder="Director de TI" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Email</label>
                    <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="juan@empresa.com" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Teléfono</label>
                    <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+506 8888-8888" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Departamento</label>
                    <Input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="Tecnología" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Tipo de Rol</label>
                    <Select value={form.role_type} onValueChange={v => setForm(f => ({ ...f, role_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLE_TYPES.map(r => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-6 py-2">
                  <label className="flex items-center gap-2 text-xs">
                    <Switch checked={form.is_decision_maker} onCheckedChange={v => setForm(f => ({ ...f, is_decision_maker: v }))} />
                    <span className="font-medium">Toma decisiones</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <Switch checked={form.is_primary_contact} onCheckedChange={v => setForm(f => ({ ...f, is_primary_contact: v }))} />
                    <span className="font-medium">Contacto principal</span>
                  </label>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Notas</label>
                  <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Responsable de aprobaciones técnicas..." rows={2} />
                </div>
                <Button onClick={handleSave} className="w-full">
                  {editingContact ? "Guardar Cambios" : "Agregar Contacto"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Cargando...</p>
      ) : contacts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No hay contactos registrados</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Agrega al equipo del cliente para gestionar responsabilidades</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {primaryContact && (
              <Card className="border-primary/30">
                <CardContent className="p-3">
                  <p className="text-[10px] uppercase font-bold text-primary mb-1 flex items-center gap-1"><Star className="h-3 w-3" /> Contacto Principal</p>
                  <p className="text-sm font-bold text-foreground">{primaryContact.name}</p>
                  <p className="text-xs text-muted-foreground">{primaryContact.position}</p>
                  {primaryContact.email && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Mail className="h-3 w-3" />{primaryContact.email}</p>}
                </CardContent>
              </Card>
            )}
            {decisionMakers.length > 0 && (
              <Card className="border-amber-500/30">
                <CardContent className="p-3">
                  <p className="text-[10px] uppercase font-bold text-amber-600 mb-1 flex items-center gap-1"><Crown className="h-3 w-3" /> Tomadores de Decisión</p>
                  {decisionMakers.map(dm => (
                    <p key={dm.id} className="text-xs text-foreground">{dm.name} — <span className="text-muted-foreground">{dm.position}</span></p>
                  ))}
                </CardContent>
              </Card>
            )}
            <Card>
              <CardContent className="p-3">
                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Resumen</p>
                {ROLE_TYPES.map(rt => {
                  const count = contacts.filter(c => c.role_type === rt.value).length;
                  if (!count) return null;
                  return <p key={rt.value} className="text-xs text-foreground">{rt.label}: <span className="font-bold">{count}</span></p>;
                })}
              </CardContent>
            </Card>
          </div>

          {/* Grouped contacts */}
          <div className="space-y-3">
            {grouped.map(group => {
              const RoleIcon = group.icon;
              return (
                <Card key={group.value}>
                  <CardHeader className="py-2.5 px-4">
                    <CardTitle className="text-xs font-bold flex items-center gap-2">
                      <RoleIcon className="h-3.5 w-3.5" />
                      {group.label}
                      <Badge variant="outline" className="ml-auto text-[10px]">{group.contacts.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {group.contacts.map(c => {
                        const expanded = expandedId === c.id;
                        return (
                          <div key={c.id} className="px-4 py-2.5">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                                {c.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-foreground truncate">{c.name}</span>
                                  {c.is_primary_contact && <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">Principal</Badge>}
                                  {c.is_decision_maker && <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-600">Decisor</Badge>}
                                </div>
                                <p className="text-xs text-muted-foreground truncate">
                                  {c.position}{c.department ? ` · ${c.department}` : ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {c.email && (
                                  <a href={`mailto:${c.email}`} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                                    <Mail className="h-3.5 w-3.5" />
                                  </a>
                                )}
                                {c.phone && (
                                  <a href={`tel:${c.phone}`} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                                    <Phone className="h-3.5 w-3.5" />
                                  </a>
                                )}
                                <button onClick={() => setExpandedId(expanded ? null : c.id)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground">
                                  {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                </button>
                                {canEdit && (
                                  <>
                                    <button onClick={() => handleEdit(c)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground">
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            <AnimatePresence>
                              {expanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="pt-2 pl-11 space-y-1 text-xs text-muted-foreground">
                                    {c.email && <p className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{c.email}</p>}
                                    {c.phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{c.phone}</p>}
                                    {c.notes && <p className="text-foreground/80 mt-1 bg-muted/50 rounded-md p-2">{c.notes}</p>}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
