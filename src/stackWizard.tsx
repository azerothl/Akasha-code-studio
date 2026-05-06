import { useMemo } from "react";
import { BASE_STACK_PRESETS, STACK_ADDON_GROUPS, STACK_PRESET_CUSTOM, STACK_PRESET_NONE, type StackAddonCategoryId } from "./stackConfig";

type Props = {
  presetId: string;
  onPresetChange: (id: string) => void;
  addons: Record<StackAddonCategoryId, string[]>;
  onToggleAddon: (cat: StackAddonCategoryId, optId: string) => void;
  customText: string;
  onCustomTextChange: (text: string) => void;
  composedStack: string;
};

/**
 * StackWizard - Visual stack selection with cards
 */
export function StackWizard({
  presetId,
  onPresetChange,
  addons,
  onToggleAddon,
  customText,
  onCustomTextChange,
  composedStack,
}: Props) {
  const selectedPreset = useMemo(
    () => BASE_STACK_PRESETS.find((p) => p.id === presetId),
    [presetId]
  );

  const showAddons = presetId !== STACK_PRESET_NONE && presetId !== STACK_PRESET_CUSTOM;
  const showCustomInput = presetId === STACK_PRESET_CUSTOM;

  return (
    <div className="stack-wizard">
      {/* Step 1: Preset Selection */}
      <div className="stack-wizard-step">
        <h3 className="stack-wizard-step-title">Choisir un modèle</h3>
        <div className="stack-preset-grid">
          <button
            type="button"
            className={`stack-preset-card ${presetId === STACK_PRESET_NONE ? "stack-preset-card--active" : ""}`}
            onClick={() => onPresetChange(STACK_PRESET_NONE)}
            title="Pas de stack prédéfinie"
          >
            <div className="stack-preset-icon">🚫</div>
            <div className="stack-preset-name">Aucune</div>
            <div className="stack-preset-hint">Pas de stack</div>
          </button>

          {BASE_STACK_PRESETS.filter((p) => p.id !== STACK_PRESET_CUSTOM && p.id !== STACK_PRESET_NONE).map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`stack-preset-card ${presetId === preset.id ? "stack-preset-card--active" : ""}`}
              onClick={() => onPresetChange(preset.id)}
              title={preset.description}
            >
              <div className="stack-preset-icon">{getPresetIcon(preset.id)}</div>
              <div className="stack-preset-name">{preset.label}</div>
              <div className="stack-preset-hint">{preset.description?.split("\n")[0]}</div>
            </button>
          ))}

          <button
            type="button"
            className={`stack-preset-card ${presetId === STACK_PRESET_CUSTOM ? "stack-preset-card--active" : ""}`}
            onClick={() => onPresetChange(STACK_PRESET_CUSTOM)}
            title="Stack personnalisée"
          >
            <div className="stack-preset-icon">✏️</div>
            <div className="stack-preset-name">Personnalisé</div>
            <div className="stack-preset-hint">Texte libre</div>
          </button>
        </div>
      </div>

      {/* Step 2: Custom Stack Input */}
      {showCustomInput && (
        <div className="stack-wizard-step">
          <h3 className="stack-wizard-step-title">Décrire la stack</h3>
          <textarea
            className="stack-wizard-textarea"
            rows={8}
            value={customText}
            onChange={(e) => onCustomTextChange(e.target.value)}
            placeholder="Décrivez vos langages, frameworks, conventions, outils…"
            spellCheck={false}
          />
        </div>
      )}

      {/* Step 3: Addons Selection */}
      {showAddons && (
        <div className="stack-wizard-step">
          <h3 className="stack-wizard-step-title">Affiner avec des modules</h3>
          <div className="stack-addon-groups-grid">
            {STACK_ADDON_GROUPS.map((group) => (
              <div key={group.id} className="stack-addon-group-card">
                <h4 className="stack-addon-group-title">{group.title}</h4>
                <div className="stack-addon-options">
                  {group.options.map((option) => {
                    const checked = (addons[group.id] ?? []).includes(option.id);
                    return (
                      <label key={option.id} className="stack-addon-toggle">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleAddon(group.id, option.id)}
                        />
                        <span className="stack-addon-label">{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      {presetId !== STACK_PRESET_NONE && (
        <div className="stack-wizard-step">
          <h3 className="stack-wizard-step-title">Aperçu final</h3>
          <div className="stack-preview-container">
            <textarea
              className="stack-preview-textarea"
              readOnly
              rows={6}
              value={composedStack}
              spellCheck={false}
              title="Aperçu de la stack composée (texte injecté côté daemon)"
            />
            <p className="stack-preview-hint">
              Texte qui sera injecté dans les instructions du daemon
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function getPresetIcon(presetId: string): string {
  const icons: Record<string, string> = {
    "full-stack": "🎯",
    "backend": "🔧",
    "frontend": "🎨",
    "ml": "🤖",
    "devops": "⚙️",
    "native": "📱",
    "web3": "⛓️",
    "data": "📊",
  };
  return icons[presetId] || "📦";
}
