import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StreamingIndicator } from "@/components/streaming-text";
import {
  ClipboardCheck,
  Wand2,
  Save,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Plus,
  Upload,
} from "lucide-react";
import type { ChecklistItem } from "@shared/schema";

const industries = [
  "Startup / Tech",
  "Fintech",
  "Edtech",
  "Healthcare",
  "E-commerce",
  "Real Estate",
  "Manufacturing",
  "NBFC",
  "Banking",
  "Insurance",
];

const jurisdictions = [
  "Pan India",
  "Maharashtra",
  "Delhi NCR",
  "Karnataka",
  "Tamil Nadu",
  "Gujarat",
  "Telangana",
];

const activities = [
  "Company Incorporation",
  "Fundraising / Investment",
  "Employment / HR",
  "Data Processing / Privacy",
  "Licensing & Permits",
  "Tax Compliance",
  "Environmental Clearance",
  "Export / Import",
];

export default function ComplianceChecklistPage() {
  const [industry, setIndustry] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [activity, setActivity] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);

  const handleGenerate = async () => {
    if (!industry || !jurisdiction || !activity) return;
    setIsGenerating(true);

    setTimeout(() => {
      setChecklist([
        {
          id: "1",
          title: "Register with Registrar of Companies (ROC)",
          description: "File incorporation documents including MOA, AOA, and Form SPICe+",
          legalReference: "Companies Act, 2013 - Section 7",
          deadline: "Before commencing business",
          riskLevel: "high",
          completed: false,
        },
        {
          id: "2",
          title: "Obtain PAN and TAN",
          description: "Apply for Permanent Account Number and Tax Deduction Account Number",
          legalReference: "Income Tax Act, 1961",
          deadline: "Within 30 days of incorporation",
          riskLevel: "high",
          completed: false,
        },
        {
          id: "3",
          title: "GST Registration",
          description: "Register for Goods and Services Tax if turnover exceeds threshold",
          legalReference: "CGST Act, 2017 - Section 22",
          deadline: "Within 30 days of becoming liable",
          riskLevel: "high",
          completed: false,
        },
        {
          id: "4",
          title: "Open Current Bank Account",
          description: "Open corporate bank account with incorporation documents",
          legalReference: "RBI Guidelines",
          deadline: "Within 180 days",
          riskLevel: "medium",
          completed: false,
        },
        {
          id: "5",
          title: "Register for EPFO and ESIC",
          description: "Mandatory if employing 20+ employees (EPFO) or 10+ (ESIC)",
          legalReference: "EPF Act, 1952 / ESI Act, 1948",
          deadline: "Within 1 month of threshold",
          riskLevel: "medium",
          completed: false,
        },
        {
          id: "6",
          title: "Shops and Establishment Registration",
          description: "Register under local Shops and Establishment Act",
          legalReference: "State Shops & Establishment Act",
          deadline: "Within 30 days of setup",
          riskLevel: "low",
          completed: false,
        },
        {
          id: "7",
          title: "Professional Tax Registration",
          description: "Register for professional tax where applicable",
          legalReference: "State Professional Tax Act",
          deadline: "Before first salary payment",
          riskLevel: "low",
          completed: false,
        },
        {
          id: "8",
          title: "Trademark Registration",
          description: "Register company name and logo as trademark",
          legalReference: "Trade Marks Act, 1999",
          deadline: "Recommended early stage",
          riskLevel: "low",
          completed: false,
        },
      ]);
      setIsGenerating(false);
    }, 2000);
  };

  const toggleItem = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const completedCount = checklist.filter((i) => i.completed).length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-md bg-primary/10">
          <ClipboardCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Compliance Checklist Generator</h1>
          <p className="text-muted-foreground">Generate industry-specific compliance checklists</p>
        </div>
      </div>

      {checklist.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generate Compliance Checklist</CardTitle>
            <CardDescription>
              Select your industry, jurisdiction, and activity to generate a customized compliance checklist
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>Industry</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger data-testid="select-industry">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {industries.map((i) => (
                      <SelectItem key={i} value={i}>{i}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Jurisdiction</Label>
                <Select value={jurisdiction} onValueChange={setJurisdiction}>
                  <SelectTrigger data-testid="select-jurisdiction">
                    <SelectValue placeholder="Select jurisdiction" />
                  </SelectTrigger>
                  <SelectContent>
                    {jurisdictions.map((j) => (
                      <SelectItem key={j} value={j}>{j}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Activity</Label>
                <Select value={activity} onValueChange={setActivity}>
                  <SelectTrigger data-testid="select-activity">
                    <SelectValue placeholder="Select activity" />
                  </SelectTrigger>
                  <SelectContent>
                    {activities.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={!industry || !jurisdiction || !activity || isGenerating}
              className="w-full"
              data-testid="button-generate"
            >
              {isGenerating ? (
                <>
                  <StreamingIndicator className="mr-2" />
                  Generating Checklist...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Generate Checklist
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-semibold">
                {industry} - {activity}
              </h2>
              <p className="text-sm text-muted-foreground">{jurisdiction}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline">
                {completedCount}/{checklist.length} completed
              </Badge>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button size="sm" data-testid="button-save">
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {checklist.map((item) => (
              <Card key={item.id} className={item.completed ? "opacity-75" : ""} data-testid={`checklist-item-${item.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={item.completed}
                      onCheckedChange={() => toggleItem(item.id)}
                      className="mt-1"
                      data-testid={`checkbox-${item.id}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-medium ${item.completed ? "line-through" : ""}`}>
                          {item.title}
                        </h3>
                        <Badge
                          variant={
                            item.riskLevel === "high"
                              ? "destructive"
                              : item.riskLevel === "medium"
                              ? "secondary"
                              : "outline"
                          }
                          className="text-[10px]"
                        >
                          {item.riskLevel} risk
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {item.legalReference}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {item.deadline}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button variant="ghost" size="sm" className="text-xs h-7">
                        <Plus className="h-3 w-3 mr-1" />
                        Notes
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs h-7">
                        <Upload className="h-3 w-3 mr-1" />
                        Proof
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
