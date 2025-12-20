
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { NAV_LINKS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icons";

interface MobileNavProps {
  onLinkClick?: () => void;
}

export function MobileNav({ onLinkClick }: MobileNavProps) {
  const pathname = usePathname();
  const { t } = useTranslation('common');

  return (
    <nav className="flex flex-col space-y-2" aria-label="Mobile navigation">
      {NAV_LINKS.map((link) => {
        const isActive = pathname.startsWith(link.href);
        return (
          <Button
            key={link.href}
            asChild
            variant={isActive ? "default" : "ghost"}
            size="lg"
            className={cn(
              "justify-start w-full py-3 text-body-lg",
              isActive 
                ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                : "hover:bg-accent/80 hover:text-accent-foreground" // Use a more subtle hover for consistency
            )}
            onClick={onLinkClick}
          >
            <Link href={link.href}>
              <Icon name={link.iconName as IconName} className={cn("mr-1 h-5 w-5")} />
              {t(link.labelKey)}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
