import unicodedata


def spreadsheet_cell(value):
    """Neutralize formulas at export only; canonical audit and JSON remain untouched."""
    if value is None:
        return ""
    text = str(value)
    significant = text.lstrip()
    while significant and unicodedata.category(significant[0]).startswith("C"):
        significant = significant[1:].lstrip()
    if significant.startswith(("=", "+", "-", "@")) or any(c in text[:1] for c in "\t\r\n"):
        return "'" + text
    return text
