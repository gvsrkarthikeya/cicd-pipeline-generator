import en from '../locales/en.json';

/**
 * Resolve a dot-separated key from the string catalogue.
 * Strings support `{name}` placeholders; non-string values (arrays, objects)
 * are returned as-is so list content can live in the same catalogue.
 */
export function t(key, vars) {
  const value = key.split('.').reduce((acc, part) => acc?.[part], en);

  if (value === undefined) return key;
  if (typeof value !== 'string' || !vars) return value;

  return value.replace(/\{(\w+)\}/g, (match, name) =>
    name in vars ? String(vars[name]) : match
  );
}
