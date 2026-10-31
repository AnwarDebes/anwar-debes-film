"""Derive the module graph of a Python package from its source.

Reads every module of one package with the ast module and prints JSON:
modules (path, line count, classes, public functions and methods with their
arguments, the first docstring line) and the package-internal imports, each
with the line it sits on. The result is the raw material for an
architecture JSON (nodes and edges); nothing in it is guessed.

    python scripts/diagram/derive_python.py <repo-dir> <package> [--out file.json]
"""

from __future__ import annotations

import argparse
import ast
import json
import pathlib
import subprocess
import sys


def signature(fn: ast.FunctionDef | ast.AsyncFunctionDef) -> str:
    args = [a.arg for a in fn.args.posonlyargs + fn.args.args if a.arg not in ("self", "cls")]
    if fn.args.vararg:
        args.append("*" + fn.args.vararg.arg)
    args += [a.arg for a in fn.args.kwonlyargs]
    if fn.args.kwarg:
        args.append("**" + fn.args.kwarg.arg)
    ret = ""
    if fn.returns is not None:
        try:
            ret = " -> " + ast.unparse(fn.returns)
        except Exception:  # noqa: BLE001
            ret = ""
    return f"{fn.name}({', '.join(args)}){ret}"


def first_doc_line(node: ast.AST) -> str:
    doc = ast.get_docstring(node) if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)) else None
    return doc.strip().splitlines()[0] if doc else ""


def module_name(rel: pathlib.Path) -> str:
    parts = list(rel.with_suffix("").parts)
    if parts[-1] == "__init__":
        parts = parts[:-1]
    return ".".join(parts)


def resolve(importer: str, is_pkg: bool, level: int, module: str | None) -> str:
    if level == 0:
        return module or ""
    base = importer.split(".")
    if not is_pkg:
        base = base[:-1]
    if level > 1:
        base = base[: len(base) - (level - 1)]
    return ".".join(base + ([module] if module else []))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("repo")
    ap.add_argument("package")
    ap.add_argument("--out")
    a = ap.parse_args()

    repo = pathlib.Path(a.repo).resolve()
    pkg_dir = repo / a.package
    files = sorted(pkg_dir.rglob("*.py"))
    names = {module_name(f.relative_to(repo)) for f in files}

    commit = ""
    try:
        commit = subprocess.run(["git", "-C", str(repo), "rev-parse", "HEAD"], capture_output=True, text=True, check=False).stdout.strip()
    except OSError:
        pass

    modules, imports = [], []
    for f in files:
        rel = f.relative_to(repo)
        src = f.read_text(encoding="utf-8")
        tree = ast.parse(src)
        name = module_name(rel)
        is_pkg = f.name == "__init__.py"
        classes, functions = [], []
        for node in tree.body:
            if isinstance(node, ast.ClassDef):
                methods = [signature(m) for m in node.body
                           if isinstance(m, (ast.FunctionDef, ast.AsyncFunctionDef)) and not m.name.startswith("_")]
                classes.append({"name": node.name, "line": node.lineno, "doc": first_doc_line(node), "methods": methods})
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and not node.name.startswith("_"):
                functions.append({"name": node.name, "line": node.lineno, "signature": signature(node), "doc": first_doc_line(node)})
        modules.append({
            "module": name,
            "path": rel.as_posix(),
            "loc": len(src.splitlines()),
            "doc": first_doc_line(tree),
            "classes": classes,
            "functions": functions,
        })
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                target = resolve(name, is_pkg, node.level, node.module)
                if target in names or any(target.startswith(n + ".") for n in names):
                    line = src.splitlines()[node.lineno - 1].strip()
                    imports.append({
                        "importer": name,
                        "imported": target,
                        "names": [al.name for al in node.names],
                        "line": node.lineno,
                        "code": line,
                    })
            elif isinstance(node, ast.Import):
                for al in node.names:
                    if al.name in names:
                        imports.append({"importer": name, "imported": al.name, "names": [al.name],
                                        "line": node.lineno, "code": src.splitlines()[node.lineno - 1].strip()})

    out = {"repo": repo.name, "package": a.package, "commit": commit, "modules": modules, "imports": imports}
    text = json.dumps(out, indent=2, ensure_ascii=False)
    if a.out:
        pathlib.Path(a.out).write_text(text + "\n", encoding="utf-8")
    else:
        sys.stdout.write(text + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
