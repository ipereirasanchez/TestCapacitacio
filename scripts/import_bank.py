#!/usr/bin/env python3
"""Convierte los ZIP oficiales del Ministerio (preguntas y casos prácticos de
mercancías) en los JSON que consume la app.

Uso:
    python3 -I scripts/import_bank.py --pm pm_260326.zip --cm cm_260326.zip [--out data]

`--pm` y `--cm` aceptan una ruta local o una URL (se descarga con un
User-Agent de navegador, porque el servidor rechaza clientes genéricos).
Solo usa la biblioteca estándar.
"""
from __future__ import annotations

import argparse
import io
import json
import re
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

TOPICS = {
    "A": "A. Elementos de Derecho civil",
    "B": "B. Elementos de Derecho mercantil",
    "C": "C. Elementos de Derecho laboral",
    "D": "D. Elementos de Derecho fiscal",
    "E": "E. Gestión comercial y financiera de la empresa",
    "F": "F. Acceso a los mercados",
    "G": "G. Normas y explotación técnicas",
    "H": "H. Seguridad vial",
}

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130 Safari/537.36"
)

_RECORD_SPLIT = re.compile(r"(?m)^(?=COD:)")
_PM_LABEL = re.compile(r"^(COD|PREGUNTA|SOLUCION|NORMA|REFERENCIA DOCTRINAL|[A-D]):\s?(.*)$")
_CM_LABEL = re.compile(r"^(COD|PREGUNTA|SOLUCION|NORMA|REFERENCIA DOCTRINAL|RESPUESTA [A-H]):\s?(.*)$")
_ITEM_PREFIX = re.compile(r"^(?:[A-Z]\)\s*)+")  # también prefijos doblados "B) B) ..."
_STRAY_LABEL = re.compile(r"^respuesta [a-h]:\s*$", re.I)  # línea suelta "Respuesta G:" en el texto oficial


def _records(text: str) -> list[str]:
    return [r for r in _RECORD_SPLIT.split(text) if r.startswith("COD:")]


def parse_preguntas(text: str, topic: str) -> list[dict]:
    out = []
    for rec in _records(text):
        fields: dict[str, str] = {}
        order: list[str] = []
        last = None
        for line in rec.split("\n"):
            m = _PM_LABEL.match(line)
            if m:
                last = m.group(1)
                fields[last] = m.group(2).strip()
                order.append(last)
            elif line.strip() and last:
                # Línea de continuación: pertenece al campo anterior.
                fields[last] = (fields[last] + " " + line.strip()).strip()
        options = [{"key": k, "text": fields[k]} for k in "ABCD" if k in fields]
        out.append(
            {
                "topic": topic,
                "code": fields.get("COD", ""),
                "question": fields.get("PREGUNTA", ""),
                "options": options,
                "answer": fields.get("SOLUCION", ""),
                "norma": fields.get("NORMA", ""),
                "referencia": fields.get("REFERENCIA DOCTRINAL") or None,
            }
        )
    return out


def parse_casos(text: str, topic: str) -> list[dict]:
    out = []
    seen: set[str] = set()
    for rec in _records(text):
        code = ""
        scenario: list[str] = []
        options: list[dict] = []
        answer = ""
        norma = ""
        referencia = None
        section = None  # "PREGUNTA" | "RESPUESTA X" | otros
        for line in rec.split("\n"):
            m = _CM_LABEL.match(line)
            if m:
                label, value = m.group(1), m.group(2).strip()
                section = label
                if label == "COD":
                    code = value
                elif label == "SOLUCION":
                    answer = value.replace("RESPUESTA", "").strip()
                elif label == "NORMA":
                    norma = value
                elif label == "REFERENCIA DOCTRINAL":
                    referencia = value
                elif label.startswith("RESPUESTA"):
                    options.append({"key": label.split()[1], "items": []})
                    if value:
                        options[-1]["items"].append(_ITEM_PREFIX.sub("", value))
                elif label == "PREGUNTA" and value:
                    scenario.append(value)
                continue
            s = line.strip()
            if not s:
                continue
            if section == "PREGUNTA":
                scenario.append(s)
            elif section and section.startswith("RESPUESTA"):
                if _STRAY_LABEL.match(s):
                    continue
                options[-1]["items"].append(_ITEM_PREFIX.sub("", s))
            elif section == "NORMA":
                norma = (norma + " " + s).strip()
            elif section == "REFERENCIA DOCTRINAL":
                referencia = ((referencia or "") + " " + s).strip()
        if code in seen:
            print(f"aviso: código de caso duplicado {code}, se conserva el primero", file=sys.stderr)
            continue
        seen.add(code)
        out.append(
            {
                "topic": topic,
                "code": code,
                "scenario": scenario,
                "options": options,
                "answer": answer,
                "norma": norma,
                "referencia": referencia,
            }
        )
    return out


