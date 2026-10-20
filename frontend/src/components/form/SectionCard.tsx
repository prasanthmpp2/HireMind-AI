import { Disclosure } from "@headlessui/react";
import { ChevronDown } from "lucide-react";
import { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

export const SectionCard = ({ title, description, children, defaultOpen = true }: SectionCardProps) => (
  <Disclosure defaultOpen={defaultOpen}>
    {({ open }) => (
      <div className="glass-card">
        <Disclosure.Button className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/10 px-5 py-3 text-left transition hover:bg-white/30 dark:border-slate-700/60 dark:hover:bg-slate-800/30">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            {description ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
            ) : null}
          </div>
          <ChevronDown className={`h-5 w-5 text-slate-500 transition ${open ? "rotate-180" : ""}`} />
        </Disclosure.Button>
        <Disclosure.Panel className="space-y-4 px-5 pb-5 pt-3">{children}</Disclosure.Panel>
      </div>
    )}
  </Disclosure>
);
