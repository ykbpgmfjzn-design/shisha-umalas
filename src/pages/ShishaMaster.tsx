import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, PlayCircle, FileText, BookOpen, Wind } from "lucide-react";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import LanguageSelector from "@/components/LanguageSelector";

const VIDEO_INSTRUCTIONS = [
  {
    id: "1",
    titleKey: "shishaMaster.video.basics",
    url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    duration: "12:45",
  },
  {
    id: "2",
    titleKey: "shishaMaster.video.coals",
    url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    duration: "8:30",
  },
  {
    id: "3",
    titleKey: "shishaMaster.video.flavors",
    url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    duration: "15:20",
  },
  {
    id: "4",
    titleKey: "shishaMaster.video.cleaning",
    url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    duration: "10:15",
  },
];

const DOCUMENTS = [
  {
    id: "1",
    titleKey: "shishaMaster.doc.safetyRules",
    type: "pdf",
    size: "2.4 MB",
  },
  {
    id: "2",
    titleKey: "shishaMaster.doc.serviceStandards",
    type: "pdf",
    size: "1.8 MB",
  },
  {
    id: "3",
    titleKey: "shishaMaster.doc.tobaccoGuide",
    type: "pdf",
    size: "3.1 MB",
  },
  {
    id: "4",
    titleKey: "shishaMaster.doc.equipmentManual",
    type: "pdf",
    size: "4.5 MB",
  },
  {
    id: "5",
    titleKey: "shishaMaster.doc.hygieneProtocol",
    type: "pdf",
    size: "1.2 MB",
  },
];

function ShishaMasterContent() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const userRoles = roles?.map(r => r.role) || [];
      const allowed = userRoles.includes("admin") || userRoles.includes("shisha_master");
      
      if (!allowed) {
        navigate("/");
        return;
      }

      setHasAccess(true);
      setLoading(false);
    };

    checkAccess();
  }, [navigate]);

  if (loading || !hasAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Wind className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">{t("shishaMaster.title")}</h1>
            </div>
          </div>
          <LanguageSelector />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="videos" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="videos" className="flex items-center gap-2">
              <PlayCircle className="h-4 w-4" />
              {t("shishaMaster.tabs.videos")}
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t("shishaMaster.tabs.documents")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="videos" className="space-y-6">
            {selectedVideo && (
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="aspect-video">
                    <iframe
                      src={selectedVideo}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {VIDEO_INSTRUCTIONS.map((video) => (
                <Card 
                  key={video.id} 
                  className={`cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 ${
                    selectedVideo === video.url ? "border-primary ring-2 ring-primary/20" : ""
                  }`}
                  onClick={() => setSelectedVideo(video.url)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <PlayCircle className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{t(video.titleKey)}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            {t("shishaMaster.duration")}: {video.duration}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <CardTitle>{t("shishaMaster.documentsTitle")}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {DOCUMENTS.map((doc) => (
                    <div 
                      key={doc.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-destructive/10 rounded-lg">
                          <FileText className="h-5 w-5 text-destructive" />
                        </div>
                        <div>
                          <p className="font-medium">{t(doc.titleKey)}</p>
                          <p className="text-sm text-muted-foreground uppercase">
                            {doc.type} • {doc.size}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        {t("shishaMaster.download")}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default function ShishaMaster() {
  return (
    <LanguageProvider>
      <ShishaMasterContent />
    </LanguageProvider>
  );
}
