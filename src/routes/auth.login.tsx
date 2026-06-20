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
    <div className="soft-grid grid min-h-screen md:grid-cols-[0.9fr_1.1fr]">
      <aside className="hidden flex-col justify-between border-r border-border/70 bg-white p-10 text-foreground shadow-[18px_0_55px_rgba(21,84,61,0.06)] md:flex">
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary font-display text-lg text-primary-foreground shadow-[0_12px_24px_rgba(37,142,94,0.2)]">
            F
          </div>
          <span className="text-2xl font-semibold tracking-tight">Finanx</span>
        </div>
        <div className="space-y-3">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Suas finanças com a clareza que você merece.
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Contas, cartões, orçamentos e previsões em um só lugar.
          </p>
          <div className="grid max-w-md grid-cols-3 gap-3 pt-4">
            {["Contas", "Cartões", "Metas"].map((item) => (
              <div key={item} className="rounded-lg border border-border bg-muted/35 px-3 py-2 text-sm font-medium">
                {item}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">© Finanx</p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-6 rounded-lg border border-border/80 bg-white p-6 shadow-[0_22px_60px_rgba(21,84,61,0.09)] md:p-8">
          <div className="md:hidden flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground font-display text-lg">
              F
            </div>
            <span className="text-2xl font-semibold tracking-tight">Finanx</span>
          </div>
          <div className="mt-6 md:mt-0">
            <h1 className="text-3xl font-semibold tracking-tight">Entrar</h1>
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
