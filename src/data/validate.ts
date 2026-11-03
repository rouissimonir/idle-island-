export interface Balance {
  offlineCapMs: number;
  awayThresholdMs: number;
  summaryMinMs: number;
  manualCastBaseMs: number;
  autoCastBaseMs: number;
  tideCastMs: number;
  castLevelFactor: number;
  minManualCastMs: number;
  minAutoCastMs: number;
  soilGrowFactor: number;
  sprinklerGrowFactor: number;
  marketPriceFactor: number;
  plotCount: number;
  maxCastsPerAdvance: number;
}

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface FishDef {
  id: string;
  name: string;
  sellValue: number;
  rarity: Rarity;
  color: string;
  weights: number[];
}

export interface CropDef {
  id: string;
  name: string;
  growSeconds: number;
  sellValue: number;
  color: string;
}

export type UpgradeEffect = 'rod' | 'soil' | 'market' | 'auto_fisher' | 'sprinkler' | 'helper';

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  effect: UpgradeEffect;
  maxLevel: number;
  costs: number[];
  automation: boolean;
}

export interface GameContent {
  balance: Balance;
  fish: FishDef[];
  crops: CropDef[];
  upgrades: UpgradeDef[];
}

export interface AssetEntry {
  id: string;
  file: string | null;
  scale: number;
  license: string;
  source: string;
}

export interface AssetManifest {
  version: 1;
  assets: AssetEntry[];
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const EFFECTS: readonly UpgradeEffect[] = [
  'rod',
  'soil',
  'market',
  'auto_fisher',
  'sprinkler',
  'helper',
];

const AUTOMATION_EFFECTS = new Set<UpgradeEffect>(['auto_fisher', 'sprinkler', 'helper']);
const RARITIES = new Set<Rarity>(['common', 'uncommon', 'rare', 'legendary']);
const ID_PATTERN = /^[a-z][a-z0-9_]*$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const FILE_PATTERN = /^(?!\/)(?!.*\.\.)[a-zA-Z0-9_./-]+$/;

const BALANCE_KEYS: (keyof Balance)[] = [
  'offlineCapMs',
  'awayThresholdMs',
  'summaryMinMs',
  'manualCastBaseMs',
  'autoCastBaseMs',
  'tideCastMs',
  'castLevelFactor',
  'minManualCastMs',
  'minAutoCastMs',
  'soilGrowFactor',
  'sprinklerGrowFactor',
  'marketPriceFactor',
  'plotCount',
  'maxCastsPerAdvance',
];

export function parseContent(input: {
  balance: unknown;
  fish: unknown;
  crops: unknown;
  upgrades: unknown;
}): ParseResult<GameContent> {
  const errors: string[] = [];
  const balance = readBalance(input.balance, errors);
  const fish = readFish(input.fish, errors);
  const crops = readCrops(input.crops, errors);
  const upgrades = readUpgrades(input.upgrades, errors);
  if (fish && upgrades) checkFishWeights(fish, upgrades, errors);
  if (errors.length > 0 || !balance || !fish || !crops || !upgrades) {
    return { ok: false, errors };
  }
  return { ok: true, value: { balance, fish, crops, upgrades } };
}

export function parseAssets(input: unknown): ParseResult<AssetManifest> {
  const errors: string[] = [];
  if (!isRecord(input)) return { ok: false, errors: ['manifest must be an object'] };
  if (input.version !== 1) errors.push('version must be 1');
  if (!Array.isArray(input.assets) || input.assets.length === 0) {
    errors.push('assets must be a non-empty array');
    return { ok: false, errors };
  }
  const assets: AssetEntry[] = [];
  const seen = new Set<string>();
  input.assets.forEach((entry, index) => {
    const asset = readAsset(entry, index, errors);
    if (!asset) return;
    if (seen.has(asset.id)) errors.push(`assets[${index}].id is duplicated`);
    seen.add(asset.id);
    assets.push(asset);
  });
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { version: 1, assets } };
}

