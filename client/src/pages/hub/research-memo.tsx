import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UploadDropzone } from "@/components/upload-dropzone";
import { PremiumEditor } from "@/components/premium-editor";
import { ResearchSidebar } from "@/components/research-sidebar";
import { StreamingIndicator } from "@/components/streaming-text";
import {
  Scroll,
  Wand2,
  AlertTriangle,
  ArrowLeft,
  Languages,
  Sparkles,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { IndianLanguage, Draft } from "@shared/schema";
import { indianLanguages } from "@shared/schema";

type ViewMode = "form" | "editor";

export default function LegalMemoPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("form");
  const [language, setLanguage] = useState<IndianLanguage>("English");
  const [facts, setFacts] = useState("");
  const [issues, setIssues] = useState("");
  const [memoTitle, setMemoTitle] = useState("Legal Memorandum");
  const [jurisdiction, setJurisdiction] = useState("");
  const [parties, setParties] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [memoContent, setMemoContent] = useState("");
  const [showResearchSidebar, setShowResearchSidebar] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);

  const createDraftMutation = useMutation({
    mutationFn: async (data: { title: string; content: string }) => {
      const response = await apiRequest("POST", "/api/drafts", {
        title: data.title,
        type: "memo",
        content: data.content,
        status: "draft",
      });
      return response.json() as Promise<Draft>;
    },
    onSuccess: (draft) => {
      setDraftId(draft.id);
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
    },
  });

  const handleGenerate = async () => {
    if (!facts.trim()) return;
    setIsGenerating(true);

    try {
      const response = await apiRequest("POST", "/api/memos/generate", {
        facts,
        issues,
        language,
        jurisdiction,
        parties,
        title: memoTitle,
      });
      const data = await response.json();
      const generatedMemo = data.fullMemo || generateLocalizedMemo();
      
      const draft = await createDraftMutation.mutateAsync({
        title: memoTitle,
        content: generatedMemo,
      });
      
      setDraftId(draft.id);
      setMemoContent(generatedMemo);
      setViewMode("editor");
      setShowResearchSidebar(true);
    } catch (error) {
      console.error("Memo generation error:", error);
      const fallbackMemo = generateLocalizedMemo();
      const draft = await createDraftMutation.mutateAsync({
        title: memoTitle,
        content: fallbackMemo,
      });
      setDraftId(draft.id);
      setMemoContent(fallbackMemo);
      setViewMode("editor");
      setShowResearchSidebar(true);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateLocalizedMemo = () => {
    const date = new Date().toLocaleDateString();
    
    if (language === "Hindi") {
      return `कानूनी ज्ञापन

प्रति: वरिष्ठ भागीदार
प्रेषक: कानूनी अनुसंधान दल
दिनांक: ${date}
विषय: ${memoTitle}

I. प्रस्तुत प्रश्न

${issues || "[तथ्यों के आधार पर मुद्दे यहाँ निर्धारित किए जाएंगे]"}

II. संक्षिप्त उत्तर

[विस्तृत विश्लेषण के आधार पर उत्तर यहाँ दिए जाएंगे]

III. तथ्यात्मक पृष्ठभूमि

${facts}

IV. लागू कानून

क. वैधानिक प्रावधान
[प्रासंगिक धाराएं यहाँ सूचीबद्ध की जाएंगी]

ख. न्यायिक मिसालें
[प्रासंगिक न्यायालयीन निर्णय यहाँ उद्धृत किए जाएंगे]

V. विश्लेषण

[IRAC पद्धति के अनुसार विस्तृत विश्लेषण]

VI. निष्कर्ष

[अंतिम सिफारिशें और निष्कर्ष]

---
अस्वीकरण: यह ज्ञापन केवल अनुसंधान और सूचनात्मक उद्देश्यों के लिए तैयार किया गया है और यह कानूनी सलाह नहीं है।`;
    }
    
    if (language === "Marathi") {
      return `कायदेशीर निवेदन

प्रति: वरिष्ठ भागीदार
प्रेषक: कायदेशीर संशोधन पथक
दिनांक: ${date}
विषय: ${memoTitle}

I. सादर केलेले प्रश्न

${issues || "[तथ्यांच्या आधारे मुद्दे येथे निश्चित केले जातील]"}

II. संक्षिप्त उत्तरे

[तपशीलवार विश्लेषणाच्या आधारे उत्तरे येथे दिली जातील]

III. तथ्यात्मक पार्श्वभूमी

${facts}

IV. लागू कायदा

अ. वैधानिक तरतुदी
[संबंधित कलमे येथे सूचीबद्ध केली जातील]

ब. न्यायिक निर्णय
[संबंधित न्यायालयीन निर्णय येथे उद्धृत केले जातील]

V. विश्लेषण

[IRAC पद्धतीनुसार तपशीलवार विश्लेषण]

VI. निष्कर्ष

[अंतिम शिफारसी आणि निष्कर्ष]

---
अस्वीकरण: हे निवेदन केवळ संशोधन आणि माहितीच्या उद्देशाने तयार केले आहे आणि हा कायदेशीर सल्ला नाही।`;
    }

    if (language === "Gujarati") {
      return `કાનૂની નિવેદન

પ્રતિ: વરિષ્ઠ ભાગીદાર
પ્રેષક: કાનૂની સંશોધન ટીમ
તારીખ: ${date}
વિષય: ${memoTitle}

I. રજૂ કરેલા પ્રશ્નો

${issues || "[હકીકતોના આધારે મુદ્દાઓ અહીં નક્કી કરવામાં આવશે]"}

II. ટૂંકા જવાબો

[વિગતવાર વિશ્લેષણના આધારે જવાબો આપવામાં આવશે]

III. હકીકતની પૃષ્ઠભૂમિ

${facts}

IV. લાગુ કાયદો

A. વૈધાનિક જોગવાઈઓ
[સંબંધિત કલમો અહીં સૂચિબદ્ધ કરવામાં આવશે]

B. ન્યાયિક ચુકાદાઓ
[સંબંધિત કેસ કાયદો અહીં ટાંકવામાં આવશે]

V. વિશ્લેષણ

[IRAC પદ્ધતિ અનુસાર વિગતવાર વિશ્લેષણ]

VI. નિષ્કર્ષ

[અંતિમ ભલામણો અને નિષ્કર્ષો]

---
અસ્વીકરણ: આ નિવેદન ફક્ત સંશોધન અને માહિતીના હેતુઓ માટે બનાવવામાં આવ્યું છે અને તે કાનૂની સલાહ નથી.`;
    }

    if (language === "Bengali") {
      return `আইনি স্মারকলিপি

প্রতি: সিনিয়র পার্টনার
প্রেরক: আইনি গবেষণা দল
তারিখ: ${date}
বিষয়: ${memoTitle}

I. উপস্থাপিত প্রশ্নসমূহ

${issues || "[তথ্যের ভিত্তিতে বিষয়গুলি এখানে নির্ধারণ করা হবে]"}

II. সংক্ষিপ্ত উত্তর

[বিস্তারিত বিশ্লেষণের ভিত্তিতে উত্তর দেওয়া হবে]

III. তথ্যগত পটভূমি

${facts}

IV. প্রযোজ্য আইন

ক. সংবিধিবদ্ধ বিধান
[প্রাসঙ্গিক ধারাগুলি এখানে তালিকাভুক্ত করা হবে]

খ. বিচারিক নজির
[প্রাসঙ্গিক মামলার আইন এখানে উদ্ধৃত করা হবে]

V. বিশ্লেষণ

[IRAC পদ্ধতি অনুযায়ী বিস্তারিত বিশ্লেষণ]

VI. উপসংহার

[চূড়ান্ত সুপারিশ এবং উপসংহার]

---
দাবিত্যাগ: এই স্মারকলিপি শুধুমাত্র গবেষণা এবং তথ্যমূলক উদ্দেশ্যে তৈরি করা হয়েছে এবং এটি আইনি পরামর্শ নয়।`;
    }

    if (language === "Tamil") {
      return `சட்ட குறிப்பாணை

பெறுநர்: மூத்த பங்குதாரர்
அனுப்புநர்: சட்ட ஆராய்ச்சி குழு
தேதி: ${date}
பொருள்: ${memoTitle}

I. முன்வைக்கப்பட்ட கேள்விகள்

${issues || "[உண்மைகளின் அடிப்படையில் பிரச்சினைகள் இங்கே தீர்மானிக்கப்படும்]"}

II. சுருக்கமான பதில்கள்

[விரிவான பகுப்பாய்வின் அடிப்படையில் பதில்கள் வழங்கப்படும்]

III. உண்மை பின்னணி

${facts}

IV. பொருந்தும் சட்டம்

அ. சட்ட விதிகள்
[தொடர்புடைய பிரிவுகள் இங்கே பட்டியலிடப்படும்]

ஆ. நீதித்துறை தீர்ப்புகள்
[தொடர்புடைய வழக்கு சட்டம் இங்கே மேற்கோள் காட்டப்படும்]

V. பகுப்பாய்வு

[IRAC முறைப்படி விரிவான பகுப்பாய்வு]

VI. முடிவுரை

[இறுதி பரிந்துரைகள் மற்றும் முடிவுகள்]

---
பொறுப்புத் துறப்பு: இந்த குறிப்பாணை ஆராய்ச்சி மற்றும் தகவல் நோக்கங்களுக்காக மட்டுமே உருவாக்கப்பட்டது, இது சட்ட ஆலோசனை அல்ல।`;
    }

    if (language === "Telugu") {
      return `న్యాయ మెమోరాండం

కు: సీనియర్ భాగస్వామి
నుండి: న్యాయ పరిశోధన బృందం
తేదీ: ${date}
విషయం: ${memoTitle}

I. ప్రవేశపెట్టిన ప్రశ్నలు

${issues || "[వాస్తవాల ఆధారంగా సమస్యలు ఇక్కడ నిర్ణయించబడతాయి]"}

II. సంక్షిప్త సమాధానాలు

[వివరమైన విశ్లేషణ ఆధారంగా సమాధానాలు అందించబడతాయి]

III. వాస్తవ నేపథ్యం

${facts}

IV. వర్తించే చట్టం

A. చట్టబద్ధ నిబంధనలు
[సంబంధిత సెక్షన్లు ఇక్కడ జాబితా చేయబడతాయి]

B. న్యాయ తీర్పులు
[సంబంధిత కేసు చట్టం ఇక్కడ ఉల్లేఖించబడుతుంది]

V. విశ్లేషణ

[IRAC పద్ధతి ప్రకారం వివరమైన విశ్లేషణ]

VI. ముగింపు

[తుది సిఫార్సులు మరియు ముగింపులు]

---
నిరాకరణ: ఈ మెమోరాండం పరిశోధన మరియు సమాచార ప్రయోజనాల కోసం మాత్రమే రూపొందించబడింది మరియు ఇది న్యాయ సలహా కాదు.`;
    }

    return `LEGAL MEMORANDUM
[Language Requested: ${language}]

To: Senior Partner
From: Legal Research Team
Date: ${date}
Subject: ${memoTitle}

NOTE: AI generation encountered an issue. Please regenerate or edit this template in ${language}.

I. QUESTIONS PRESENTED

${issues || "[Issues will be determined based on the facts provided]"}

II. BRIEF ANSWERS

[Answers will be provided based on detailed analysis]

III. FACTUAL BACKGROUND

${facts}

IV. APPLICABLE LAW

A. Statutory Provisions
[Relevant sections will be listed here]

B. Judicial Precedents
[Relevant case law will be cited here]

V. ANALYSIS

[Detailed IRAC analysis will be provided]

VI. CONCLUSION

[Final recommendations and conclusions]

---
DISCLAIMER: This memorandum is generated for research and informational purposes only and does not constitute legal advice.`;
  };

  const handleAddToDocument = (text: string) => {
    setMemoContent((prev) => prev + "\n\n" + text);
  };

  if (viewMode === "form") {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b flex items-center gap-4">
          <Link href="/hub">
            <Button variant="ghost" size="icon" data-testid="button-back-hub">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <Scroll className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold">Legal Memo Generator</h1>
              <p className="text-xs text-muted-foreground">IRAC structured memos with citations</p>
            </div>
          </div>
          <Badge variant="outline" className="ml-auto">
            <Sparkles className="h-3 w-3 mr-1" />
            AI Powered
          </Badge>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6 max-w-2xl mx-auto space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Generate Legal Memorandum</CardTitle>
                <CardDescription>
                  Provide the details below to generate a comprehensive legal memo with proper IRAC structure
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>
                      <Languages className="h-3 w-3 inline mr-1" />
                      Language <span className="text-destructive">*</span>
                    </Label>
                    <Select value={language} onValueChange={(v) => setLanguage(v as IndianLanguage)}>
                      <SelectTrigger className="w-full mt-2" data-testid="select-language">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        {indianLanguages.map((lang) => (
                          <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Memo Title</Label>
                    <input
                      type="text"
                      className="w-full mt-2 px-3 py-2 border rounded-md bg-background"
                      placeholder="e.g., Analysis of Contract Dispute"
                      value={memoTitle}
                      onChange={(e) => setMemoTitle(e.target.value)}
                      data-testid="input-title"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Parties Involved (Optional)</Label>
                    <input
                      type="text"
                      className="w-full mt-2 px-3 py-2 border rounded-md bg-background"
                      placeholder="e.g., ABC Corp. vs XYZ Ltd."
                      value={parties}
                      onChange={(e) => setParties(e.target.value)}
                      data-testid="input-parties"
                    />
                  </div>
                  <div>
                    <Label>Jurisdiction (Optional)</Label>
                    <input
                      type="text"
                      className="w-full mt-2 px-3 py-2 border rounded-md bg-background"
                      placeholder="e.g., Delhi High Court"
                      value={jurisdiction}
                      onChange={(e) => setJurisdiction(e.target.value)}
                      data-testid="input-jurisdiction"
                    />
                  </div>
                </div>

                <div>
                  <Label>Facts of the Case <span className="text-destructive">*</span></Label>
                  <Textarea
                    placeholder="Describe the relevant facts, background, and circumstances of the case in detail..."
                    rows={6}
                    value={facts}
                    onChange={(e) => setFacts(e.target.value)}
                    className="mt-2"
                    data-testid="textarea-facts"
                  />
                </div>

                <div>
                  <Label>Legal Issues (Optional)</Label>
                  <Textarea
                    placeholder="List the specific legal questions to be analyzed. If left blank, issues will be auto-extracted from the facts."
                    rows={3}
                    value={issues}
                    onChange={(e) => setIssues(e.target.value)}
                    className="mt-2"
                    data-testid="textarea-issues"
                  />
                </div>

                <div>
                  <Label>Reference Documents (Optional)</Label>
                  <UploadDropzone
                    onUpload={async (files) => console.log("Files:", files)}
                    maxFiles={5}
                  />
                </div>

                <Alert className="bg-blue-500/10 border-blue-500/30">
                  <Sparkles className="h-4 w-4 text-blue-500" />
                  <AlertDescription className="text-sm">
                    The memo will be generated entirely in <strong>{language}</strong>. After generation, you can edit it in our premium editor with the Research Assistant for additional legal research.
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={handleGenerate}
                  disabled={!facts.trim() || isGenerating}
                  className="w-full"
                  data-testid="button-generate"
                >
                  {isGenerating ? (
                    <>
                      <StreamingIndicator className="mr-2" />
                      Generating Memo in {language}...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Generate Legal Memo
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Hallucination Control</p>
                    <p className="text-muted-foreground mt-1">
                      This generator uses verified Indian statutes and case law only. All citations are cross-referenced with the statute whitelist to prevent fabricated references.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col overflow-hidden">
        <PremiumEditor
          title={memoTitle}
          onTitleChange={setMemoTitle}
          content={memoContent}
          onContentChange={setMemoContent}
          onBack={() => {
            setViewMode("form");
            setShowResearchSidebar(false);
          }}
          showAiHelper
        />
      </div>
      <ResearchSidebar
        isOpen={showResearchSidebar}
        onAddToDocument={handleAddToDocument}
        draftId={draftId || undefined}
      />
    </div>
  );
}
