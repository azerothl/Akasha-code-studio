import { useState, useEffect } from "react";
import type { CenterTab } from "./App";

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
        tabs: [],
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

type SidebarProps = {
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  activeTab: CenterTab | null;
  onTabSelect: (tab: CenterTab) => void;
  onItemSelect?: (itemId: string) => void;
};

export function Sidebar({ isOpen, onToggle, activeTab, onTabSelect, onItemSelect }: SidebarProps) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>("development");

  useEffect(() => {
    // Expand relevant group based on active tab
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

  const handleItemClick = (item: NavItem) => {
    onItemSelect?.(item.id);
    if (item.tabs && item.tabs.length > 0) {
      onTabSelect(item.tabs[0]);
    }
  };

  return (
    <>
      {/* Mobile toggle button */}
      <button
        className="sidebar-toggle-mobile"
        onClick={() => onToggle(!isOpen)}
        aria-label="Ouvrir/fermer le menu"
        title="Menu de navigation"
      >
        ☰
      </button>

      {/* Overlay pour mobile */}
      {isOpen && <div className="sidebar-overlay" onClick={() => onToggle(false)} />}

      {/* Sidebar */}
      <nav className={`sidebar ${isOpen ? "sidebar--open" : ""}`}>
        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-title">
            <span className="sidebar-logo">⚡</span>
            <span className="sidebar-app-name">Code Studio</span>
          </div>
          <button
            className="sidebar-close-btn"
            onClick={() => onToggle(false)}
            aria-label="Fermer le menu"
            title="Fermer (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Navigation Groups */}
        <div className="sidebar-content">
          {SIDEBAR_NAV_GROUPS.map((group) => (
            <div key={group.id} className="sidebar-group">
              <button
                className="sidebar-group-header"
                onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                aria-expanded={expandedGroup === group.id}
              >
                <span className="sidebar-group-icon">{group.icon}</span>
                <span className="sidebar-group-title">{group.title}</span>
                <span className="sidebar-group-chevron">
                  {expandedGroup === group.id ? "▼" : "▶"}
                </span>
              </button>

              {expandedGroup === group.id && (
                <div className="sidebar-group-items">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      className={`sidebar-item ${item.tabs?.some((t) => t === activeTab) ? "sidebar-item--active" : ""}`}
                      onClick={() => handleItemClick(item)}
                      title={item.hint}
                    >
                      <span className="sidebar-item-icon">{item.icon}</span>
                      <span className="sidebar-item-label">{item.label}</span>
                      {item.hint && (
                        <span className="sidebar-item-hint" role="tooltip">
                          {item.hint}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <button className="sidebar-footer-btn" title="Réduire le menu">
            ◀ Réduire
          </button>
        </div>
      </nav>
    </>
  );
}
