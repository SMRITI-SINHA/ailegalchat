import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/back-button";
import { Swords, Sparkles, Shield, Target, Lightbulb } from "lucide-react";

export default function CounterArgsPage() {
  return (
    <div className="h-full flex flex-col p-6 overflow-auto">
      <div className="flex items-center gap-3 mb-6">
        <BackButton />
        <div className="p-2 rounded-md bg-primary/10">
          <Swords className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-xl">Counter Argument Generator</h1>
            <Badge variant="secondary">Beta: Coming Soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Develop opposing viewpoints, rebuttals, and explore multiple angles of legal challenges</p>
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
              Generate strategic counter-arguments and rebuttals to strengthen your legal position. Join the waitlist for early access.
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
                  <Swords className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="font-medium">Counter Arguments</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Generate strong counter-arguments for any legal position or claim
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-md bg-muted">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="font-medium">Strategic Rebuttals</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Craft procedural defenses and relevant precedents for your case
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-md bg-muted">
                  <Lightbulb className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="font-medium">Factual Analysis</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Explore multiple angles and perspectives on the facts of your case
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
