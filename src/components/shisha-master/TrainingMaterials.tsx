import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Video, FileText, Plus, Trash2, 
  ExternalLink, BookOpen, Loader2, Link as LinkIcon, Play
} from "lucide-react";
import { useUserRoles } from "@/hooks/useUserRoles";
import { toast } from "sonner";
import { format } from "date-fns";

const CATEGORIES = [
  { value: "preparation", labelEn: "Preparation", labelId: "Persiapan" },
  { value: "service", labelEn: "Service", labelId: "Pelayanan" },
  { value: "safety", labelEn: "Safety", labelId: "Keselamatan" },
  { value: "general", labelEn: "General", labelId: "Umum" },
];

interface TrainingMaterial {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_type: string;
  language: string;
  category: string;
  created_at: string;
}

function getYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function detectFileType(url: string): string {
  if (getYouTubeId(url)) return "video";
  if (/drive\.google\.com/.test(url)) return "document";
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  if (ext && ["mp4", "mov", "avi", "webm"].includes(ext)) return "video";
  if (ext && ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
  if (ext && ["pdf", "doc", "docx"].includes(ext)) return "document";
  return "link";
}

export default function TrainingMaterials() {
  const { isAdmin } = useUserRoles();
  const [materials, setMaterials] = useState<TrainingMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<TrainingMaterial | null>(null);
  const [saving, setSaving] = useState(false);
  const [langTab, setLangTab] = useState("en");

  const [form, setForm] = useState({
    title: "",
    description: "",
    url: "",
    language: "en",
    category: "general",
  });

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    const { data, error } = await supabase
      .from("training_materials")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setMaterials(data);
    }
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!form.title || !form.url) {
      toast.error("Please fill in the title and URL");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("training_materials")
        .insert({
          title: form.title,
          description: form.description || null,
          file_url: form.url,
          file_type: detectFileType(form.url),
          language: form.language,
          category: form.category,
        });

      if (error) throw error;

      toast.success("Material added");
      setAddDialogOpen(false);
      setForm({ title: "", description: "", url: "", language: "en", category: "general" });
      fetchMaterials();
    } catch (error: any) {
      toast.error(error.message || "Error adding material");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedMaterial) return;

    try {
      const { error } = await supabase
        .from("training_materials")
        .delete()
        .eq("id", selectedMaterial.id);

      if (error) throw error;

      toast.success("Material deleted");
      setDeleteDialogOpen(false);
      setSelectedMaterial(null);
      fetchMaterials();
    } catch (error: any) {
      toast.error("Delete error");
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "video": return <Video className="h-4 w-4" />;
      case "document": return <FileText className="h-4 w-4" />;
      default: return <LinkIcon className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const filteredMaterials = materials.filter(m => m.language === langTab);

  const getCategoryLabel = (value: string) => {
    const cat = CATEGORIES.find(c => c.value === value);
    if (!cat) return value;
    return langTab === "id" ? cat.labelId : cat.labelEn;
  };

  const groupedMaterials = CATEGORIES.reduce<Record<string, TrainingMaterial[]>>((acc, cat) => {
    const items = filteredMaterials.filter(m => (m.category || "general") === cat.value);
    if (items.length > 0) acc[cat.value] = items;
    return acc;
  }, {});

  const renderMaterialCard = (material: TrainingMaterial) => {
    const ytId = getYouTubeId(material.file_url);
    return (
      <Card key={material.id} className="overflow-hidden">
        {ytId && (
          <div className="aspect-video">
            <iframe
              src={`https://www.youtube.com/embed/${ytId}`}
              title={material.title}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Badge variant="outline" className="shrink-0 gap-1">
                {getIcon(material.file_type)}
                <span className="capitalize text-xs">{material.file_type}</span>
              </Badge>
              <h3 className="font-medium text-sm truncate">{material.title}</h3>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {format(new Date(material.created_at), "dd.MM.yy")}
              </span>
              {!ytId && (
                <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                  <a href={material.file_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => {
                    setSelectedMaterial(material);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          {material.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {material.description}
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Training Materials
          </CardTitle>
          {isAdmin && (
            <Button onClick={() => setAddDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Tabs value={langTab} onValueChange={setLangTab} className="mb-4">
            <TabsList>
              <TabsTrigger value="en">🇬🇧 English</TabsTrigger>
              <TabsTrigger value="id">🇮🇩 Indonesian</TabsTrigger>
            </TabsList>
          </Tabs>

          {filteredMaterials.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No training materials yet</p>
            </div>
          ) : (
            <Accordion type="multiple" defaultValue={Object.keys(groupedMaterials)} className="space-y-2">
              {Object.entries(groupedMaterials).map(([category, items]) => (
                <AccordionItem key={category} value={category} className="border rounded-lg px-3">
                  <AccordionTrigger className="py-3 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{getCategoryLabel(category)}</span>
                      <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pb-1">
                      {items.map(renderMaterialCard)}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Material</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Language</label>
              <Tabs value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
                <TabsList className="w-full">
                  <TabsTrigger value="en" className="flex-1">🇬🇧 English</TabsTrigger>
                  <TabsTrigger value="id" className="flex-1">🇮🇩 Indonesian</TabsTrigger>
                </TabsList>
            </Tabs>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.labelEn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. How to prepare hookah"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">URL (YouTube, Google Drive, etc.)</label>
              <Input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://youtube.com/watch?v=..."
              />
              {form.url && getYouTubeId(form.url) && (
                <p className="text-xs text-primary flex items-center gap-1">
                  <Play className="h-3 w-3" /> YouTube video detected — will embed player
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description (optional)</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {saving ? "Saving..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete material?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
