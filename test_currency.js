function normalizeCurrencyInput(value, emptyValue = 0) {
  if (value === undefined || value === null) {
    return emptyValue;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return emptyValue;
  }

  let normalized = trimmed.replace(/\s/g, "");
  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    normalized = normalized.replace(",", ".");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "");
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function toCurrencyNumber(value) {
  const parsed = normalizeCurrencyInput(value, 0);
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

['1.000', '1000', '1.000,00', '1,000.00', '1 000', '1000,50', '1.234.567', ''].forEach((value) => {
  console.log(value, '=>', toCurrencyNumber(value));
});
