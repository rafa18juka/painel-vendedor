from pathlib import Path
path = Path(r"src/lib/storage.ts")
text = path.read_text(encoding="utf-8")
old = "    if (typeof window === 'undefined') return;\n    localStorage.setItem(keyFor(scope, uid), JSON.stringify(value));\n"
if old not in text:
    raise SystemExit('anchor not found')
new = "    if (typeof window === 'undefined') return;\n    const storageKey = keyFor(scope, uid);\n    localStorage.setItem(storageKey, JSON.stringify(value));\n    if (typeof import !== 'undefined' && (import as any).meta?.env?.DEV) {\n      console.debug('[storage] set', storageKey, value);\n    }\n"
# can't use 'import' as identifier; string will be inserted but TypeScript will treat 'import' as keyword? 'typeof import' invalid.
