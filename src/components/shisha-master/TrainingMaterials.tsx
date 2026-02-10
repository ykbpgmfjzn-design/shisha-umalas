import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Video, FileText, Image as ImageIcon, Plus, Trash2, 
  Upload, Play, ExternalLink, BookOpen, Loader2 
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { toast } from "sonner";
import { format } from "date-fns";

interface TrainingMaterial {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_type: string;
  language: string;
  created_at: string;
}

export default function TrainingMaterials() {
  const { t } = useLanguage();
  const { isAdmin } = useUserRoles();
  const [materials, setMaterials] = useState<TrainingMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<TrainingMaterial | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const [form, setForm] = useState({
    title: "",
    description: "",
    language: "en",
    file: null as File | null,
  });
  const [langTab, setLangTab] = useState("en");

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

  const getFileType = (file: File): string => {
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("image/")) return "image";
    return "document";
  };

  const handleUpload = async () => {
    if (!form.title || !form.file) {
      toast.error("Please fill in the title and select a file");
      return;
    }

    setUploading(true);

    try {
      // Upload file to storage
      const fileExt = form.file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("training-materials")
        .upload(fileName, form.file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("training-materials")
        .getPublicUrl(fileName);

      // Save to database
      const { error: dbError } = await supabase
        .from("training_materials")
        .insert({
          title: form.title,
          description: form.description || null,
          file_url: urlData.publicUrl,
          file_type: getFileType(form.file),
          language: form.language,
        });

      if (dbError) throw dbError;

      toast.success("Material added");
      setUploadDialogOpen(false);
      setForm({ title: "", description: "", language: "en", file: null });
      fetchMaterials();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Upload error");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedMaterial) return;

    try {
      // Extract filename from URL
      const urlParts = selectedMaterial.file_url.split("/");
      const fileName = urlParts[urlParts.length - 1];

      // Delete from storage
      await supabase.storage
        .from("training-materials")
        .remove([fileName]);

      // Delete from database
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
      console.error("Delete error:", error);
      toast.error("Delete error");
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "video": return <Video className="h-5 w-5" />;
      case "image": return <ImageIcon className="h-5 w-5" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case "video": return "default";
      case "image": return "secondary";
      default: return "outline";
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

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Training Materials
          </CardTitle>
          {isAdmin && (
            <Button onClick={() => setUploadDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Material
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredMaterials.map((material) => (
                <Card key={material.id} className="overflow-hidden">
                  {material.file_type === "video" && (
                    <div className="aspect-video bg-muted relative">
                      <video
                        src={material.file_url}
                        className="w-full h-full object-cover"
                        controls={false}
                      />
                      <a
                        href={material.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
                      >
                        <div className="p-3 rounded-full bg-primary text-primary-foreground">
                          <Play className="h-6 w-6" />
                        </div>
                      </a>
                    </div>
                  )}
                  {material.file_type === "image" && (
                    <a
                      href={material.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block aspect-video bg-muted"
                    >
                      <img
                        loading="lazy" src={material.file_url}
                        alt={material.title}
                        className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                      />
                    </a>
                  )}
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={getBadgeVariant(material.file_type)}>
                          {getIcon(material.file_type)}
                          <span className="ml-1 capitalize">{material.file_type}</span>
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(material.created_at), "dd.MM.yyyy")}
                      </span>
                    </div>
                    <h3 className="font-medium mb-1">{material.title}</h3>
                    {material.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {material.description}
                      </p>
                    )}
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        asChild
                      >
                        <a href={material.file_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open
                        </a>
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setSelectedMaterial(material);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
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
              <label className="text-sm font-medium">Title</label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Material title"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Description (optional)"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">File</label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="video/*,image/*,.pdf,.doc,.docx"
                  onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
                  className="flex-1"
                />
              </div>
              {form.file && (
                <p className="text-sm text-muted-foreground">
                  {form.file.name} ({(form.file.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              {t("admin.cancel")}
            </Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("shishaMaster.training.uploading")}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {t("shishaMaster.training.upload")}
                </>
              )}
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
