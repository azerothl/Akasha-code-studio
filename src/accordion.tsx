import { useState } from "react";

export type AccordionItem = {
  id: string;
  title: string;
  content: React.ReactNode;
  icon?: string;
  isOpen?: boolean;
};

type AccordionProps = {
  items: AccordionItem[];
  onToggle?: (id: string, isOpen: boolean) => void;
  allowMultiple?: boolean;
  className?: string;
};

export function Accordion({ items, onToggle, allowMultiple = false, className = "" }: AccordionProps) {
  const [openItems, setOpenItems] = useState<Set<string>>(
    new Set(items.filter((item) => item.isOpen).map((item) => item.id)),
  );

  const handleToggle = (id: string) => {
    const newOpenItems = new Set(openItems);
    if (newOpenItems.has(id)) {
      newOpenItems.delete(id);
    } else {
      if (!allowMultiple) {
        newOpenItems.clear();
      }
      newOpenItems.add(id);
    }
    setOpenItems(newOpenItems);
    onToggle?.(id, newOpenItems.has(id));
  };

  return (
    <div className={`accordion ${className}`}>
      {items.map((item) => {
        const isOpen = openItems.has(item.id);
        return (
          <div key={item.id} className="accordion-item">
            <button
              type="button"
              className={`accordion-header ${isOpen ? "accordion-header--open" : ""}`}
              onClick={() => handleToggle(item.id)}
              aria-expanded={isOpen}
              aria-controls={`accordion-content-${item.id}`}
            >
              <div className="accordion-header-content">
                {item.icon && <span className="accordion-icon">{item.icon}</span>}
                <span className="accordion-title">{item.title}</span>
              </div>
              <span className="accordion-toggle-icon">▼</span>
            </button>
            {isOpen && (
              <div id={`accordion-content-${item.id}`} className="accordion-content">
                {item.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
