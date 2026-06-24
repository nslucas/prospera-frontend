export interface BankBrand {
  id: string;
  label: string;
  logo: string;
  match: readonly string[];
  className: string;
  accentClassName: string;
  logoClassName?: string;
  color: string;
  solidClassName: string;
  softClassName: string;
}

export const BANK_BRANDS: readonly BankBrand[] = [
  {
    id: "nubank",
    label: "Nubank",
    logo: "/images/banks/nubank.svg",
    match: ["nubank", "nu bank", "nu"],
    className: "from-[#612f74] via-[#82429a] to-[#3f1d4c] text-white",
    accentClassName: "bg-white/12 border-white/18",
    logoClassName: "brightness-0 invert",
    color: "#8a05be",
    solidClassName: "bg-[#8a05be] text-white",
    softClassName: "bg-[#8a05be]/12 text-[#8a05be]",
  },
  {
    id: "banestes",
    label: "Banestes",
    logo: "/images/banks/banestes.png",
    match: ["banestes", "banescard"],
    className: "from-[#1017d8] via-[#1828f0] to-[#0a1178] text-white",
    accentClassName: "bg-white/12 border-white/18",
    logoClassName: "brightness-0 invert",
    color: "#1d4ed8",
    solidClassName: "bg-[#1d4ed8] text-white",
    softClassName: "bg-[#1d4ed8]/12 text-[#1d4ed8]",
  },
  {
    id: "inter",
    label: "Inter",
    logo: "",
    match: ["inter", "banco inter"],
    className: "from-[#ff7a00] via-[#ff8f1f] to-[#c85100] text-white",
    accentClassName: "bg-white/16 border-white/22",
    color: "#ff7a00",
    solidClassName: "bg-[#ff7a00] text-white",
    softClassName: "bg-[#ff7a00]/12 text-[#ea580c]",
  },
  {
    id: "itau",
    label: "Itau",
    logo: "/images/banks/itau.svg",
    match: ["itau", "itau unibanco", "itaú"],
    className: "from-[#ff6b00] via-[#f47c00] to-[#10307d] text-white",
    accentClassName: "bg-white/16 border-white/20",
    color: "#ec7000",
    solidClassName: "bg-[#ec7000] text-white",
    softClassName: "bg-[#ec7000]/12 text-[#c2410c]",
  },
  {
    id: "banco-do-brasil",
    label: "Banco do Brasil",
    logo: "/images/banks/banco-do-brasil.svg",
    match: ["banco do brasil", "bb"],
    className: "from-[#f8df18] via-[#f5cf00] to-[#1f54a7] text-[#102b5c]",
    accentClassName: "bg-white/28 border-white/35",
    color: "#1f54a7",
    solidClassName: "bg-[#1f54a7] text-white",
    softClassName: "bg-[#1f54a7]/12 text-[#1f54a7]",
  },
  {
    id: "bradesco",
    label: "Bradesco",
    logo: "/images/banks/bradesco.svg",
    match: ["bradesco"],
    className: "from-[#b5122a] via-[#e5173f] to-[#6e0718] text-white",
    accentClassName: "bg-white/12 border-white/18",
    logoClassName: "brightness-0 invert",
    color: "#cc092f",
    solidClassName: "bg-[#cc092f] text-white",
    softClassName: "bg-[#cc092f]/12 text-[#cc092f]",
  },
  {
    id: "santander",
    label: "Santander",
    logo: "/images/banks/santander.svg",
    match: ["santander"],
    className: "from-[#e50000] via-[#ec1c24] to-[#8f0000] text-white",
    accentClassName: "bg-white/12 border-white/18",
    logoClassName: "brightness-0 invert",
    color: "#ec0000",
    solidClassName: "bg-[#ec0000] text-white",
    softClassName: "bg-[#ec0000]/12 text-[#dc2626]",
  },
  {
    id: "picpay",
    label: "PicPay",
    logo: "/images/banks/picpay.svg",
    match: ["picpay", "pic pay"],
    className: "from-[#11c76f] via-[#21c25e] to-[#08783e] text-white",
    accentClassName: "bg-white/12 border-white/18",
    logoClassName: "brightness-0 invert",
    color: "#11c76f",
    solidClassName: "bg-[#11c76f] text-white",
    softClassName: "bg-[#11c76f]/12 text-[#0f9f5d]",
  },
  {
    id: "caixa",
    label: "Caixa",
    logo: "",
    match: ["caixa", "caixa economica", "caixa econômica"],
    className: "from-[#005ca9] via-[#0070c9] to-[#f39200] text-white",
    accentClassName: "bg-white/16 border-white/22",
    color: "#005ca9",
    solidClassName: "bg-[#005ca9] text-white",
    softClassName: "bg-[#005ca9]/12 text-[#005ca9]",
  },
  {
    id: "c6",
    label: "C6 Bank",
    logo: "",
    match: ["c6", "c6 bank"],
    className: "from-[#111827] via-[#2b2f38] to-[#0a0d12] text-white",
    accentClassName: "bg-white/12 border-white/18",
    color: "#111827",
    solidClassName: "bg-[#111827] text-white",
    softClassName: "bg-[#111827]/12 text-foreground",
  },
  {
    id: "btg",
    label: "BTG Pactual",
    logo: "",
    match: ["btg", "btg pactual"],
    className: "from-[#111827] via-[#1f3a5f] to-[#0f172a] text-white",
    accentClassName: "bg-white/12 border-white/18",
    color: "#1f3a5f",
    solidClassName: "bg-[#1f3a5f] text-white",
    softClassName: "bg-[#1f3a5f]/12 text-[#1f3a5f]",
  },
  {
    id: "xp",
    label: "XP",
    logo: "",
    match: ["xp", "xp investimentos"],
    className: "from-[#111827] via-[#2f3542] to-[#d4a017] text-white",
    accentClassName: "bg-white/12 border-white/18",
    color: "#d4a017",
    solidClassName: "bg-[#d4a017] text-[#111827]",
    softClassName: "bg-[#d4a017]/14 text-[#a16207]",
  },
] as const;

export const DEFAULT_BANK_BRAND: BankBrand = {
  id: "default",
  label: "Banco",
  logo: "",
  match: [],
  className: "from-[#1f2937] via-[#3f4858] to-[#111827] text-white",
  accentClassName: "bg-white/12 border-white/18",
  logoClassName: "",
  color: "#64748b",
  solidClassName: "bg-slate-600 text-white",
  softClassName: "bg-slate-500/12 text-slate-500",
};

export function getBankBrand(bankName: string): BankBrand {
  const normalized = normalizeBankName(bankName);
  return BANK_BRANDS.find((brand) => brand.match.some((value) => normalized.includes(normalizeBankName(value)))) ?? DEFAULT_BANK_BRAND;
}

export function normalizeBankName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
