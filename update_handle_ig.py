from pathlib import Path

path = Path('src/app/painel/PainelPage.tsx')
text = path.read_text(encoding='utf-8')
old_block = "    const limit = type === 'posts' ? config.instagram.postsPerDay : config.instagram.storiesPerDay;\n\n    if ((ig as any)[type] >= limit) {\n\n      toast('Meta atingida! Aproveite para celebrar.');\n\n      return;\n\n    }\n\n    const timeLabel = format(getNow(), 'HH:mm');\n\n    await incrementIG({ uid: user.uid, dateISO: today, type, time: type === 'stories' ? timeLabel : undefined });\n\n    const updated = await getIGDay(user.uid, today);\n\n    setIg(updated ?? { posts: 0, stories: 0 });\n\n    if (type === 'posts' && updated?.posts === config.instagram.postsPerDay) {\n\n      confetti({ particleCount: 80, spread: 70, origin: { y: 0.8 } });\n\n      toast.success('Post do dia feito!');\n\n    }\n\n    if (type === 'stories' && updated?.stories === config.instagram.storiesPerDay) {\n\n      confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 } });\n\n      toast.success('Stories concluidos!');\n\n    }\n"

if old_block not in text:
    raise SystemExit('Old block not found')

new_block = "    const limit = type === 'posts' ? config.instagram.postsPerDay : config.instagram.storiesPerDay;\n    const currentCount = (ig as any)[type] ?? 0;\n    const alreadyHitGoal = currentCount >= limit;\n\n    if (alreadyHitGoal) {\n      toast('Meta atingida! Continue postando :)');\n    }\n\n    const timeLabel = format(getNow(), 'HH:mm');\n\n    await incrementIG({ uid: user.uid, dateISO: today, type, time: type === 'stories' ? timeLabel : undefined });\n\n    const updated = await getIGDay(user.uid, today);\n    const normalizedIg: { posts: number; stories: number } = { posts: updated?.posts ?? 0, stories: updated?.stories ?? 0 };\n\n    setIg(normalizedIg);\n\n    const updatedCount = normalizedIg[type];\n\n    if (!alreadyHitGoal && updatedCount >= limit) {\n\n      if (type === 'posts') {\n\n        confetti({ particleCount: 80, spread: 70, origin: { y: 0.8 } });\n\n        toast.success('Post do dia feito!');\n\n      }\n\n      if (type === 'stories') {\n\n        confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 } });\n\n        toast.success('Stories concluidos!');\n\n      }\n\n    }\n"

text = text.replace(old_block, new_block)

path.write_text(text, encoding='utf-8')
