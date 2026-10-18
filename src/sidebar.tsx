import { useState, useEffect, useRef } from "react";
import type { CenterTab } from "./studioNavigation";
import { Button } from "./components/ui/button";
import { MonoIcon } from "./components/MonoIcon";
import { StudioNavIcon } from "./components/StudioNavIcon";
import { Code2, Files, MessageSquare, ListTodo, ChevronDown } from "lucide-react";

export type NavItem = {
  id: string;
  label: string;
  icon: string;
  hint?: string;
  tabs?: CenterTab[];
};

export type NavGroup = {
  id: string;
  title: string;
  icon: string;
  items: NavItem[];
};

export const SIDEBAR_NAV_GROUPS: NavGroup[] = [
  {
    id: "project",
    title: "Projet",
    icon: "📁",
    items: [
      {
        id: "project-dashboard",
        label: "Tableau de bord",
        icon: "📊",
        hint: "Cycle de livraison : demander, suivre, examiner, vérifier, fusionner",
        tabs: ["dashboard"],
      },
      {
        id: "project-settings",
        label: "Paramètres",
        icon: "⚙️",
        hint: "Stack, agents, acceptation",
        tabs: ["settings"],
      },
    ],
  },
  {
    id: "development",
    title: "Développement",
    icon: "🛠️",
    items: [
      {
        id: "dev-kanban",
        label: "Kanban",
        icon: "🗂️",
        hint: "Suivi tickets, review et correctifs",
        tabs: ["kanban"],
      },
      {
        id: "dev-editor",
        label: "Éditeur",
        icon: "📝",
        hint: "Éditer les fichiers du projet",
        tabs: ["editor"],
      },
      {
        id: "dev-preview",
        label: "Aperçu / Dev",
        icon: "👁️",
        hint: "Prévisualiser ou lancer le serveur dev",
        tabs: ["preview"],
      },
      {
        id: "dev-build",
        label: "Build & Test",
        icon: "🧪",
        hint: "Lancer le build et les tests",
        tabs: ["logs"],
      },
      {
        id: "dev-branches",
        label: "Branches",
        icon: "🌿",
        hint: "Gérer les branches Git et évolutions",
        tabs: ["branches"],
      },
    ],
  },
  {
    id: "design-planning",
    title: "Design & Planification",
    icon: "🎨",
    items: [
      {
        id: "design",
        label: "Design",
        icon: "📐",
        hint: "Gérer design tokens et composants",
        tabs: ["design"],
      },
      {
        id: "plan",
        label: "Plan",
        icon: "📋",
        hint: "Éditer le plan du projet",
        tabs: ["plan"],
      },
    ],
  },
  {
    id: "operations",
    title: "Opérations & Monitoring",
    icon: "🔧",
    items: [
      {
        id: "ops-cockpit",
        label: "Cockpit",
        icon: "🚀",
        hint: "Tableau de bord opérateur",
        tabs: ["cockpit"],
      },
      {
        id: "ops-logs",
        label: "Logs serveur",
        icon: "📜",
        hint: "Voir les logs du daemon",
        tabs: ["logs"],
      },
    ],
  },
  {
    id: "help",
    title: "Aide",
    icon: "❓",
    items: [
      {
        id: "help-docs",
        label: "Documentation",
        icon: "📖",
        hint: "Guide utilisateur intégré",
        tabs: ["docs"],
      },
      {
        id: "help-agents",
        label: "Agents",
        icon: "🤖",
        hint: "Capacités des agents disponibles",
        tabs: ["agents"],
      },
    ],
  },
];

/**
 * Récupère tous les onglets disponibles pour un groupe donné
 */
export function getTabsForGroup(groupId: string): CenterTab[] {
  const group = SIDEBAR_NAV_GROUPS.find((g) => g.id === groupId);
  if (!group) return [];
  const tabs = new Set<CenterTab>();
  for (const item of group.items) {
    if (item.tabs) {
      for (const tab of item.tabs) {
        tabs.add(tab);
      }
    }
  }
  return Array.from(tabs);
}

/**
 * Retourne le groupe qui contient un onglet donné.
 */
export function getGroupForTab(tab: CenterTab): string | null {
  for (const group of SIDEBAR_NAV_GROUPS) {
    for (const item of group.items) {
      if (item.tabs?.includes(tab)) return group.id;
    }
  }
  return null;
}

/**
 * Récupère le groupe par défaut (pour initialisation)
 */
export function getDefaultGroup(): string {
  return "development";
}

type SidebarProps = {
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  activeTab: CenterTab | null;
  onTabSelect: (tab: CenterTab) => void;
  onGroupSelect?: (groupId: string) => void;
  activeGroup?: string | null;
  chatActive?: boolean;
  onChatSelect?: () => void;
};

