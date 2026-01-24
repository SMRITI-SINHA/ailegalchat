import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/back-button";
import { FlaskConical, Sparkles, GraduationCap, Users, BookOpen } from "lucide-react";

export default function LegalSandboxPage() {
  return (
    <div className="h-full flex flex-col p-6 overflow-auto">
      <div className="flex items-center gap-3 mb-6">
        <BackButton />
        <div className="p-2 rounded-md bg-primary/10">
          <FlaskConical className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-xl">Legal Sandbox</h1>
            <Badge variant="secondary">Beta: Coming Soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Interactive learning environment for moot courts, entrance prep, and legal simulations</p>
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
              Enhance your legal expertise with interactive simulations and practice environments. Join the waitlist for early access.
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
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="font-medium">Study Buddy</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Interactive study tools for law students and exam preparation
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-md bg-muted">
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="font-medium">Moot Court Simulation</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Practice courtroom arguments with AI-powered opposing counsel
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-md bg-muted">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="font-medium">Entrance Prep</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Prepare for law entrance exams with guided practice questions
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
