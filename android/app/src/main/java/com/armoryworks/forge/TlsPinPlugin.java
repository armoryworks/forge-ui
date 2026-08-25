package com.armoryworks.forge;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.security.MessageDigest;
import java.security.cert.Certificate;

import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;

/**
 * Reads the SHA-256 fingerprint of a host's leaf TLS certificate so the app
 * can enforce its trust-on-first-use pin. The system trust store still
 * validates the chain; this adds the "is it the certificate we pinned"
 * check on top. Runs off the main thread.
 */
@CapacitorPlugin(name = "TlsPin")
public class TlsPinPlugin extends Plugin {

    @PluginMethod
    public void fingerprint(PluginCall call) {
        String host = call.getString("host");
        int port = call.getInt("port", 443);
        if (host == null || host.isEmpty()) {
            call.reject("host is required");
            return;
        }

        new Thread(() -> {
            try (SSLSocket socket = (SSLSocket) SSLSocketFactory.getDefault().createSocket(host, port)) {
                socket.setSoTimeout(10_000);
                socket.startHandshake();
                Certificate[] chain = socket.getSession().getPeerCertificates();
                byte[] digest = MessageDigest.getInstance("SHA-256").digest(chain[0].getEncoded());
                StringBuilder hex = new StringBuilder();
                for (byte b : digest) hex.append(String.format("%02x", b));
                JSObject result = new JSObject();
                result.put("sha256", hex.toString());
                call.resolve(result);
            } catch (Exception e) {
                call.reject("TLS handshake failed: " + e.getMessage());
            }
        }).start();
    }
}
