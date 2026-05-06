import { BASE_STACK_PRESETS, STACK_ADDON_GROUPS, STACK_PRESET_CUSTOM, STACK_PRESET_NONE, type StackAddonCategoryId } from "./stackConfig";
import { Button } from "./components/ui/button";

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

  const showAddons = presetId !== STACK_PRESET_NONE && presetId !== STACK_PRESET_CUSTOM;
  const showCustomInput = presetId === STACK_PRESET_CUSTOM;

  return (
    <div className="stack-wizard" role="group" aria-labelledby="stack-wizard-title">
      <h2 id="stack-wizard-title" className="sr-only">Assistant de sélection de stack technologique</h2>

      {/* Step 1: Preset Selection */}
      <div className="stack-wizard-step">
        <h3 className="stack-wizard-step-title" id="stack-presets-label">Étape 1 : Choisir un modèle</h3>
        <div className="stack-preset-grid" aria-labelledby="stack-presets-label" role="group">
          <Button
            variant="ghost"
            size="default"
            className={`stack-preset-card ${presetId === STACK_PRESET_NONE ? "stack-preset-card--active" : ""}`}
            onClick={() => onPresetChange(STACK_PRESET_NONE)}
            title="Pas de stack prédéfinie"
            aria-label="Aucune stack : Pas de stack prédéfinie"
            aria-pressed={presetId === STACK_PRESET_NONE}
          >
            <div className="stack-preset-icon" aria-hidden="true">🚫</div>
            <div className="stack-preset-name">Aucune</div>
            <div className="stack-preset-hint">Pas de stack</div>
          </Button>

          {BASE_STACK_PRESETS.filter((p) => p.id !== STACK_PRESET_CUSTOM && p.id !== STACK_PRESET_NONE).map((preset) => (
            <Button
              key={preset.id}
              variant="ghost"
              size="default"
              className={`stack-preset-card ${presetId === preset.id ? "stack-preset-card--active" : ""}`}
              onClick={() => onPresetChange(preset.id)}
              title={preset.text}
              aria-label={`${preset.label}: ${preset.text}`}
              aria-pressed={presetId === preset.id}
            >
              <div className="stack-preset-icon" aria-hidden="true">{getPresetIcon(preset.id)}</div>
              <div className="stack-preset-name">{preset.label}</div>
              <div className="stack-preset-hint">{preset.text.split("\n")[0]}</div>
            </Button>
          ))}

          <Button
            variant="ghost"
            size="default"
            className={`stack-preset-card ${presetId === STACK_PRESET_CUSTOM ? "stack-preset-card--active" : ""}`}
            onClick={() => onPresetChange(STACK_PRESET_CUSTOM)}
            title="Stack personnalisée"
            aria-label="Personnalisé : Entrer une stack en texte libre"
            aria-pressed={presetId === STACK_PRESET_CUSTOM}
          >
            <div className="stack-preset-icon" aria-hidden="true">✏️</div>
            <div className="stack-preset-name">Personnalisé</div>
            <div className="stack-preset-hint">Texte libre</div>
          </Button>
        </div>
      </div>

      {/* Step 2: Custom Stack Input */}
      {showCustomInput && (
        <div className="stack-wizard-step">
          <h3 className="stack-wizard-step-title" id="custom-stack-label">Étape 2 : Décrire la stack personnalisée</h3>
          <textarea
            id="custom-stack-textarea"
            className="stack-wizard-textarea"
            rows={8}
            value={customText}
            onChange={(e) => onCustomTextChange(e.target.value)}
            placeholder="Ex: Python 3.11, FastAPI, PostgreSQL, React TypeScript, Docker, GitHub, pytest"
            aria-labelledby="custom-stack-label"
            spellCheck={false}
          />
        </div>
      )}

      {/* Step 3: Addons Selection */}
      {showAddons && (
        <div className="stack-wizard-step">
          <h3 className="stack-wizard-step-title" id="addons-label">Étape 3 : Affiner avec des modules (optionnel)</h3>
          <div className="stack-addon-groups-grid" role="group" aria-labelledby="addons-label">
            {STACK_ADDON_GROUPS.map((group) => (
              <fieldset key={group.id} className="stack-addon-group-card">
                <legend className="stack-addon-group-title">{group.title}</legend>
                <div className="stack-addon-options">
                  {group.options.map((option) => {
                    const checked = (addons[group.id] ?? []).includes(option.id);
                    return (
                      <label key={option.id} className="stack-addon-toggle">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleAddon(group.id, option.id)}
                          aria-label={`Inclure ${option.label} (${group.title})`}
                        />
                        <span className="stack-addon-label">{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        </div>
      )}

      {/* Step 4: Preview */}
      {presetId !== STACK_PRESET_NONE && (
        <div className="stack-wizard-step">
          <h3 className="stack-wizard-step-title" id="preview-label">Étape 4 : Aperçu final</h3>
          <div className="stack-preview-container">
            <textarea
              id="stack-preview-textarea"
              className="stack-preview-textarea"
              readOnly
              rows={6}
              value={composedStack}
              spellCheck={false}
              title="Aperçu de la stack composée (texte injecté côté daemon)"
              aria-labelledby="preview-label"
              aria-readonly="true"
            />
            <p className="stack-preview-hint" id="preview-hint">
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
