from pathlib import Path
text = Path("src/app/painel/PainelPage.tsx").read_text(encoding="utf-8")
start = text.index('<TabsContent value="tools"')
end = text.index('</TabsContent>', start) + len('</TabsContent>')
print(text[start:end])
