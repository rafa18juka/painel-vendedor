export function noteBgUrl(theme: string): string {
  const map: Record<string, string> = {
    yellow: "/icons/postyellow.png",
    red: "/icons/postred.png",
    pink: "/icons/postpink.png",
    green: "/icons/postgreen.png",
    blue: "/icons/postblue.png",
    fundonotasazul: "/icons/fundonotasazul.png",
    fundonotaslaranja: "/icons/fundonotaslaranja.png",
    fundonotasrosa: "/icons/fundonotasrosa.png",
    fundonotasverde: "/icons/fundonotasverde.png",
    fundonotasverdinho: "/icons/fundonotasverdinho.png",
    pendencias: "/icons/fundopendencias.png"
  };

  const legacy: Record<string, string> = {
    "#FDE68A": map["yellow"],
    "#FBCFE8": map["pink"],
    "#BFDBFE": map["blue"],
    "#BBF7D0": map["green"],
    "#FCD34D": map["yellow"],
    "#FDBA74": map["red"],
    "#DDD6FE": map["blue"],
    "#A7F3D0": map["green"],
    "#F9A8D4": map["pink"],
    "#FEF3C7": map["yellow"]
  };

  return map[theme] ?? legacy[theme] ?? "";
}
