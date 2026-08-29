"""
Ajusta a logo:
- Recorta o conteúdo real (auto-crop removendo areas brancas)
- Aumenta a resolucao (2x)
- Garante fundo 100% branco puro (sem transparencia / sem contraste)
"""
from PIL import Image, ImageChops
import os

CAMINHO = r"C:\Users\chgav\OneDrive\Desktop\Projetos\diagonalinventada-main\logo.png"
BACKUP = r"C:\Users\chgav\OneDrive\Desktop\Projetos\diagonalinventada-main\logo_original_backup.png"

# Fator de aumento
FATOR_AUMENTO = 2.0

# Padding final em volta da logo (em pixels depois do aumento)
PADDING = 60

# Cor branca pura
BRANCO = (255, 255, 255)

img = Image.open(CAMINHO)
print(f"Original: modo={img.mode} tamanho={img.size}")

# Backup do original
img.save(BACKUP)
print(f"Backup salvo em: {BACKUP}")

# Converter para RGB (descarta alfa para evitar areas transparentes)
if img.mode in ("RGBA", "LA", "P"):
    # Criar fundo branco e compor a imagem por cima para "achatar" o alfa
    fundo = Image.new("RGB", img.size, BRANCO)
    if img.mode == "P":
        img = img.convert("RGBA")
    if img.mode in ("RGBA", "LA"):
        fundo.paste(img, mask=img.split()[-1])  # usa o canal alfa como mascara
    img = fundo
elif img.mode != "RGB":
    img = img.convert("RGB")

# Auto-crop: remove bordas brancas
# Cria uma imagem "invertida" e encontra o bbox do conteudo nao-branco
from PIL import ImageOps
invertida = ImageOps.invert(img)
bbox = invertida.getbbox()
print(f"bbox do conteudo: {bbox}")

if bbox:
    img = img.crop(bbox)

print(f"Apos crop: tamanho={img.size}")

# Redimensionar aumentando (mantendo proporcao)
nova_largura = int(img.width * FATOR_AUMENTO)
nova_altura = int(img.height * FATOR_AUMENTO)
img = img.resize((nova_largura, nova_altura), Image.LANCZOS)
print(f"Apos aumento: tamanho={img.size}")

# Criar canvas final 100% branco com padding
canvas_w = nova_largura + (PADDING * 2)
canvas_h = nova_altura + (PADDING * 2)
canvas = Image.new("RGB", (canvas_w, canvas_h), BRANCO)
canvas.paste(img, (PADDING, PADDING))

# Salvar
canvas.save(CAMINHO, "PNG", optimize=True)
print(f"Logo final salva: {canvas.size} -> {CAMINHO}")
