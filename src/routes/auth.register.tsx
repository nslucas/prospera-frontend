import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth/register")({
  component: RegisterPage,
});

const schema = z.object({
  firstName: z.string().min(1, "Informe o nome"),
  lastName: z.string().min(1, "Informe o sobrenome"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Mínimo de 6 caracteres"),
});
type FormValues = z.infer<typeof schema>;

function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      await registerUser(values);
      toast.success("Conta criada com sucesso!");
      navigate({ to: "/" });
    } catch (e) {
      toast.error((e as Error).message || "Falha ao cadastrar");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-6">
        <Link to="/auth/login" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-display text-lg">
            F
          </div>
          <span className="font-display text-2xl">Finanx</span>
        </Link>
        <div>
          <h1 className="font-display text-3xl">Criar conta</h1>
          <p className="text-sm text-muted-foreground">Comece a organizar sua vida financeira.</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">Nome</Label>
              <Input id="firstName" {...register("firstName")} />
              {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Sobrenome</Label>
              <Input id="lastName" {...register("lastName")} />
              {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" autoComplete="email" {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
            {isSubmitting ? "Criando…" : "Criar conta"}
          </Button>
        </form>
        <p className="text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/auth/login" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
