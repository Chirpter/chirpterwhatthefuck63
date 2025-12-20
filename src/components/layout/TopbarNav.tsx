
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { NAV_LINKS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icons";

export function TopbarNav() {
  const pathname = usePathname();
  const { t } = useTranslation('common');

  return (
    <nav className="flex items-center space-x-1" aria-label="Main navigation">
      {NAV_LINKS.map((link) => {
        const isActive = pathname.startsWith(link.href);
        return (
          <Button
            key={link.href}
            asChild
            variant="ghost"
            size="sm"
            className={cn(
              "font-body text-body-base",
              isActive 
                ? "font-semibold bg-primary text-primary-foreground hover:bg-primary/90" 
                : "text-foreground hover:bg-secondary"
            )}
          >
            <Link href={link.href}>
              <Icon name={link.iconName as IconName} className="mr-1 h-4 w-4" />
              {t(link.labelKey)}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
