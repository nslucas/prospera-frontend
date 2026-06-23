import { useAsyncData, useAsyncMutation } from "@/hooks/use-async-data";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Check, Copy, Link2, Send, UserRoundCheck, UsersRound, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { fetchConnectionCode, fetchConnections, fetchPendingConnectionRequests } from "@/lib/queries";
import type { Connection } from "@/lib/types";

const requestSchema = z.object({
  targetCode: z.string().trim().min(1, "Informe o código da conexão"),
});

type RequestValues = z.infer<typeof requestSchema>;

export default function ConnectionsPage() {
  const { user } = useAuth();
  const code = useAsyncData(() => fetchConnectionCode(), [], { cacheKey: "connection-code", staleMs: 60_000 });
  const pending = useAsyncData(() => fetchPendingConnectionRequests(), [], { cacheKey: "connection-requests-pending" });
  const connections = useAsyncData(() => fetchConnections(), [], { cacheKey: "connections", staleMs: 60_000 });
  const form = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { targetCode: "" },
  });

  const reloadConnections = () => {
    pending.reload();
    connections.reload();
    window.dispatchEvent(new Event("prospera:connections-updated"));
  };

  const sendRequest = useAsyncMutation({
    mutationFn: (values: RequestValues) =>
      api<Connection>("/connections/requests", {
        method: "POST",
        body: { targetCode: values.targetCode.trim().toUpperCase() },
      }),
    onSuccess: () => {
      toast.success("Convite enviado");
      form.reset({ targetCode: "" });
      reloadConnections();
    },
    onError: (error) => toast.error(error.message),
  });

  const answerRequest = useAsyncMutation({
    mutationFn: ({ id, action }: { id: number; action: "accept" | "decline" }) =>
      api<Connection>(`/connections/requests/${id}/${action}`, { method: "POST" }),
    onSuccess: (_data, input) => {
      toast.success(input.action === "accept" ? "Conexão aceita" : "Convite recusado");
      reloadConnections();
    },
    onError: (error) => toast.error(error.message),
  });

  const copyCode = async () => {
    const value = code.data?.code;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Código copiado");
    } catch {
      toast.error("Não foi possível copiar o código");
    }
  };

  const acceptedConnections = connections.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Conexões</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie pessoas conectadas para dividir compras e acompanhar acertos.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardContent className="space-y-5 p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent">
                <Link2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Seu código</h2>
                <p className="text-sm text-muted-foreground">
                  Compartilhe este código com quem você quer conectar.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="min-h-11 flex-1 rounded-lg border bg-muted/40 px-3 py-2 font-mono text-lg font-semibold tracking-[0.2em]">
                {code.isLoading ? "Carregando..." : code.data?.code ?? "Indisponível"}
              </div>
              <Button type="button" variant="outline" size="icon" onClick={copyCode} disabled={!code.data?.code}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            <form className="space-y-3" onSubmit={form.handleSubmit((values) => sendRequest.mutate(values))}>
              <div className="space-y-1.5">
                <Label>Código da outra pessoa</Label>
                <Input
                  {...form.register("targetCode")}
                  placeholder="ex: ABC12345"
                  className="uppercase"
                  autoComplete="off"
                />
                {form.formState.errors.targetCode?.message && (
                  <p className="text-xs text-destructive">{form.formState.errors.targetCode.message}</p>
                )}
              </div>
              <Button type="submit" disabled={sendRequest.isPending}>
                <Send className="h-4 w-4" />
                {sendRequest.isPending ? "Enviando..." : "Enviar convite"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent">
                <UsersRound className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Convites pendentes</h2>
                <p className="text-sm text-muted-foreground">Aceite apenas pessoas que você reconhece.</p>
              </div>
            </div>

            {pending.isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : !pending.data?.length ? (
              <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                Nenhum convite pendente.
              </p>
            ) : (
              <ul className="space-y-3">
                {pending.data.map((request) => (
                  <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="font-medium">{request.requesterName}</p>
                      <p className="text-xs text-muted-foreground">
                        Enviado em {formatDateTime(request.requestedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={answerRequest.isPending}
                        onClick={() => answerRequest.mutate({ id: request.id, action: "decline" })}
                      >
                        <X className="h-4 w-4" /> Recusar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={answerRequest.isPending}
                        onClick={() => answerRequest.mutate({ id: request.id, action: "accept" })}
                      >
                        <Check className="h-4 w-4" /> Aceitar
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent">
              <UserRoundCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Conexões aceitas</h2>
              <p className="text-sm text-muted-foreground">
                Estas pessoas podem aparecer na divisão de compras.
              </p>
            </div>
          </div>

          {connections.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : !acceptedConnections.length ? (
            <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
              Você ainda não tem conexões aceitas.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {acceptedConnections.map((connection) => {
                const person = getConnectionPerson(connection, user?.id);
                return (
                  <div key={connection.id} className="rounded-lg border p-4">
                    <p className="font-medium">{person.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Conectado em {formatDateTime(connection.respondedAt ?? connection.requestedAt)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getConnectionPerson(connection: Connection, currentUserId?: number) {
  if (connection.requesterUserId === currentUserId) {
    return { id: connection.targetUserId, name: connection.targetName };
  }
  return { id: connection.requesterUserId, name: connection.requesterName };
}
