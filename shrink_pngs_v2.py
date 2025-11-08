#!/usr/bin/env python3
import argparse, os, sys, shutil, tempfile, subprocess
from pathlib import Path
from PIL import Image

def has_pngquant():
    return shutil.which("pngquant") is not None

def is_png_path(p: Path) -> bool:
    return p.suffix.lower() == ".png"

def resize_if_needed(img: Image.Image, max_side: int) -> Image.Image:
    if not max_side or max_side <= 0:
        return img
    w, h = img.size
    m = max(w, h)
    if m <= max_side:
        return img
    scale = max_side / float(m)
    new_size = (max(1, int(w * scale)), max(1, int(h * scale)))
    return img.resize(new_size, Image.LANCZOS)

def quantize_png(img: Image.Image, colors: int) -> Image.Image:
    """
    Restituisce un'immagine in modalità 'P' (PNG-8) con (eventuale) trasparenza per palette.
    Dithering spento per loghi/icone più puliti.
    """
    # Con Pillow recente, quantize su RGBA gestisce anche la trasparenza via tRNS in palette
    # Per immagini fotografiche può introdurre banding: valuta --colors 256 o salta pngquant.
    return img.quantize(colors=colors, method=Image.FASTOCTREE, dither=Image.NONE)

def save_png(img: Image.Image, out_path: Path, dry_run: bool):
    if dry_run:
        return
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # Niente pnginfo -> niente metadati
    img.save(out_path, format="PNG", optimize=True, compress_level=9)

def try_pngquant(in_path: Path, out_path: Path, quality: str = "65-90", speed: str = "1", dry_run: bool = False) -> bool:
    """
    Usa pngquant (lossy) per comprimere ulteriormente.
    Restituisce True se ha prodotto un file più piccolo, altrimenti False.
    """
    if not has_pngquant():
        return False

    tmp_out = out_path.with_suffix(".pngquant.tmp.png")
    cmd = [
        "pngquant",
        "--force",
        f"--quality={quality}",
        f"--speed={speed}",
        "--output", str(tmp_out),
        "--", str(in_path)
    ]
    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if res.returncode != 0 or not tmp_out.exists():
            return False
        if dry_run:
            tmp_out.unlink(missing_ok=True)
            return False
        # Sostituisci se migliore
        if tmp_out.stat().st_size < out_path.stat().st_size:
            shutil.move(str(tmp_out), str(out_path))
            return True
        else:
            tmp_out.unlink(missing_ok=True)
            return False
    except Exception:
        return False

def process_png(src: Path, dst: Path, max_size: int, colors: int, use_pngquant: bool, dry_run: bool):
    try:
        with Image.open(src) as im:
            im.load()

            # Ridimensiona se necessario
            im2 = resize_if_needed(im, max_size)

            # Se è già palette P, ricomprimi comunque (potrebbe non essere ottimizzata)
            # Altrimenti quantizza a PNG-8
            if im2.mode not in ("P",):
                # Per loghi con alpha va bene quantizzare direttamente (Pillow gestisce tRNS)
                im2 = quantize_png(im2, colors)

            # Salva una prima versione ottimizzata
            tmp_first = dst if dry_run else Path(tempfile.mkstemp(suffix=".png")[1])
            save_png(im2, tmp_first, dry_run)

            before = src.stat().st_size
            after_first = before if dry_run else Path(tmp_first).stat().st_size

            # pngquant (opzionale, di solito dà il boost grosso)
            if use_pngquant and not dry_run:
                # Applica pngquant sul file temporaneo già quantizzato
                improved = try_pngquant(Path(tmp_first), Path(tmp_first), quality="65-90", speed="1", dry_run=False)
                if improved:
                    after_first = Path(tmp_first).stat().st_size

            if dry_run:
                ratio = 0.0
                print(f"{src.name}  {before/1024:.1f}KB → (stima) {after_first/1024:.1f}KB  (-{ratio:.1f}%)")
                if tmp_first != dst:
                    try: Path(tmp_first).unlink(missing_ok=True)
                    except: pass
                return before, after_first

            # Scrivi sul dst (in-place o in output)
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(tmp_first), str(dst))

            after = dst.stat().st_size
            return before, after

    except Exception as e:
        print(f"[WARN] Skippato {src}: {e}", file=sys.stderr)
        return None, None

def main():
    ap = argparse.ArgumentParser(description="Shrink PNGs (resize + PNG-8 quantize + optimize, pngquant opzionale)")
    ap.add_argument("--input", required=True, help="Cartella input")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--output", help="Cartella output")
    g.add_argument("--inplace", action="store_true", help="Sovrascrivi i file (ATTENZIONE)")
    ap.add_argument("--max-size", type=int, default=1600, help="Lato max (px). 0 = no resize")
    ap.add_argument("--colors", type=int, default=256, help="Numero colori per PNG-8 (es. 128 per più compressione)")
    ap.add_argument("--no-pngquant", action="store_true", help="Non usare pngquant anche se presente")
    ap.add_argument("--dry-run", action="store_true", help="Non scrive file, mostra solo stime")
    args = ap.parse_args()

    inp = Path(args.input)
    if not inp.is_dir():
        print("Input non valido", file=sys.stderr); sys.exit(1)

    outdir = inp if args.inplace else Path(args.output)
    if not args.inplace and not args.dry_run:
        outdir.mkdir(parents=True, exist_ok=True)

    use_pngquant = (not args.no_pngquant) and has_pngquant()

    total_before = total_after = 0
    count = 0

    for p in inp.rglob("*.png"):
        rel = p.relative_to(inp)
        dst = (inp / rel) if args.inplace else (outdir / rel)
        before, after = process_png(p, dst, args.max_size, args.colors, use_pngquant, args.dry_run)
        if before is None:
            continue
        count += 1
        total_before += before
        total_after  += after
        ratio = (1 - after / before) * 100 if before else 0
        print(f"{rel}  {before/1024:.1f}KB → {after/1024:.1f}KB  (-{ratio:.1f}%)")

    if count:
        r = (1 - total_after/total_before)*100 if total_before else 0
        print(f"\n{count} file elaborati. Totale: {total_before/1024:.1f}KB → {total_after/1024:.1f}KB  (-{r:.1f}%)")
    else:
        print("Nessun PNG trovato.")

if __name__ == "__main__":
    main()
