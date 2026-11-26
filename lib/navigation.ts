import {
  LayoutDashboard,
  ShoppingCart,
  Factory,
  Package,
  Truck,
  ReceiptText,
  Wallet,
  ChartNoAxesCombined,
  Database,
  ClipboardList,
  Settings,
} from "lucide-react";

export type Role =
  | "admin"
  | "salesman"
  | "production"
  | "accountant"
  | "owner";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  salesman: "Salesman",
  production: "Production Supervisor",
  accountant: "Accountant",
  owner: "Owner",
};

const allRoles: Role[] = [
  "admin",
  "salesman",
  "production",
  "accountant",
  "owner",
];

const operationsRoles: Role[] = [
  "admin",
  "production",
  "accountant",
  "owner",
];

const salesRoles: Role[] = [
  "admin",
  "salesman",
  "accountant",
  "owner",
];

const financeRoles: Role[] = [
  "admin",
  "accountant",
  "owner",
];

export const NAVIGATION = [
  {
    title: "Workspace",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        roles: allRoles,
      },
      {
        label: "Sales Orders",
        href: "/sales",
        icon: ShoppingCart,
        roles: salesRoles,
      },
      {
        label: "Production",
        href: "/production",
        icon: Factory,
        roles: operationsRoles,
      },
      {
        label: "Inventory",
        href: "/inventory",
        icon: Package,
        roles: operationsRoles,
      },
      {
        label: "Purchases",
        href: "/purchases",
        icon: Truck,
        roles: operationsRoles,
      },
    ],
  },
  {
    title: "Finance",
    items: [
      {
        label: "Invoices",
        href: "/invoices",
        icon: ReceiptText,
        roles: salesRoles,
      },
      {
        label: "Payments",
        href: "/payments",
        icon: Wallet,
        roles: financeRoles,
      },
      {
        label: "Reports",
        href: "/reports",
        icon: ChartNoAxesCombined,
        roles: operationsRoles,
      },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        label: "Master Data",
        href: "/masters",
        icon: Database,
        roles: operationsRoles,
      },
      {
        label: "Audit Logs",
        href: "/audit",
        icon: ClipboardList,
        roles: financeRoles,
      },
      {
        label: "Settings",
        href: "/settings",
        icon: Settings,
        roles: ["admin"] as Role[],
      },
    ],
  },
];