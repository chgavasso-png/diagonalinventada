# App Android — Diagonal Inventada (Controle de Ponto)

Este é um projeto Android nativo mínimo: uma tela cheia com uma WebView que
carrega `https://diagonalinventada.vercel.app/index.html`. Dá pra usar
câmera/galeria para o upload de foto de perfil (usa o `<input type="file">`
das páginas normalmente), e os botões "Baixar Excel" do painel admin também
funcionam — o app recebe o arquivo do site e salva direto na pasta Downloads
do celular (mostra um aviso confirmando).

## Como abrir e gerar o app (.apk)

1. Instale o **Android Studio** (grátis): https://developer.android.com/studio
2. Abra o Android Studio → **Open** → selecione esta pasta (`apps/android`).
3. Espere o Gradle sincronizar (primeira vez baixa umas coisas, pode levar
   alguns minutos). Se aparecer um aviso sobre o "Gradle wrapper", aceite a
   opção do Android Studio para configurá-lo automaticamente.
4. Para testar no seu celular: ative o "Modo desenvolvedor" e "Depuração USB"
   no Android, conecte por cabo, e clique no botão ▶ (Run) no Android Studio.
5. Para gerar o `.apk` para instalar em qualquer aparelho (sem loja):
   **Build → Build Bundle(s) / APK(s) → Build APK(s)**. O arquivo fica em
   `app/build/outputs/apk/debug/app-debug.apk` — copie pro celular e instale.
6. Para publicar na Google Play, é preciso gerar uma versão **assinada**
   (**Build → Generate Signed Bundle/APK**) e ter uma conta de
   desenvolvedor Google Play (pagamento único de ~US$25).

## Trocar o link do site

O endereço está fixo em `app/src/main/java/com/diagonalinventada/controleponto/MainActivity.kt`,
na constante `SITE_URL`.

## Alternativa mais simples (sem instalar nada)

Em vez deste projeto, dá pra usar o **PWABuilder** (https://www.pwabuilder.com):
cola a URL do site, ele detecta que já é um PWA (o `manifest.json` já está
configurado) e gera um pacote Android pronto (.apk/.aab) na nuvem, sem precisar
de Android Studio. É o caminho mais rápido pra Play Store. Essa opção usa por
baixo dos panos o próprio Chrome (Trusted Web Activity), então os downloads
de Excel já funcionam sozinhos, sem precisar da ponte que este projeto tem.
