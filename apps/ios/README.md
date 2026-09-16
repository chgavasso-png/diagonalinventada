# App iOS — Diagonal Inventada (Controle de Ponto)

**Importante:** para compilar um app de iOS é **obrigatório** um **Mac com Xcode**
(gratuito na App Store do Mac). Não existe forma de gerar/instalar um app de
iPhone a partir de um Windows. Se você não tem um Mac, veja a seção
"Alternativa sem Mac" no final.

Este projeto é só o **código-fonte** (não é um projeto `.xcodeproj` pronto,
porque esse formato do Xcode é arriscado de criar à mão). O passo a passo
abaixo cria o projeto certinho no Xcode e encaixa esses arquivos nele —
leva uns 10 minutos.

## Passo a passo (no Mac, com Xcode instalado)

1. Abra o Xcode → **File → New → Project** → escolha **iOS → App** → Next.
2. Preencha:
   - **Product Name**: `ControleDePonto`
   - **Interface**: `SwiftUI`
   - **Language**: `Swift`
   - **Organization Identifier**: algo como `com.diagonalinventada` (o Bundle ID final vira `com.diagonalinventada.ControleDePonto`)
3. Salve o projeto em qualquer pasta do Mac.
4. No painel esquerdo do Xcode, **apague** os arquivos gerados automaticamente
   `ContentView.swift` e `ControleDePontoApp.swift` (Move to Trash).
5. Arraste estes 3 arquivos desta pasta para dentro do projeto no Xcode
   (marcar "Copy items if needed"):
   - `ControleDePontoApp.swift`
   - `ContentView.swift`
   - `WebViewRepresentable.swift`
6. Ícone do app: abra `Assets.xcassets → AppIcon` no Xcode e arraste o
   arquivo `Assets/AppIcon-1024.png` (desta pasta) para o slot de 1024x1024.
7. Tela de abertura: em `Assets.xcassets`, clique em **+ → New Image Set**,
   nomeie como `SplashLogo`, e arraste `Assets/SplashLogo.png` (desta pasta)
   para o slot "1x" (ou "2x"/"3x" também, se quiser mais nitidez).
8. Permissões de câmera/fotos: clique no projeto (ícone azul no topo) →
   aba **Info** → adicione estas duas chaves (botão "+"):
   - `Privacy - Camera Usage Description` → texto: `Usado para tirar foto de perfil.`
   - `Privacy - Photo Library Usage Description` → texto: `Usado para escolher foto de perfil.`
9. Selecione seu iPhone (ou um simulador) no topo do Xcode e clique ▶ (Run).
   Na primeira vez num iPhone físico, vá em **Ajustes → Geral → VPN e Gerenciamento
   de Dispositivo** no iPhone e confie no seu Apple ID de desenvolvedor.

Isso já dá um app funcional instalado direto no seu iPhone (dura ~7 dias e
precisa reinstalar pelo Xcode de novo, a não ser que você tenha uma conta
paga da Apple Developer Program — ver abaixo).

## Publicar de verdade (TestFlight ou App Store)

Para distribuir sem precisar reinstalar via Xcode toda semana (TestFlight
para a equipe testar, ou App Store pública), é necessário:
- Uma conta **Apple Developer Program** (US$99/ano) em https://developer.apple.com
- No Xcode: **Signing & Capabilities** → selecionar seu Team → **Product → Archive**
  → **Distribute App**.

## Trocar o link do site

Está na constante `siteURL` em `ContentView.swift`.

## Baixar relatórios em Excel

Os botões "Baixar Excel" do painel admin funcionam dentro do app: como uma
WKWebView não sabe lidar com downloads normais, o `WebViewRepresentable.swift`
recebe o arquivo do site e abre a folha de compartilhamento do iOS (Share
Sheet), de onde dá pra salvar em Arquivos, enviar por e-mail, AirDrop etc.

## Alternativa sem Mac

Não existe jeito de compilar pra iOS sem macOS/Xcode — é uma exigência da
Apple, não uma limitação deste projeto. As opções práticas são:
- Pedir pra alguém com Mac seguir este passo a passo (leva ~10 min).
- Alugar um "Mac na nuvem" por hora (ex.: MacStadium, MacinCloud) só pra
  compilar e gerar o `.ipa`.
- Usar um serviço como o **PWABuilder** (https://www.pwabuilder.com) ou
  **Appflow/Capacitor Cloud**, que ainda assim, para iOS, no fim das contas
  também precisam de uma etapa de build da Apple — mas alguns oferecem
  build em nuvem sem você precisar ter o Mac.
