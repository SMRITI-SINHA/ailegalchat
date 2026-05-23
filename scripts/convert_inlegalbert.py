"""
One-time script: Download law-ai/InLegalBERT, export to ONNX, quantize INT8.
Saves to server/models/inlegalbert/. Run via GitHub Actions (see .github/workflows/convert-inlegalbert.yml).
"""

import os
import sys
from pathlib import Path

OUTPUT_DIR = Path("server/models/inlegalbert")
MODEL_ID = "law-ai/InLegalBERT"
ONNX_FILE = OUTPUT_DIR / "model.onnx"
QUANTIZED_FILE = OUTPUT_DIR / "model_quantized.onnx"
TOKENIZER_FILE = OUTPUT_DIR / "tokenizer.json"

def main():
    if QUANTIZED_FILE.exists() and TOKENIZER_FILE.exists():
        print(f"Model already exists at {OUTPUT_DIR}, skipping.")
        return

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"[1/4] Downloading tokenizer for {MODEL_ID}...")
    from transformers import AutoTokenizer
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    tokenizer.save_pretrained(str(OUTPUT_DIR))
    print(f"      Tokenizer saved.")

    print(f"[2/4] Exporting {MODEL_ID} to ONNX...")
    from optimum.exporters.onnx import main_export
    main_export(
        MODEL_ID,
        output=str(OUTPUT_DIR),
        task="feature-extraction",
        do_validation=False,
    )
    if not ONNX_FILE.exists():
        print("ERROR: model.onnx was not created. Export failed.", file=sys.stderr)
        sys.exit(1)
    size_mb = ONNX_FILE.stat().st_size / 1024 / 1024
    print(f"      model.onnx: {size_mb:.1f} MB")

    print(f"[3/4] Quantizing to INT8 (dynamic)...")
    from onnxruntime.quantization import quantize_dynamic, QuantType
    quantize_dynamic(
        model_input=str(ONNX_FILE),
        model_output=str(QUANTIZED_FILE),
        weight_type=QuantType.QInt8,
    )
    q_size_mb = QUANTIZED_FILE.stat().st_size / 1024 / 1024
    print(f"      model_quantized.onnx: {q_size_mb:.1f} MB")

    print(f"[4/4] Cleaning up unquantized model...")
    ONNX_FILE.unlink()
    print(f"      Removed model.onnx")

    print("\nDone! Files in", OUTPUT_DIR)
    for f in sorted(OUTPUT_DIR.iterdir()):
        size = f.stat().st_size / 1024 / 1024
        print(f"  {f.name}: {size:.2f} MB")

if __name__ == "__main__":
    main()
