import Foundation
import Capacitor
import CryptoKit

/// Reads the SHA-256 fingerprint of a host's leaf TLS certificate so the app
/// can enforce its trust-on-first-use pin. The system trust store still
/// validates the chain; this adds the "is it the certificate we pinned" check.
///
/// Register: add this file to the App target; Capacitor 7 discovers
/// CAPBridgedPlugin conformers automatically once `TlsPinPlugin` is listed in
/// the app's plugin registration (see `AppDelegate` or `capacitor.config`).
@objc(TlsPinPlugin)
public class TlsPinPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TlsPinPlugin"
    public let jsName = "TlsPin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "fingerprint", returnType: CAPPluginReturnPromise)
    ]

    @objc func fingerprint(_ call: CAPPluginCall) {
        guard let host = call.getString("host"), !host.isEmpty else {
            call.reject("host is required")
            return
        }
        let port = call.getInt("port") ?? 443
        guard let url = URL(string: "https://\(host):\(port)/") else {
            call.reject("invalid host")
            return
        }

        let delegate = LeafCertificateCapture()
        let session = URLSession(configuration: .ephemeral, delegate: delegate, delegateQueue: nil)
        var request = URLRequest(url: url)
        request.httpMethod = "HEAD"
        request.timeoutInterval = 10

        session.dataTask(with: request) { _, _, _ in
            session.finishTasksAndInvalidate()
            guard let leaf = delegate.leafCertificate else {
                call.reject("TLS handshake failed")
                return
            }
            let data = SecCertificateCopyData(leaf) as Data
            let digest = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
            call.resolve(["sha256": digest])
        }.resume()
    }
}

private final class LeafCertificateCapture: NSObject, URLSessionDelegate {
    var leafCertificate: SecCertificate?

    func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge,
                    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        if let trust = challenge.protectionSpace.serverTrust {
            if let chain = SecTrustCopyCertificateChain(trust) as? [SecCertificate] {
                leafCertificate = chain.first
            }
        }
        // Default handling keeps system chain validation intact.
        completionHandler(.performDefaultHandling, nil)
    }
}