function readBalance(value: unknown, errors: string[]): Balance | null {
  if (!isRecord(value)) {
    errors.push('balance must be an object');
    return null;
  }
  const balance = {} as Balance;
  for (const key of BALANCE_KEYS) {
    const raw = value[key];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      errors.push(`balance.${key} must be a finite number`);
      return null;
    }
    balance[key] = raw;
  }
  const extra = Object.keys(value).filter((key) => !BALANCE_KEYS.includes(key as keyof Balance));
  if (extra.length > 0) errors.push(`balance has unknown keys: ${extra.join(', ')}`);
  checkRange(errors, 'balance.offlineCapMs', balance.offlineCapMs, 60_000, 7 * 24 * 60 * 60 * 1000);
  checkRange(
    errors,
    'balance.awayThresholdMs',
    balance.awayThresholdMs,
    1,
    balance.offlineCapMs - 1,
  );
  checkRange(
    errors,
    'balance.summaryMinMs',
    balance.summaryMinMs,
    balance.awayThresholdMs,
    balance.offlineCapMs,
  );
  if (!(balance.minManualCastMs > 0 && balance.minManualCastMs < balance.manualCastBaseMs)) {
    errors.push('balance.minManualCastMs must be > 0 and < manualCastBaseMs');
  }
  if (!(balance.minAutoCastMs > 0 && balance.minAutoCastMs < balance.autoCastBaseMs)) {
    errors.push('balance.minAutoCastMs must be > 0 and < autoCastBaseMs');
  }
  if (balance.tideCastMs <= balance.autoCastBaseMs) {
    errors.push('balance.tideCastMs must be slower than autoCastBaseMs');
  }
  checkRange(errors, 'balance.castLevelFactor', balance.castLevelFactor, 0.5, 0.999);
  checkRange(errors, 'balance.soilGrowFactor', balance.soilGrowFactor, 0.5, 0.999);
  checkRange(errors, 'balance.sprinklerGrowFactor', balance.sprinklerGrowFactor, 0.2, 0.999);
  checkRange(errors, 'balance.marketPriceFactor', balance.marketPriceFactor, 1.001, 2);
  if (!Number.isInteger(balance.plotCount)) errors.push('balance.plotCount must be an integer');
  checkRange(errors, 'balance.plotCount', balance.plotCount, 1, 9);
  if (!Number.isInteger(balance.maxCastsPerAdvance)) {
    errors.push('balance.maxCastsPerAdvance must be an integer');
  }
  checkRange(errors, 'balance.maxCastsPerAdvance', balance.maxCastsPerAdvance, 100, 100_000);
  return errors.length > 0 ? null : balance;
}

function readFish(value: unknown, errors: string[]): FishDef[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push('fish must be a non-empty array');
    return null;
  }
  const fish: FishDef[] = [];
  const seen = new Set<string>();
  value.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`fish[${index}] must be an object`);
      return;
    }
    const id = readId(entry.id, `fish[${index}].id`, errors);
    const name = readText(entry.name, `fish[${index}].name`, errors);
    const color = readColor(entry.color, `fish[${index}].color`, errors);
    const sellValue = readPositiveInt(entry.sellValue, `fish[${index}].sellValue`, errors);
    const rarity = readRarity(entry.rarity, `fish[${index}].rarity`, errors);
    const weights = readWeightRow(entry.weights, `fish[${index}].weights`, errors);
    if (!id || !name || !color || sellValue == null || !rarity || !weights) return;
    if (seen.has(id)) errors.push(`fish[${index}].id is duplicated`);
    seen.add(id);
    fish.push({ id, name, sellValue, rarity, color, weights });
  });
  return fish.length === value.length ? fish : null;
}

function readCrops(value: unknown, errors: string[]): CropDef[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push('crops must be a non-empty array');
    return null;
  }
  const crops: CropDef[] = [];
  const seen = new Set<string>();
  value.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`crops[${index}] must be an object`);
      return;
    }
    const id = readId(entry.id, `crops[${index}].id`, errors);
    const name = readText(entry.name, `crops[${index}].name`, errors);
    const color = readColor(entry.color, `crops[${index}].color`, errors);
    const sellValue = readPositiveInt(entry.sellValue, `crops[${index}].sellValue`, errors);
    const growSeconds = entry.growSeconds;
    if (typeof growSeconds !== 'number' || !Number.isFinite(growSeconds) || growSeconds <= 0) {
      errors.push(`crops[${index}].growSeconds must be > 0`);
    }
    if (!id || !name || !color || sellValue == null || typeof growSeconds !== 'number') return;
    if (seen.has(id)) errors.push(`crops[${index}].id is duplicated`);
    seen.add(id);
    crops.push({ id, name, growSeconds, sellValue, color });
  });
  return crops.length === value.length ? crops : null;
}

function readUpgrades(value: unknown, errors: string[]): UpgradeDef[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push('upgrades must be a non-empty array');
    return null;
  }
  const upgrades: UpgradeDef[] = [];
  const seenIds = new Set<string>();
  const seenEffects = new Set<string>();
  value.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`upgrades[${index}] must be an object`);
      return;
    }
    const id = readId(entry.id, `upgrades[${index}].id`, errors);
    const name = readText(entry.name, `upgrades[${index}].name`, errors);
    const description = readText(entry.description, `upgrades[${index}].description`, errors);
    const effect = readEffect(entry.effect, `upgrades[${index}].effect`, errors);
    const maxLevel = readPositiveInt(entry.maxLevel, `upgrades[${index}].maxLevel`, errors);
    const costs = readCosts(entry.costs, `upgrades[${index}].costs`, errors);
    if (typeof entry.automation !== 'boolean') {
      errors.push(`upgrades[${index}].automation must be a boolean`);
    }
    if (!id || !name || !description || !effect || maxLevel == null || !costs) return;
    if (costs.length !== maxLevel)
      errors.push(`upgrades[${index}].costs length must equal maxLevel`);
    if (seenIds.has(id)) errors.push(`upgrades[${index}].id is duplicated`);
    if (seenEffects.has(effect)) errors.push(`upgrades[${index}].effect is duplicated`);
    seenIds.add(id);
    seenEffects.add(effect);
    const automation = entry.automation === true;
    if (AUTOMATION_EFFECTS.has(effect) && (!automation || maxLevel !== 1)) {
      errors.push(`upgrades[${index}] automation effects are single unlocks`);
    }
    if (!AUTOMATION_EFFECTS.has(effect) && automation) {
      errors.push(`upgrades[${index}] is marked automation but its effect is not`);
    }
    upgrades.push({ id, name, description, effect, maxLevel, costs, automation });
  });
  for (const effect of EFFECTS) {
    if (!seenEffects.has(effect)) errors.push(`missing upgrade effect ${effect}`);
  }
  return upgrades.length === value.length ? upgrades : null;
}

