"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loginAction, registerAction, type AuthState } from "./actions";

const initial: AuthState = {};

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "…" : children}
    </Button>
  );
}

function ErrorNote({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {error}
    </p>
  );
}

export function LoginForm() {
  const [loginState, doLogin] = useActionState(loginAction, initial);
  const [regState, doRegister] = useActionState(registerAction, initial);

  return (
    <Card>
      <CardContent className="pt-6">
        <Tabs defaultValue="login">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Se connecter</TabsTrigger>
            <TabsTrigger value="register">Créer un compte</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form action={doLogin} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="l-user">Nom d&apos;utilisateur</Label>
                <Input id="l-user" name="username" autoComplete="username" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="l-pass">Mot de passe</Label>
                <Input
                  id="l-pass"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              <ErrorNote error={loginState.error} />
              <SubmitButton>Connexion</SubmitButton>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form action={doRegister} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="r-user">Nom d&apos;utilisateur *</Label>
                <Input id="r-user" name="username" autoComplete="username" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="r-name">Prénom</Label>
                <Input id="r-name" name="name" autoComplete="given-name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="r-email">Email</Label>
                <Input id="r-email" name="email" type="email" autoComplete="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="r-pass">Mot de passe *</Label>
                <Input
                  id="r-pass"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                />
                <p className="text-xs text-muted-foreground">6 caractères minimum</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="r-confirm">Confirmer *</Label>
                <Input
                  id="r-confirm"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                />
              </div>
              <ErrorNote error={regState.error} />
              <SubmitButton>Créer mon compte</SubmitButton>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
