import SwiftUI
import WebKit

/// Embrulha um WKWebView para uso dentro de SwiftUI, carregando o site do
/// Controle de Ponto. Upload de foto (<input type="file">) já funciona
/// nativamente a partir do iOS 15 sem código extra — só precisa das chaves
/// NSCameraUsageDescription / NSPhotoLibraryUsageDescription no Info do target.
struct WebViewRepresentable: UIViewRepresentable {
    let url: URL
    @Binding var isLoading: Bool

    func makeUIView(context: Context) -> WKWebView {
        let contentController = WKUserContentController()
        // Ponte usada pelo site (js/admin.js -> salvarArquivoBlob) para
        // entregar os relatórios em Excel, já que <a download> com blob:
        // não funciona de forma confiável dentro de uma WKWebView.
        contentController.add(context.coordinator, name: "iosDownloadBridge")

        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.userContentController = contentController

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        let parent: WebViewRepresentable
        init(_ parent: WebViewRepresentable) { self.parent = parent }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            DispatchQueue.main.async {
                self.parent.isLoading = false
            }
        }

        // Recebe { base64, filename, mimeType } do JS e abre a folha de
        // compartilhamento do iOS para o usuário salvar/enviar o arquivo.
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "iosDownloadBridge",
                  let body = message.body as? [String: Any],
                  let base64DataUrl = body["base64"] as? String,
                  let filename = body["filename"] as? String
            else { return }

            let base64Puro = base64DataUrl.contains(",")
                ? String(base64DataUrl.split(separator: ",", maxSplits: 1)[1])
                : base64DataUrl

            guard let data = Data(base64Encoded: base64Puro) else { return }

            let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
            do {
                try data.write(to: tempURL, options: .atomic)
            } catch {
                return
            }

            DispatchQueue.main.async {
                let activityVC = UIActivityViewController(activityItems: [tempURL], applicationActivities: nil)
                if let rootVC = UIApplication.shared.connectedScenes
                    .compactMap({ $0 as? UIWindowScene })
                    .flatMap({ $0.windows })
                    .first(where: { $0.isKeyWindow })?.rootViewController {
                    if let popover = activityVC.popoverPresentationController {
                        popover.sourceView = rootVC.view
                        popover.sourceRect = CGRect(x: rootVC.view.bounds.midX, y: rootVC.view.bounds.midY, width: 0, height: 0)
                    }
                    rootVC.present(activityVC, animated: true)
                }
            }
        }
    }
}
