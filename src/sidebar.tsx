import { useState, useEffect } from "react";
import type { CenterTab } from "./App";
import { Button } from "./components/ui/button";

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
        hint: "Vue d'ensemble du projet",
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
        tabs: [],
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
};

export function Sidebar({ isOpen, onToggle, activeTab, onTabSelect, onGroupSelect, activeGroup }: SidebarProps) {
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
        variant="default"
        size="icon"
      >
        ☰
      </Button>

      {/* Overlay pour mobile */}
      {isOpen && <div className="sidebar-overlay" onClick={() => onToggle(false)} />}

      {/* Sidebar */}
      <nav className={`sidebar ${isOpen ? "sidebar--open" : ""}`} aria-label="Navigation principale">
        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-title">
            <span className="sidebar-logo">⚡</span>
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
            ✕
          </Button>
        </div>

        {/* Navigation Groups */}
        <div className="sidebar-content" role="list">
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
                <span className="sidebar-group-icon" aria-hidden="true">{group.icon}</span>
                <span className="sidebar-group-title">{group.title}</span>
                <span className="sidebar-group-chevron" aria-hidden="true">
                  {expandedGroup === group.id ? "▼" : "▶"}
                </span>
              </Button>

              {expandedGroup === group.id && (
                <div className="sidebar-group-items">
                  {group.items.map((item) => (
                    (() => {
                      const isActionable = Boolean(item.tabs && item.tabs.length > 0);
                      const isActive = item.tabs?.some((t) => t === activeTab);
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
                      <span className="sidebar-item-icon" aria-hidden="true">{item.icon}</span>
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
            ◀ Masquer
          </Button>
        </div>
      </nav>
    </>
  );
}
