"use client";

import { cn } from "@/lib/utils";

interface MainLayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function MainLayout({
  sidebar,
  children,
  footer,
  className,
}: MainLayoutProps) {
  return (
    <div className={cn("flex h-screen flex-col bg-notion-bg", className)}>
      <div className="flex flex-1 overflow-hidden">
        {sidebar}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
      {footer && (
        <footer className="border-t border-notion-border bg-notion-sidebar px-4 py-3">
          {footer}
        </footer>
      )}
    </div>
  );
}