export function Sidebar({ isOpen, onToggle, activeTab, onTabSelect, onGroupSelect, activeGroup, chatActive, onChatSelect }: SidebarProps) {
  const navRef = useRef<HTMLElement>(null);
  const onToggleRef = useRef(onToggle);
  onToggleRef.current = onToggle;
  const [expandedGroup, setExpandedGroup] = useState<string | null>(activeGroup || getDefaultGroup());

  useEffect(() => {
    // Auto-expand group based on active tab
    if (!activeTab) return;
    for (const group of SIDEBAR_NAV_GROUPS) {
      for (const item of group.items) {
        if (item.tabs?.includes(activeTab)) {
          setExpandedGroup(group.id);
          return;
        }
      }
    }
  }, [activeTab]);

  useEffect(() => {
    if (!isOpen) return;
    const mobile = window.matchMedia("(max-width: 900px)").matches;
    const previousFocus = document.activeElement;
    if (mobile) navRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onToggleRef.current(false);
      }
      if (mobile && e.key === "Tab") {
        const controls = [...(navRef.current?.querySelectorAll<HTMLElement>("button, summary, [tabindex='0']") ?? [])].filter(element => element.getClientRects().length && !element.matches(":disabled"));
        const first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (mobile && previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [isOpen]);

  const handleGroupClick = (groupId: string) => {
    setExpandedGroup(expandedGroup === groupId ? null : groupId);
    onGroupSelect?.(groupId);
  };

  const handleItemClick = (item: NavItem, groupId: string) => {
    // Select the group first
    onGroupSelect?.(groupId);
    // Then select the first tab of this item
    if (item.tabs && item.tabs.length > 0) {
      onTabSelect(item.tabs[0]);
    }
  };

  return (
    <>
      {/* Mobile toggle button */}
      <Button
        className={`sidebar-toggle-mobile ${!isOpen ? "sidebar-toggle-mobile--visible" : ""}`}
        onClick={() => onToggle(!isOpen)}
        aria-label="Ouvrir/fermer le menu"
        title="Menu de navigation"
        variant="secondary"
        size="icon"
      >
        <MonoIcon name="menu" />
      </Button>

      {/* Overlay pour mobile */}
      {isOpen && <div className="sidebar-overlay" onClick={() => onToggle(false)} />}

      {/* Sidebar */}
      <nav ref={navRef} className={`sidebar ${isOpen ? "sidebar--open" : ""}`} aria-label="Navigation principale">
        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-title">
            <img src="/akasha-icon.png" alt="" className="sidebar-logo-img" width={22} height={22} />
            <span className="sidebar-app-name">Code Studio</span>
          </div>
          <Button
            className="sidebar-close-btn"
            onClick={() => onToggle(false)}
            aria-label="Fermer le menu"
            title="Fermer (Esc)"
            variant="ghost"
            size="icon"
          >
            <MonoIcon name="close" />
          </Button>
        </div>

        {/* Navigation Groups */}
        <div className="sidebar-content">
          <div className="sidebar-primary" aria-label="Espace de travail">
            <Button variant="ghost" className={`sidebar-item ${chatActive ? "sidebar-item--active" : ""}`} aria-current={chatActive ? "page" : undefined} onClick={onChatSelect}><MessageSquare size={17} aria-hidden="true" />Discussion</Button>
            {([{ tab: "editor", label: "Fichiers", icon: Files }, { tab: "preview", label: "Aperçu", icon: Code2 }, { tab: "kanban", label: "Tâches", icon: ListTodo }] as const).map(({ tab, label, icon: Icon }) =>
              <Button key={tab} variant="ghost" className={`sidebar-item ${!chatActive && activeTab === tab ? "sidebar-item--active" : ""}`} aria-current={!chatActive && activeTab === tab ? "page" : undefined} onClick={() => onTabSelect(tab)}><Icon size={17} aria-hidden="true" />{label}</Button>)}
          </div>
          <details className="sidebar-more">
          <summary>Plus d’outils<ChevronDown size={14} aria-hidden="true" /></summary>
          <div role="list">
          {SIDEBAR_NAV_GROUPS.map((group) => (
            <div key={group.id} className="sidebar-group" role="listitem">
              <Button
                className={`sidebar-group-header ${activeGroup === group.id ? "sidebar-group-header--active" : ""}`}
                onClick={() => handleGroupClick(group.id)}
                aria-expanded={expandedGroup === group.id}
                aria-label={`${group.title}, ${expandedGroup === group.id ? "développé" : "non développé"}`}
                variant="ghost"
                size="sm"
              >
                <span className="sidebar-group-icon" aria-hidden="true">
                  <StudioNavIcon id={group.id} />
                </span>
                <span className="sidebar-group-title">{group.title}</span>
                <span className="sidebar-group-chevron" aria-hidden="true">
                  <MonoIcon name={expandedGroup === group.id ? "chevron-down" : "chevron-right"} />
                </span>
              </Button>

              {expandedGroup === group.id && (
                <div className="sidebar-group-items">
                  {group.items.map((item) => (
                    (() => {
                      const isActionable = Boolean(item.tabs && item.tabs.length > 0);
                      const isActive = !chatActive && item.tabs?.some((t) => t === activeTab);
                      return (
                    <Button
                      key={item.id}
                      className={`sidebar-item ${isActive ? "sidebar-item--active" : ""} ${!isActionable ? "sidebar-item--disabled" : ""}`}
                      onClick={() => handleItemClick(item, group.id)}
                      title={isActionable ? item.hint : `${item.hint ?? "Action"} (bientôt disponible)`}
                      aria-label={`${item.label}${item.hint ? ": " + item.hint : ""}`}
                      aria-current={isActive ? "page" : undefined}
                      disabled={!isActionable}
                      aria-disabled={!isActionable}
                      variant="ghost"
                      size="sm"
                    >
                      <span className="sidebar-item-icon" aria-hidden="true">
                        <StudioNavIcon id={item.id} />
                      </span>
                      <span className="sidebar-item-label">{item.label}</span>
                      {item.hint && (
                        <span className="sidebar-item-hint" role="tooltip">
                          {item.hint}
                        </span>
                      )}
                    </Button>
                      );
                    })()
                  ))}
                </div>
              )}
            </div>
          ))}
          </div>
          </details>
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <Button
            className="sidebar-footer-btn"
            type="button"
            title="Masquer le menu latéral (réouverture avec le bouton ☰)"
            onClick={() => onToggle(false)}
            variant="secondary"
            size="sm"
          >
            Masquer la navigation
          </Button>
        </div>
      </nav>
    </>
  );
}
