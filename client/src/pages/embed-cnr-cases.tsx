import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Scale, Search, Clock, Hash, Calendar, Gavel, Users, Info,
  FileCheck, AlertCircle, ArrowRightLeft, History, ChevronDown,
  ChevronUp, ArrowLeft, BookmarkCheck, X
} from "lucide-react";

interface SavedCase {
  id: string;
  cnrNumber: string;
  caseType: string | null;
  filingNumber: string | null;
  filingDate: string | null;
  registrationNumber: string | null;
  registrationDate: string | null;
  caseStatus: string | null;
  firstHearingDate: string | null;
  nextHearingDate: string | null;
  caseStage: string | null;
  courtNumberAndJudge: string | null;
  petitioners: string | null;
  respondents: string | null;
  actsAndSections: string | null;
  caseTransferDetails: string | null;
  caseHistory: string | null;
  savedAt: string;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseHistoryEntries(history: string | null) {
  if (!history) return [];
  return history.split("\n").filter(Boolean).map((line) => {
    const parts = line.split(" | ");
    return { date: parts[0]?.trim() || "", event: parts.slice(1).join(" | ").trim() || line };
  });
}

function getStatusColor(status: string | null) {
  if (!status) return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  const s = status.toLowerCase();
  if (s.includes("pending") || s.includes("progress")) return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
  if (s.includes("disposed") || s.includes("closed") || s.includes("decided") || s.includes("acquit")) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
}

function DetailSection({ icon, label, value, testId }: { icon: React.ReactNode; label: string; value: string | null; testId?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="text-gray-400 mt-0.5 flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">{label}</p>
        <p className="text-sm mt-0.5 whitespace-pre-wrap text-gray-800 dark:text-gray-200" data-testid={testId}>{value}</p>
      </div>
    </div>
  );
}

function CaseDetail({ c, onBack }: { c: SavedCase; onBack: () => void }) {
  const [expandedHistory, setExpandedHistory] = useState(false);
  const historyEntries = parseHistoryEntries(c.caseHistory);
  const showHistoryLimit = expandedHistory ? historyEntries.length : 5;

  return (
    <div className="flex flex-col h-full">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 mb-4 transition-colors"
        data-testid="button-embed-back-to-cases"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to all cases
      </button>

      <div className="flex-1 overflow-y-auto pr-1">
        <div className="pb-3 border-b border-gray-200 dark:border-gray-700 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {c.caseType && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                {c.caseType}
              </span>
            )}
            {c.caseStatus && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(c.caseStatus)}`}>
                {c.caseStatus}
              </span>
            )}
          </div>
          <p className="font-mono text-sm text-gray-500 dark:text-gray-400 mt-2" data-testid="text-embed-case-cnr">
            CNR: {c.cnrNumber}
          </p>
        </div>

        <div className="space-y-0.5">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2">
            <FileCheck className="h-3 w-3" />
            Case Information
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <DetailSection icon={<Hash className="h-4 w-4" />} label="Filing Number" value={c.filingNumber} testId="text-embed-filing-number" />
            <DetailSection icon={<Calendar className="h-4 w-4" />} label="Filing Date" value={c.filingDate} testId="text-embed-filing-date" />
            <DetailSection icon={<Hash className="h-4 w-4" />} label="Registration Number" value={c.registrationNumber} testId="text-embed-reg-number" />
            <DetailSection icon={<Calendar className="h-4 w-4" />} label="Registration Date" value={c.registrationDate} testId="text-embed-reg-date" />
            <DetailSection icon={<Calendar className="h-4 w-4" />} label="First Hearing Date" value={c.firstHearingDate} testId="text-embed-first-hearing" />
            <DetailSection icon={<Calendar className="h-4 w-4" />} label="Next Hearing Date" value={c.nextHearingDate} testId="text-embed-next-hearing" />
            <DetailSection icon={<Scale className="h-4 w-4" />} label="Case Stage" value={c.caseStage} testId="text-embed-case-stage" />
          </div>
          <DetailSection icon={<Gavel className="h-4 w-4" />} label="Court Number & Judge" value={c.courtNumberAndJudge} testId="text-embed-court-judge" />
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3 space-y-0.5">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2">
            <Users className="h-3 w-3" />
            Parties Involved
          </h4>
          <DetailSection icon={<Users className="h-4 w-4" />} label="Petitioner(s) with Advocate(s)" value={c.petitioners} testId="text-embed-petitioners" />
          <DetailSection icon={<Users className="h-4 w-4" />} label="Respondent(s) with Advocate(s)" value={c.respondents} testId="text-embed-respondents" />
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3 space-y-0.5">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2">
            <Info className="h-3 w-3" />
            Additional Details
          </h4>
          <DetailSection icon={<AlertCircle className="h-4 w-4" />} label="Acts & Sections" value={c.actsAndSections} testId="text-embed-acts-sections" />
          <DetailSection icon={<ArrowRightLeft className="h-4 w-4" />} label="Case Transfer Details" value={c.caseTransferDetails} testId="text-embed-transfer" />
        </div>

        {historyEntries.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
              <History className="h-3 w-3" />
              Case History ({historyEntries.length} hearings)
            </h4>
            <div className="space-y-0">
              {historyEntries.slice(0, showHistoryLimit).map((entry, i) => (
                <div key={i} className="flex gap-3 pb-3 relative" data-testid={`embed-history-entry-${i}`}>
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                    {i < Math.min(showHistoryLimit, historyEntries.length) - 1 && (
                      <div className="w-px flex-1 bg-gray-200 dark:bg-gray-700 mt-1" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <p className="text-xs font-mono text-gray-400">{entry.date}</p>
                    <p className="text-sm mt-0.5 text-gray-800 dark:text-gray-200">{entry.event}</p>
                  </div>
                </div>
              ))}
            </div>
            {historyEntries.length > 5 && (
              <button
                onClick={() => setExpandedHistory(!expandedHistory)}
                className="w-full text-center text-xs text-blue-600 dark:text-blue-400 hover:underline py-1.5"
                data-testid="button-embed-toggle-history"
              >
                {expandedHistory ? (
                  <span className="flex items-center justify-center gap-1"><ChevronUp className="h-3 w-3" /> Show less</span>
                ) : (
                  <span className="flex items-center justify-center gap-1"><ChevronDown className="h-3 w-3" /> Show all {historyEntries.length} entries</span>
                )}
              </button>
            )}
          </div>
        )}

        <div className="text-xs text-gray-400 flex items-center gap-1 pt-3 border-t border-gray-200 dark:border-gray-700 mt-3 pb-4">
          <Clock className="h-3 w-3" />
          Saved on {formatDate(c.savedAt)}
        </div>
      </div>
    </div>
  );
}

export default function EmbedCNRCases() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCase, setSelectedCase] = useState<SavedCase | null>(null);

  const { data: apiCases = [], isLoading } = useQuery<SavedCase[]>({
    queryKey: ["/api/cnr/saved-cases"],
  });

  const allCases = apiCases;

  const filteredCases = searchQuery.trim()
    ? allCases.filter(c => {
        const q = searchQuery.trim().toUpperCase();
        return c.cnrNumber.toUpperCase().includes(q)
          || (c.caseType && c.caseType.toUpperCase().includes(q))
          || (c.filingNumber && c.filingNumber.toUpperCase().includes(q))
          || (c.petitioners && c.petitioners.toUpperCase().includes(q))
          || (c.respondents && c.respondents.toUpperCase().includes(q));
      })
    : allCases;

  return (
    <div
      className="h-full min-h-screen w-full flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
      data-testid="embed-cnr-cases-root"
    >
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-900/20">
          <BookmarkCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold" data-testid="text-embed-cnr-title">Saved CNR Cases</h1>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">
            {filteredCases.length} case{filteredCases.length !== 1 ? "s" : ""}
            {searchQuery.trim() && ` matching "${searchQuery.trim()}"`}
          </p>
        </div>
        <span className="text-[9px] text-gray-400 dark:text-gray-500 font-medium tracking-wide">
          CHAKSHI
        </span>
      </div>

      {!selectedCase && (
        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by CNR number, case type, parties..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
              data-testid="input-embed-cnr-search"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                data-testid="button-embed-clear-search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded-lg" />
              </div>
            ))}
          </div>
        ) : selectedCase ? (
          <CaseDetail c={selectedCase} onBack={() => setSelectedCase(null)} />
        ) : filteredCases.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <Search className="h-8 w-8 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              {searchQuery.trim() ? "No cases match your search" : "No saved cases yet"}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {searchQuery.trim() ? "Try a different CNR number or keyword" : "Cases saved from CNR lookup will appear here"}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredCases.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCase(c)}
                className="w-full text-left p-3.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all group"
                data-testid={`embed-saved-case-${c.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      {c.caseType && (
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{c.caseType}</span>
                      )}
                      {c.caseStatus && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${getStatusColor(c.caseStatus)}`}>
                          {c.caseStatus}
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-xs text-gray-500 dark:text-gray-400 truncate" data-testid={`text-embed-cnr-${c.id}`}>
                      {c.cnrNumber}
                    </p>
                    {c.nextHearingDate && (
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Next hearing: {c.nextHearingDate}
                      </p>
                    )}
                    {c.petitioners && (
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                        {c.petitioners.split("\n")[0]}
                      </p>
                    )}
                  </div>
                  <ArrowLeft className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600 group-hover:text-blue-500 rotate-180 flex-shrink-0 mt-1 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
        <p className="text-[9px] text-center text-gray-400 dark:text-gray-500">
          Powered by Chakshi Legal AI
        </p>
      </div>
    </div>
  );
}
