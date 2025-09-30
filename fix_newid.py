from pathlib import Path

path = Path("src/app/painel/PainelPage.tsx")
text = path.read_text(encoding="utf-8")
old_move = "        const newId = await addSale({ ...baseSale, createdAt: editingSale.sale.createdAt ?? new Date().toISOString() });\r\n\r\n        updateSalesForMonth(previousMonth, (list) => list.filter((item) => item.id !== saleId));\r\n\r\n        updateSalesForMonth(month, (list) => [{ id: newId, ...baseSale, createdAt: editingSale.sale.createdAt ?? new Date().toISOString() }, ...list]);\r\n"
new_move = "        const newId = await addSale({ ...baseSale, createdAt: editingSale.sale.createdAt ?? new Date().toISOString() });\r\n\r\n        const persistedId = newId ?? createId('sale');\r\n\r\n        updateSalesForMonth(previousMonth, (list) => list.filter((item) => item.id !== saleId));\r\n\r\n        updateSalesForMonth(month, (list) => [{ id: persistedId, ...baseSale, createdAt: editingSale.sale.createdAt ?? new Date().toISOString() }, ...list]);\r\n"
old_create = "        const newId = await addSale(dataToSave);\r\n\r\n        updateSalesForMonth(month, (list) => [{ id: newId, ...dataToSave }, ...list]);\r\n"
new_create = "        const newId = await addSale(dataToSave);\r\n\r\n        const persistedId = newId ?? createId('sale');\r\n\r\n        updateSalesForMonth(month, (list) => [{ id: persistedId, ...dataToSave }, ...list]);\r\n"
if old_move not in text or old_create not in text:
    raise SystemExit('patterns not found')
text = text.replace(old_move, new_move)
text = text.replace(old_create, new_create)
path.write_text(text, encoding='utf-8')
