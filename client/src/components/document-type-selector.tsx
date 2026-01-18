import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { documentTypeHierarchy, type DocumentTypeSelection, type DocumentCategory, type DocumentSubtype } from "@shared/schema";

export type { DocumentTypeSelection } from "@shared/schema";

function truncateText(text: string, maxLength: number = 35): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

interface DocumentTypeSelectorProps {
  value: DocumentTypeSelection | null;
  onChange: (selection: DocumentTypeSelection | null) => void;
  compact?: boolean;
}

export function DocumentTypeSelector({ value, onChange, compact = false }: DocumentTypeSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>(value?.category || "");
  const [selectedSubtype, setSelectedSubtype] = useState<string>(value?.subtype || "");
  const [selectedSubSubtype, setSelectedSubSubtype] = useState<string>(value?.subSubtype || "");
  const [customText, setCustomText] = useState<string>(value?.customText || "");

  const currentCategory = documentTypeHierarchy.find(c => c.id === selectedCategory);
  const currentSubtype = currentCategory?.subtypes.find(s => s.id === selectedSubtype);
  const hasSubSubtypes = currentSubtype?.subSubtypes && currentSubtype.subSubtypes.length > 0;
  
  const needsCustomText = 
    selectedSubtype?.includes("other") || 
    selectedSubtype === "custom_document" ||
    selectedSubSubtype?.includes("other");

  useEffect(() => {
    if (selectedCategory && selectedSubtype) {
      const category = documentTypeHierarchy.find(c => c.id === selectedCategory);
      const subtype = category?.subtypes.find(s => s.id === selectedSubtype);
      const subSubtype = subtype?.subSubtypes?.find(ss => ss.id === selectedSubSubtype);

      const selection: DocumentTypeSelection = {
        category: selectedCategory,
        categoryLabel: category?.label || "",
        subtype: selectedSubtype,
        subtypeLabel: subtype?.label || "",
        subSubtype: selectedSubSubtype || undefined,
        subSubtypeLabel: subSubtype?.label || undefined,
        customText: needsCustomText ? customText : undefined,
      };
      onChange(selection);
    } else {
      onChange(null);
    }
  }, [selectedCategory, selectedSubtype, selectedSubSubtype, customText, needsCustomText]);

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSelectedSubtype("");
    setSelectedSubSubtype("");
    setCustomText("");
  };

  const handleSubtypeChange = (subtypeId: string) => {
    setSelectedSubtype(subtypeId);
    setSelectedSubSubtype("");
    setCustomText("");
  };

  const handleSubSubtypeChange = (subSubtypeId: string) => {
    setSelectedSubSubtype(subSubtypeId);
    if (!subSubtypeId.includes("other")) {
      setCustomText("");
    }
  };

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Category</Label>
            <Select value={selectedCategory} onValueChange={handleCategoryChange}>
              <SelectTrigger className="h-9" data-testid="select-doc-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {documentTypeHierarchy.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Document Type</Label>
            <Select 
              value={selectedSubtype} 
              onValueChange={handleSubtypeChange}
              disabled={!selectedCategory}
            >
              <SelectTrigger className="h-9 overflow-hidden" data-testid="select-doc-subtype">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent className="max-w-[300px]">
                {currentCategory?.subtypes.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id} title={sub.label}>
                    <span className="truncate block max-w-[250px]">{truncateText(sub.label, 35)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {hasSubSubtypes && selectedSubtype && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Statutory Context (Optional)</Label>
            <Select 
              value={selectedSubSubtype} 
              onValueChange={handleSubSubtypeChange}
            >
              <SelectTrigger className="h-9 overflow-hidden" data-testid="select-doc-subsubtype">
                <SelectValue placeholder="Select if applicable" />
              </SelectTrigger>
              <SelectContent className="max-w-[350px]">
                <SelectItem value="none">Not Applicable</SelectItem>
                {currentSubtype?.subSubtypes?.map((ss) => (
                  <SelectItem key={ss.id} value={ss.id} title={ss.label}>
                    <span className="truncate block max-w-[300px]">{truncateText(ss.label, 45)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {needsCustomText && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Specify Document Type</Label>
            <Input
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Enter custom document type"
              className="h-9"
              data-testid="input-custom-doc-type"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Procedural Category</Label>
        <Select value={selectedCategory} onValueChange={handleCategoryChange}>
          <SelectTrigger data-testid="select-doc-category">
            <SelectValue placeholder="Select procedural category" />
          </SelectTrigger>
          <SelectContent>
            {documentTypeHierarchy.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedCategory && (
        <div className="space-y-2">
          <Label>Document Type</Label>
          <Select value={selectedSubtype} onValueChange={handleSubtypeChange}>
            <SelectTrigger data-testid="select-doc-subtype" className="max-w-full overflow-hidden">
              <SelectValue placeholder="Select document type" />
            </SelectTrigger>
            <SelectContent className="max-w-[380px]">
              {currentCategory?.subtypes.map((sub) => (
                <SelectItem key={sub.id} value={sub.id} title={sub.label}>
                  <span className="truncate block max-w-[320px]">{truncateText(sub.label, 50)}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {hasSubSubtypes && selectedSubtype && (
        <div className="space-y-2">
          <Label>Statutory / Contextual Sub-Type (Optional)</Label>
          <Select value={selectedSubSubtype} onValueChange={handleSubSubtypeChange}>
            <SelectTrigger data-testid="select-doc-subsubtype" className="max-w-full overflow-hidden">
              <SelectValue placeholder="Select if applicable" />
            </SelectTrigger>
            <SelectContent className="max-w-[380px]">
              <SelectItem value="none">Not Applicable</SelectItem>
              {currentSubtype?.subSubtypes?.map((ss) => (
                <SelectItem key={ss.id} value={ss.id} title={ss.label}>
                  <span className="truncate block max-w-[320px]">{truncateText(ss.label, 50)}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {needsCustomText && (
        <div className="space-y-2">
          <Label>Specify Custom Document Type</Label>
          <Input
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Enter the specific document type"
            data-testid="input-custom-doc-type"
          />
        </div>
      )}
    </div>
  );
}

export function getDocumentTypeString(selection: DocumentTypeSelection | null): string {
  if (!selection) return "";
  
  let result = `${selection.categoryLabel} - ${selection.subtypeLabel}`;
  
  if (selection.subSubtypeLabel && selection.subSubtype !== "none") {
    result += ` (${selection.subSubtypeLabel})`;
  }
  
  if (selection.customText) {
    result += `: ${selection.customText}`;
  }
  
  return result;
}

export function getDocumentTypeForPrompt(selection: DocumentTypeSelection | null): string {
  if (!selection) return "legal document";
  
  let result = selection.subtypeLabel;
  
  if (selection.subSubtypeLabel && selection.subSubtype !== "none") {
    result += ` under ${selection.subSubtypeLabel}`;
  }
  
  if (selection.customText) {
    result = selection.customText;
  }
  
  return result;
}