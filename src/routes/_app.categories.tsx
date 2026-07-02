import { useAsyncData, useAsyncMutation } from "@/hooks/use-async-data";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Tag as TagIcon } from "lucide-react";
import { fetchCategories } from "@/lib/queries";
import { api } from "@/lib/api";
import type { Category, CategoryType } from "@/lib/types";
import { ConfirmAction } from "@/components/confirm-action";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  name: z.string().min(1, "Informe um nome"),
  type: z.enum(["INCOME", "EXPENSE"]),
});
type Values = z.infer<typeof schema>;

export default function CategoriesPage() {
  const { data, isLoading, reload } = useAsyncData(() => fetchCategories(), [], {
    cacheKey: "categories",
    staleMs: 60_000,
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { type: "EXPENSE" },
  });

  function resetCategoryForm(category: Category | null = null) {
    form.reset(
      category ? { name: category.name, type: category.type } : { name: "", type: "EXPENSE" },
    );
  }

  function openCreateDialog() {
    setEditing(null);
    resetCategoryForm();
    setOpen(true);
  }

  function openEditDialog(category: Category) {
    setEditing(category);
    resetCategoryForm(category);
    setOpen(true);
  }

  function changeDialogOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setEditing(null);
  }

  const create = useAsyncMutation({
    mutationFn: (v: Values) =>
      api<Category>(editing ? `/categories/${editing.id}` : "/categories", {
        method: editing ? "PUT" : "POST",
        body: v,
      }),
    onSuccess: () => {
      toast.success(editing ? "Categoria atualizada" : "Categoria criada");
      reload();
      setOpen(false);
      setEditing(null);
      form.reset({ type: "EXPENSE", name: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useAsyncMutation({
    mutationFn: (id: number) => api(`/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Removida");
      reload();
    },
    onError: (e) => toast.error(e.message),
  });

  const grouped = {
    EXPENSE: (data ?? []).filter((c) => c.type === "EXPENSE"),
    INCOME: (data ?? []).filter((c) => c.type === "INCOME"),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Categorias</h1>
          <p className="text-sm text-muted-foreground">Organize receitas e despesas.</p>
        </div>
        <Dialog open={open} onOpenChange={changeDialogOpen}>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4" /> Nova
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar categoria" : "Nova categoria"}</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input {...form.register("name")} />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={form.watch("type")}
                  onValueChange={(v) => form.setValue("type", v as CategoryType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXPENSE">Despesa</SelectItem>
                    <SelectItem value="INCOME">Receita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? "Salvando…" : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {(["EXPENSE", "INCOME"] as const).map((type) => (
            <section key={type}>
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                {type === "EXPENSE" ? "Despesas" : "Receitas"}
              </h2>
              <Card>
                <CardContent className="p-0">
                  {grouped[type].length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      <TagIcon className="mx-auto mb-2 h-5 w-5" />
                      Nenhuma categoria.
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {grouped[type].map((c) => (
                        <li key={c.id} className="flex items-center justify-between gap-2 p-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate text-sm">{c.name}</span>
                            {!c.active && <Badge variant="outline">inativa</Badge>}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(c)}
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <ConfirmAction
                            title="Desativar categoria?"
                            description={`A categoria "${c.name}" será desativada.`}
                            confirmLabel="Desativar"
                            destructive
                            onConfirm={() => remove.mutate(c.id)}
                          >
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </ConfirmAction>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
