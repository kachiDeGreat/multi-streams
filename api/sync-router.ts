import { Client } from "ssh2";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { StreamDestination } from "../src/types";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res
        .status(405)
        .json({ success: false, error: "Method Not Allowed" });
    }

    if (!req.body || !req.body.destinations) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid request payload" });
    }

    const { destinations } = req.body;
    const activeDestinations = destinations.filter(
      (dest: StreamDestination) => dest.enabled,
    );

    let nginxConfigString = "";
    const warnings: string[] = [];

    activeDestinations.forEach((dest: StreamDestination) => {
      const cleanKey = (dest.streamKey || "").trim();
      if (!cleanKey) {
        warnings.push(
          `${dest.platform || "Destination"} was not pushed: Stream key is missing!`,
        );
        return;
      }

      if (!dest.rtmpUrl) {
        warnings.push(
          `${dest.platform || "Destination"} was not pushed: Ingest URL is missing!`,
        );
        return;
      }

      const baseUrl = dest.rtmpUrl.endsWith("/")
        ? dest.rtmpUrl
        : dest.rtmpUrl + "/";

      let pushUrl: string;
      if (
        dest.platform.toLowerCase() === "facebook" ||
        baseUrl.startsWith("rtmps://")
      ) {
        pushUrl = `rtmp://127.0.0.1:19350/rtmp/${cleanKey}`;
      } else {
        pushUrl = `${baseUrl}${cleanKey}`;
      }

      nginxConfigString += `push ${pushUrl};\n`;
    });

    if (nginxConfigString === "") {
      nginxConfigString = "# No active routes\n";
    }

    const bashCommand = `echo -e '${nginxConfigString}' > /etc/nginx/destinations.conf && sudo systemctl reload nginx`;

    const privateKey = process.env.AWS_PRIVATE_KEY
      ? process.env.AWS_PRIVATE_KEY.replace(/\\n/g, "\n")
      : "";

    if (!process.env.AWS_HOST || !privateKey) {
      return res.status(500).json({
        success: false,
        error: "Missing AWS credentials in .env.local file",
      });
    }

    await new Promise((resolve, reject) => {
      const conn = new Client();

      conn
        .on("ready", () => {
          conn.exec(bashCommand, (err, stream) => {
            if (err) {
              conn.end();
              return reject(new Error("Server bridge execution failed."));
            }

            stream
              .on("close", (code: number) => {
                conn.end();
                if (code === 0) {
                  resolve(true);
                } else {
                  reject(new Error("NGINX engine refused to reload."));
                }
              })
              .stderr.on("data", (data: Buffer) => {
                console.error("STDERR:", data.toString());
              });
          });
        })
        .on("error", (err) => {
          console.error("SSH Connection Error:", err);
          reject(
            new Error("Could not connect to AWS engine. Check server status."),
          );
        })
        .connect({
          host: process.env.AWS_HOST,
          port: 22,
          username: process.env.AWS_USER || "admin",
          privateKey: privateKey,
          readyTimeout: 30000,
        });
    });

    return res
      .status(200)
      .json({ success: true, warnings, message: "Routes active." });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("SYNC ROUTER CRASHED:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
