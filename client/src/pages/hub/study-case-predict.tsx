import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, Sparkles, TrendingUp, BarChart3, AlertTriangle, CheckCircle } from "lucide-react";

export default function CasePredictPage() {
  return (
    <div className="h-full flex flex-col p-6 overflow-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-md bg-primary/10">
          <Brain className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-xl">Case Predict AI</h1>
            <Badge variant="secondary">Beta: Coming Soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Predict case outcomes using Advanced AI with detailed reasoning</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-8 text-center">
            <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Coming Soon</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Our advanced AI-powered case prediction system is under development. Get early access by joining the waitlist.
            </p>
            <Button disabled data-testid="button-join-waitlist">
              Join Waitlist
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3 mt-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-md bg-muted">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="font-medium">Case Analysis</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Deep analysis of case facts, precedents, and legal principles to predict outcomes
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-md bg-muted">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="font-medium">Predictions</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Probability scores and confidence levels for different case outcomes
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-md bg-muted">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="font-medium">Risk Assessment</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Identify potential risks and strategic considerations for your case
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
