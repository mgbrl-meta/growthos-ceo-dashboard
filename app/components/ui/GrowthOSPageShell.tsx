'use client';

import {
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { createPortal } from 'react-dom';

import type {
  GrowthOSPageDefinition,
} from '@/lib/ui/growthos-page-registry';

const PAGE_ACTIONS_TARGET_ID = 'growth-os-page-actions';

type Props = {
  page: GrowthOSPageDefinition;
  actions?: ReactNode;
  children: ReactNode;
};

export default function GrowthOSPageShell({
  page,
  actions,
  children,
}: Props) {
  return (
    <div className="space-y-3">
      <header
        className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between"
        data-growth-os-page-header
      >
        <div className="min-w-0 max-w-4xl">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-violet-600">
            {page.eyebrow}
          </p>

          <h1 className="mt-1 text-[20px] font-semibold leading-tight tracking-[-0.035em] text-slate-950">
            {page.title}
          </h1>

          <p className="mt-1 max-w-4xl text-[11px] leading-[17px] text-slate-500">
            {page.description}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:pt-0.5">
          <div
            id={PAGE_ACTIONS_TARGET_ID}
            className="flex flex-wrap items-center justify-end gap-2"
          />

          {actions}
        </div>
      </header>

      <div className="min-w-0">
        {children}
      </div>
    </div>
  );
}

export function GrowthOSPageActionPortal({
  children,
}: {
  children: ReactNode;
}) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTarget(
      document.getElementById(PAGE_ACTIONS_TARGET_ID)
    );
  }, []);

  if (!target) {
    return null;
  }

  return createPortal(children, target);
}