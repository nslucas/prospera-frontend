import type { QueryClient } from "@tanstack/react-query";

export function invalidateFinanceQueries(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ["accounts"] });
  queryClient.invalidateQueries({ queryKey: ["alerts"] });
  queryClient.invalidateQueries({ queryKey: ["budget-progress"] });
  queryClient.invalidateQueries({ queryKey: ["budgets"] });
  queryClient.invalidateQueries({ queryKey: ["cards"] });
  queryClient.invalidateQueries({ queryKey: ["card-payments"] });
  queryClient.invalidateQueries({ queryKey: ["card-statement"] });
  queryClient.invalidateQueries({ queryKey: ["card-statement-current"] });
  queryClient.invalidateQueries({ queryKey: ["expenses"] });
  queryClient.invalidateQueries({ queryKey: ["recurrences"] });
  queryClient.invalidateQueries({ queryKey: ["recurrence-occurrences"] });
  queryClient.invalidateQueries({ queryKey: ["summary-cards"] });
  queryClient.invalidateQueries({ queryKey: ["summary-categories"] });
  queryClient.invalidateQueries({ queryKey: ["summary-fixed-variable"] });
  queryClient.invalidateQueries({ queryKey: ["summary-forecast"] });
  queryClient.invalidateQueries({ queryKey: ["summary-monthly"] });
  queryClient.invalidateQueries({ queryKey: ["summary-trends"] });
  queryClient.invalidateQueries({ queryKey: ["summary-upcoming"] });
  queryClient.invalidateQueries({ queryKey: ["summary-yearly"] });
  queryClient.invalidateQueries({ queryKey: ["transactions"] });
}