def date_from_zip_name(name: str) -> str:
    m = re.search(r"_(\d{2})(\d{2})(\d{2})\.zip$", Path(name).name)
    if not m:
        return ""
    yy, mm, dd = m.groups()
    return f"20{yy}-{mm}-{dd}"


def source_label(src: str) -> str:
    """URL tal cual; para rutas locales solo el nombre del archivo."""
    return src if re.match(r"^https?://", src) else Path(src).name


def _fetch(src: str) -> Path:
    """Devuelve una ruta local al ZIP; descarga si `src` es una URL."""
    if re.match(r"^https?://", src):
        req = urllib.request.Request(src, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = resp.read()
        tmp = tempfile.NamedTemporaryFile(suffix="_" + Path(src).name, delete=False)
        tmp.write(data)
        tmp.close()
        return Path(tmp.name)
    return Path(src)


def _parse_zip(path: Path, parser, prefix: str) -> list[dict]:
    items: list[dict] = []
    with zipfile.ZipFile(path) as zf:
        for name in sorted(zf.namelist()):
            m = re.match(rf"{prefix}1([A-H])\.txt$", Path(name).name)
            if not m:
                continue
            text = io.TextIOWrapper(zf.open(name), encoding="utf-8-sig").read()
            items.extend(parser(text, TOPICS[m.group(1)]))
    return items


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pm", required=True, help="ZIP de preguntas (ruta o URL)")
    ap.add_argument("--cm", required=True, help="ZIP de casos prácticos (ruta o URL)")
    ap.add_argument("--out", default="data", help="carpeta de salida (por defecto: data)")
    args = ap.parse_args(argv)

    pm_path, cm_path = _fetch(args.pm), _fetch(args.cm)
    preguntas = _parse_zip(pm_path, parse_preguntas, "pm")
    casos = _parse_zip(cm_path, parse_casos, "cm")

    # Guarda: nunca sobrescribir el banco con un resultado vacío (ZIP renombrado, formato nuevo...).
    if not preguntas or not casos:
        print(
            f"error: resultado vacío (preguntas: {len(preguntas)}, casos: {len(casos)}); "
            "no se escribe nada. ¿Los ZIP contienen pm1A..pm1H.txt / cm1A..cm1H.txt?",
            file=sys.stderr,
        )
        return 1

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    dump = dict(ensure_ascii=False, indent=1)
    (out / "preguntas.json").write_text(json.dumps(preguntas, **dump) + "\n", encoding="utf-8")
    (out / "casos.json").write_text(json.dumps(casos, **dump) + "\n", encoding="utf-8")
    meta = {
        "updated": date_from_zip_name(args.pm) or date_from_zip_name(args.cm),
        "preguntas": len(preguntas),
        "casos": len(casos),
        "sources": {"pm": source_label(args.pm), "cm": source_label(args.cm)},
    }
    (out / "meta.json").write_text(json.dumps(meta, **dump) + "\n", encoding="utf-8")
    print(f"preguntas: {len(preguntas)}  casos: {len(casos)}  fecha: {meta['updated']}  -> {out}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
