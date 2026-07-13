import http from "node:http";

const occurrences = [
  { id: 1, recurrenceId: 1, recurrenceName: "Assinatura variável com nome muito extenso", occurrenceDate: "2026-07-30", amount: 3261, targetType: "ACCOUNT_TRANSACTION", transactionType: "EXPENSE", classification: "VARIABLE", status: "PENDING" },
  { id: 2, recurrenceId: 2, recurrenceName: "Internet", occurrenceDate: "2026-08-05", amount: 100, targetType: "ACCOUNT_TRANSACTION", transactionType: "EXPENSE", classification: "VARIABLE", status: "PENDING" },
  { id: 3, recurrenceId: 3, recurrenceName: "Seguro anual", occurrenceDate: "2026-08-30", amount: 9876543.21, targetType: "ACCOUNT_TRANSACTION", transactionType: "EXPENSE", classification: "FIXED", status: "MATERIALIZED" },
  { id: 4, recurrenceId: 4, recurrenceName: "Serviço", occurrenceDate: "2026-09-05", amount: 100, targetType: "ACCOUNT_TRANSACTION", transactionType: "EXPENSE", classification: "VARIABLE", status: "PENDING" },
];

const recurrences = occurrences.map((item) => ({
  id: item.recurrenceId,
  name: item.recurrenceName,
  targetType: item.targetType,
  transactionType: item.transactionType,
  amount: item.amount,
  frequency: "MONTHLY",
  startDate: "2026-01-01",
  dayOfMonth: 5,
  classification: item.classification,
  active: true,
}));

const server = http.createServer((request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  if (request.method === "OPTIONS") return response.end();

  const url = new URL(request.url ?? "/", "http://127.0.0.1:8080");
  let body = [];
  if (request.method === "POST" && url.pathname === "/auth/login") {
    body = { token: "layout-audit-token", userId: 1, email: "audit@example.test", name: "Layout" };
  } else if (url.pathname === "/recurrences/occurrences") {
    body = occurrences;
  } else if (url.pathname === "/recurrences") {
    body = recurrences;
  } else if (url.pathname === "/notifications/unread-count") {
    body = { count: 0 };
  } else {
    body = [];
  }

  response.end(JSON.stringify(body));
});

server.listen(8080, "127.0.0.1");
