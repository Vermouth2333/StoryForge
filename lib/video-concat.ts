import { spawn, spawnSync } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

let cachedBin: string | null | undefined;

function tryPath(bin: string): boolean {
  try {
    const result = spawnSync(bin, ["-version"], { encoding: "utf8", timeout: 8_000 });
    return result.status === 0;
  } catch {
    return false;
  }
}

function resolveFfmpegBin(): string | null {
  if (cachedBin !== undefined) return cachedBin;
  const fromEnv = (process.env.FFMPEG_PATH ?? "").trim();
  if (fromEnv && tryPath(fromEnv)) {
    cachedBin = fromEnv;
    return cachedBin;
  }
  if (tryPath("ffmpeg")) {
    cachedBin = "ffmpeg";
    return cachedBin;
  }

  const extras = [
    path.join(process.cwd(), ".tmp", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"),
    path.join(process.cwd(), "tools", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"),
  ];
  for (const candidate of extras) {
    if (tryPath(candidate)) {
      cachedBin = candidate;
      return cachedBin;
    }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fromPkg = require("ffmpeg-static") as string | null;
    if (fromPkg && tryPath(fromPkg)) {
      cachedBin = fromPkg;
      return cachedBin;
    }
  } catch {
    // optional dependency
  }

  cachedBin = null;
  return null;
}

function runFfmpeg(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg 退出 ${code}：${stderr.slice(-400)}`));
    });
  });
}

function concatListPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/'/g, "'\\''");
}

/** Concatenate same-size MP4 clips into one file. Falls back to the first clip if ffmpeg is missing. */
export async function concatMp4Clips(clips: Buffer[]): Promise<Buffer> {
  const usable = clips.filter((c) => c.byteLength > 0);
  if (usable.length === 0) throw new Error("没有可拼接的视频片段");
  if (usable.length === 1) return usable[0];

  const bin = resolveFfmpegBin();
  if (!bin) {
    console.error("[video] 未找到 ffmpeg，仅保留第一段");
    return usable[0];
  }

  const dir = await mkdtemp(path.join(tmpdir(), "sf-vid-"));
  try {
    const lines: string[] = [];
    for (let i = 0; i < usable.length; i++) {
      const file = path.join(dir, `clip${i}.mp4`);
      await writeFile(file, usable[i]);
      lines.push(`file '${concatListPath(file)}'`);
    }
    const listFile = path.join(dir, "list.txt");
    const outFile = path.join(dir, "out.mp4");
    await writeFile(listFile, lines.join("\n"), "utf8");
    try {
      await runFfmpeg(bin, ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", outFile]);
    } catch (err) {
      console.error("[video] 无损拼接失败，改为重编码", err instanceof Error ? err.message : err);
      await runFfmpeg(bin, [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listFile,
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-an",
        outFile,
      ]);
    }
    return await readFile(outFile);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