function checkFishWeights(fish: FishDef[], upgrades: UpgradeDef[], errors: string[]): void {
  const rod = upgrades.find((upgrade) => upgrade.effect === 'rod');
  if (!rod) return;
  const width = rod.maxLevel + 1;
  for (const entry of fish) {
    if (entry.weights.length !== width) {
      errors.push(`fish.${entry.id}.weights must have length ${width}`);
    }
  }
  for (let level = 0; level < width; level += 1) {
    const total = fish.reduce((sum, entry) => sum + (entry.weights[level] ?? 0), 0);
    if (total <= 0) errors.push(`fish weights at rod level ${level} sum to 0`);
  }
}

function readAsset(value: unknown, index: number, errors: string[]): AssetEntry | null {
  if (!isRecord(value)) {
    errors.push(`assets[${index}] must be an object`);
    return null;
  }
  const id = readId(value.id, `assets[${index}].id`, errors);
  const license = readText(value.license, `assets[${index}].license`, errors);
  const source = readText(value.source, `assets[${index}].source`, errors);
  const scale = value.scale;
  if (typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0) {
    errors.push(`assets[${index}].scale must be > 0`);
  }
  let file: string | null = null;
  if (value.file === null) file = null;
  else if (typeof value.file === 'string' && FILE_PATTERN.test(value.file)) file = value.file;
  else errors.push(`assets[${index}].file must be null or a relative path`);
  if (!id || !license || !source || typeof scale !== 'number') return null;
  return { id, file, scale, license, source };
}

function readWeightRow(value: unknown, label: string, errors: string[]): number[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${label} must be a non-empty array`);
    return null;
  }
  const weights: number[] = [];
  for (const entry of value) {
    if (typeof entry !== 'number' || !Number.isInteger(entry) || entry < 0) {
      errors.push(`${label} must be non-negative integers`);
      return null;
    }
    weights.push(entry);
  }
  return weights;
}

function readCosts(value: unknown, label: string, errors: string[]): number[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${label} must be a non-empty array`);
    return null;
  }
  const costs: number[] = [];
  for (const entry of value) {
    if (typeof entry !== 'number' || !Number.isInteger(entry) || entry <= 0) {
      errors.push(`${label} must be positive integers`);
      return null;
    }
    const previous = costs[costs.length - 1];
    if (previous != null && entry <= previous) errors.push(`${label} must strictly increase`);
    costs.push(entry);
  }
  return costs;
}

function readEffect(value: unknown, label: string, errors: string[]): UpgradeEffect | null {
  if (typeof value === 'string' && EFFECTS.includes(value as UpgradeEffect))
    return value as UpgradeEffect;
  errors.push(`${label} must be one of ${EFFECTS.join(', ')}`);
  return null;
}

function readRarity(value: unknown, label: string, errors: string[]): Rarity | null {
  if (typeof value === 'string' && RARITIES.has(value as Rarity)) return value as Rarity;
  errors.push(`${label} must be a known rarity`);
  return null;
}

function readId(value: unknown, label: string, errors: string[]): string | null {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    errors.push(`${label} must be a lowercase id`);
    return null;
  }
  return value;
}

function readText(value: unknown, label: string, errors: string[]): string | null {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`${label} must be a non-empty string`);
    return null;
  }
  return value;
}

function readColor(value: unknown, label: string, errors: string[]): string | null {
  if (typeof value !== 'string' || !COLOR_PATTERN.test(value)) {
    errors.push(`${label} must be a #rrggbb color`);
    return null;
  }
  return value;
}

function readPositiveInt(value: unknown, label: string, errors: string[]): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    errors.push(`${label} must be a positive integer`);
    return null;
  }
  return value;
}

function checkRange(
  errors: string[],
  label: string,
  value: number,
  min: number,
  max: number,
): void {
  if (value < min || value > max) errors.push(`${label} must be between ${min} and ${max}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
