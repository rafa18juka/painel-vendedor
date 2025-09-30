from pathlib import Path
text = Path("src/app/painel/PainelPage.tsx").read_text(encoding="utf-8")
start = text.index("        if (previousMonth !== month) {")
end = text.index("        } else {", start)
print(repr(text[start:end+12]))
