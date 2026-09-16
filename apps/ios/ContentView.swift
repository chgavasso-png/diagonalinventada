import SwiftUI

private let siteURL = URL(string: "https://diagonalinventada.vercel.app/index.html")!

struct ContentView: View {
    @State private var isLoading = true

    var body: some View {
        ZStack {
            WebViewRepresentable(url: siteURL, isLoading: $isLoading)
                .edgesIgnoringSafeArea(.all)

            if isLoading {
                ZStack {
                    Color(red: 10.0 / 255.0, green: 8.0 / 255.0, blue: 105.0 / 255.0)
                        .edgesIgnoringSafeArea(.all)
                    Image("SplashLogo")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 140, height: 140)
                }
                .transition(.opacity)
            }
        }
        .animation(.easeOut(duration: 0.25), value: isLoading)
    }
}
