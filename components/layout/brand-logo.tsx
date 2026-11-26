import { Workflow } from "lucide-react";
import { BRAND } from "@/lib/brand";

export function BrandLogo({
  dark = false,
}: {
  dark?: boolean;
}) {
  const nameParts = BRAND.name.split("2");

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
        <Workflow size={28} strokeWidth={2} />
      </div>

      <div>
        <div
          className={`text-xl font-bold tracking-tight ${
            dark ? "text-white" : "text-slate-900"
          }`}
        >
          {nameParts.length === 2 ? (
            <>
              {nameParts[0]}
              <span className="text-indigo-400">2</span>
              {nameParts[1]}
            </>
          ) : (
            BRAND.name
          )}
        </div>

        <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
          {BRAND.description}
        </p>
      </div>
    </div>
  );
}