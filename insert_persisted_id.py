from pathlib import Path

path = Path("src/app/painel/PainelPage.tsx")
text = path.read_text(encoding="utf-8")

needle_move = "const newId = await addSale({ ...baseSale, createdAt: editingSale.sale.createdAt ?? new Date().toISOString() });"
needle_create = "const newId = await addSale(dataToSave);"

for needle in (needle_move, needle_create):
    idx = text.find(needle)
    if idx == -1:
        raise SystemExit(f"needle not found: {needle}")
    end_of_line = text.find("\n", idx)
    insert_line = "\n        const persistedId = newId ?? createId('sale');" if needle == needle_move else "\n        const persistedIdCreate = newId ?? createId('sale');"
    text = text[:end_of_line] + insert_line + text[end_of_line:]

text = text.replace("[{ id: newId, ...baseSale", "[{ id: persistedId, ...baseSale", 1)
text = text.replace("[{ id: newId, ...dataToSave", "[{ id: persistedIdCreate, ...dataToSave", 1)

path.write_text(text, encoding='utf-8')
