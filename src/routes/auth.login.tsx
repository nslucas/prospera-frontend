import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth/login")({
  component: LoginPage,
});

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});
type FormValues = z.infer<typeof schema>;

function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

  const onSubmit = async (values: FormValues) => {
    try {
      await login(values.email, values.password);
      toast.success("Bem-vindo de volta!");
      navigate({ to: "/" });
    } catch (e) {
      toast.error((e as Error).message || "Falha ao entrar");
    }
  };

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <aside className="hidden md:flex flex-col justify-between bg-primary p-10 text-primary-foreground">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary-foreground/15 font-display text-lg">
            F
          </div>
          <span className="font-display text-2xl">Finanx</span>
        </div>
        <div className="space-y-3">
          <h2 className="font-display text-4xl leading-tight">
            Suas finanças com a clareza que você merece.
          </h2>
          <p className="text-sm text-primary-foreground/80">
            Contas, cartões, orçamentos e previsões em um só lugar.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">© Finanx</p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="md:hidden flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-display text-lg">
              F
            </div>
            <span className="font-display text-2xl">Finanx</span>
          </div>
          <div>
            <h1 className="font-display text-3xl">Entrar</h1>
            <p className="text-sm text-muted-foreground">Acesse sua conta para continuar.</p>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" autoComplete="email" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting ? "Entrando…" : "Entrar"}
            </Button>
          </form>
          <p className="text-sm text-muted-foreground">
            Ainda não tem conta?{" "}
            <Link to="/auth/register" className="font-medium text-primary hover:underline">
              Cadastre-se
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
