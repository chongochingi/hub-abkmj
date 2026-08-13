import http from "node:http";
import https from "node:https";

const PORT = Number(process.env.PORT || 8091);
const UPSTREAMS = (
  process.env.LIVEATC_HOSTS ||
  "s1-bos.liveatc.net,s1-ord.liveatc.net,s1-nyc.liveatc.net"
).split(",");

function fetchUpstream(host, mount) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: host,
        path: `/${mount}`,
        method: "GET",
        headers: {
          "User-Agent": "VLC/3.0.20 LibVLC/3.0.20",
          Referer: "https://www.liveatc.net/",
          Accept: "*/*",
          Connection: "keep-alive",
        },
      },
      (res) => resolve({ host, res }),
    );
    req.on("error", reject);
    req.setTimeout(12000, () => {
      req.destroy(new Error("upstream timeout"));
    });
    req.end();
  });
}

function pipeStripIcy(upstream, client, metaint) {
  let need = metaint;
  let skipping = 0;
  let buf = Buffer.alloc(0);

  upstream.on("data", (chunk) => {
    if (client.writableEnded) return;
    buf = Buffer.concat([buf, chunk]);
    while (buf.length) {
      if (skipping > 0) {
        const n = Math.min(skipping, buf.length);
        buf = buf.subarray(n);
        skipping -= n;
        continue;
      }
      if (buf.length < need) {
        client.write(buf);
        need -= buf.length;
        buf = Buffer.alloc(0);
        break;
      }
      if (need > 0) {
        client.write(buf.subarray(0, need));
        buf = buf.subarray(need);
        need = 0;
      }
      if (!buf.length) break;
      skipping = buf[0] * 16;
      buf = buf.subarray(1);
      need = metaint;
    }
  });
  upstream.on("end", () => client.end());
  upstream.on("error", () => {
    if (!client.writableEnded) client.end();
  });
  client.on("close", () => upstream.destroy());
}

async function handle(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    });
    res.end();
    return;
  }

  const mount = String(req.url || "")
    .split("?")[0]
    .replace(/^\//, "")
    .replace(/[^A-Za-z0-9_]/g, "");
  if (!mount) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("mount required");
    return;
  }

  let lastErr = "unavailable";
  for (const host of UPSTREAMS) {
    try {
      const { res: up } = await fetchUpstream(host.trim(), mount);
      if (up.statusCode !== 200) {
        lastErr = `HTTP ${up.statusCode}`;
        up.resume();
        continue;
      }
      const metaint = Number(up.headers["icy-metaint"] || 0);
      const headers = {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        Connection: "keep-alive",
      };
      if (up.headers["icy-name"]) headers["X-Stream-Name"] = up.headers["icy-name"];
      res.writeHead(200, headers);
      if (metaint > 0) pipeStripIcy(up, res, metaint);
      else {
        up.pipe(res);
        res.on("close", () => up.destroy());
      }
      return;
    } catch (err) {
      lastErr = err.message || String(err);
    }
  }
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end(`LiveATC feed unavailable (${lastErr})`);
}

http.createServer(handle).listen(PORT, "0.0.0.0", () => {
  console.log(`liveatc-proxy on :${PORT}`);
});
