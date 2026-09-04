/* Adapter for the bundled Risu database. Prompt text and generation remain in
   the unmodified runtime; no duplicate jailbreak is appended by World. */
export function createRisuPromptSettings(database) {
  const clone = value => JSON.parse(JSON.stringify(value));
  function ready() {
    let db = database.getDatabase();
    // The connection dialog is available before a game/era is installed.
    if (db.jailbreakToggle == null) {
      database.setDatabase(db);
      db = database.getDatabase();
    }
    return db;
  }
  function apply(settings = {}, restorePreset = false) {
    const db = ready();
    if (restorePreset && settings.nativePreset) {
      const preset = clone(settings.nativePreset);
      db.botPresets = [preset];
      db.botPresetsId = 0;
      database.changeToPreset(0, false);
    }
    if (typeof settings.jailbreakToggle === 'boolean') db.jailbreakToggle = settings.jailbreakToggle;
    if (typeof settings.jailbreak === 'string') db.jailbreak = settings.jailbreak;
    return read();
  }
  function read() {
    const db = ready();
    // Match Toggles.svelte, including templates using {{jbtoggled}} in any
    // native text field. Keep the switch visible even for a template without it.
    const template = db.promptTemplate;
    const usesToggle = value => typeof value === 'string' && value.includes('{{jbtoggled}}');
    const hasJailbreakPrompt = !template
      ? (db.jailbreak ?? '').trim().length > 0
      : template.some(item => item.type === 'jailbreak' ||
          usesToggle(item.text) || usesToggle(item.innerFormat) || usesToggle(item.defaultText));
    return { enabled: db.jailbreakToggle, text: db.jailbreak,
      hasJailbreakPrompt, template: !!template,
      presetName: db.botPresets?.[db.botPresetsId]?.name || '' };
  }
  function capturePreset(settings) {
    const db = ready();
    const preset = db.botPresets?.[db.botPresetsId];
    if (!preset) throw new Error('没有可用的原生预设');
    // Preserve the entire imported preset, including ordering and custom fields.
    settings.nativePreset = clone(preset);
    settings.jailbreak = db.jailbreak;
    settings.jailbreakToggle = db.jailbreakToggle;
    return read();
  }
  function resetPrompt(settings) {
    settings.jailbreak = database.presetTemplate.jailbreak;
    return apply(settings);
  }
  return { apply, read, capturePreset, resetPrompt };
}
