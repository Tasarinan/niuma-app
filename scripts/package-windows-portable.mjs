/**
 * Stage a portable Windows folder + zip after `npm run tauri build`.
 * Output: src-tauri/target/release/bundle/portable/Niuma-<version>-windows-x64-portable.zip
 *
 * Unzip anywhere and run Niuma.exe. Requires WebView2 Runtime on the machine.
 */
import { execSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const releaseDir = path.join(projectRoot, "src-tauri", "target", "release");
const sourceTeamsDir = path.join(projectRoot, ".teams");

function readVersion() {
  const pkg = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8"));
  return String(pkg.version || "0.0.0");
}

function findMainExe() {
  const candidates = ["Niuma.exe", "niuma.exe"];
  for (const name of candidates) {
    const p = path.join(releaseDir, name);
    if (existsSync(p)) return { path: p, name };
  }
  const loose = readdirSync(releaseDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".exe") && !e.name.toLowerCase().includes("build"))
    .map((e) => e.name);
  if (loose.length === 1) {
    return { path: path.join(releaseDir, loose[0]), name: loose[0] };
  }
  throw new Error(
    `No release exe in ${releaseDir}. Run "npm run tauri build" on Windows first.`,
  );
}

const README = `Niuma Windows 便携版（免安装）

1. 解压到任意目录（路径尽量不要太深，避免 Windows 路径过长）。
2. 双击 Niuma.exe 启动。
3. 本机需已安装 Microsoft Edge WebView2 运行时（Win10/11 多数已自带）。
4. 密钥与微信/IMA：把本目录的 .env.example 复制为 .env.local，填密钥。
   文件须与 Niuma.exe、.teams 同级（也可设 NIUMA_ROOT_DIR 指向含 .teams 的工作区）。
5. 应用配置在 .niumaconfig\\（与 .teams 同级）。草稿在 .artifacts\\。

此包不写入注册表、不创建开始菜单项；删除文件夹即可卸载。
`;

function countFiles(dir) {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) n += countFiles(p);
    else if (entry.isFile()) n += 1;
  }
  return n;
}

/** Full repo `.teams` (source of truth); Tauri also stages under target/release/.teams. */
function resolveTeamsSource() {
  if (existsSync(sourceTeamsDir)) return sourceTeamsDir;
  const built = path.join(releaseDir, ".teams");
  if (existsSync(built)) return built;
  throw new Error("Missing .teams at repo root and in target/release/.teams");
}

function syncTeamsTree(destDir) {
  const src = resolveTeamsSource();
  rmSync(destDir, { recursive: true, force: true });
  cpSync(src, destDir, { recursive: true });
}

function zipPortableFolder(stagingApp, zipPath) {
  mkdirSync(path.dirname(zipPath), { recursive: true });
  if (existsSync(zipPath)) rmSync(zipPath, { force: true });
  const parent = path.dirname(stagingApp);
  const leaf = path.basename(stagingApp);
  const ps = [
    "Compress-Archive",
    `-Path '${parent.replace(/'/g, "''")}${path.sep}${leaf.replace(/'/g, "''")}${path.sep}*'`,
    `-DestinationPath '${zipPath.replace(/'/g, "''")}'`,
    "-Force",
  ].join(" ");
  execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: "inherit" });
}

function main() {
  if (process.platform !== "win32") {
    console.warn("package-windows-portable: intended for Windows; continuing anyway.");
  }

  const { path: exePath, name: exeName } = findMainExe();
  const resourceDir = path.join(releaseDir, "resources");

  const version = readVersion();
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  const folderName = `Niuma-${version}-windows-${arch}-portable`;
  const stagingRoot = path.join(releaseDir, "bundle", "portable", folderName);
  const stagingApp = path.join(stagingRoot, "Niuma");

  mkdirSync(stagingApp, { recursive: true });
  cpSync(exePath, path.join(stagingApp, exeName));

  for (const sibling of readdirSync(releaseDir)) {
    if (/\.(dll|pak|dat|bin)$/i.test(sibling)) {
      cpSync(path.join(releaseDir, sibling), path.join(stagingApp, sibling));
    }
  }

  const stagedResources = path.join(stagingApp, "resources");
  if (existsSync(resourceDir)) {
    cpSync(resourceDir, stagedResources, { recursive: true });
  } else {
    mkdirSync(stagedResources, { recursive: true });
  }

  // `.teams` lives next to the exe (same as installed builds), not under resources/.
  const nestedTeams = path.join(stagedResources, ".teams");
  if (existsSync(nestedTeams)) {
    rmSync(nestedTeams, { recursive: true, force: true });
  }
  syncTeamsTree(path.join(stagingApp, ".teams"));

  writeFileSync(path.join(stagingApp, "README-portable.txt"), README, "utf8");

  const envExample = path.join(projectRoot, ".env.example");
  if (existsSync(envExample)) {
    cpSync(envExample, path.join(stagingApp, ".env.example"));
  } else {
    console.warn("package-windows-portable: missing .env.example at repo root");
  }

  const zipPath = path.join(releaseDir, "bundle", "portable", `${folderName}.zip`);
  zipPortableFolder(stagingApp, zipPath);

  const srcCount = countFiles(resolveTeamsSource());
  const packedCount = countFiles(path.join(stagingApp, ".teams"));
  console.log(`Portable folder: ${stagingApp}`);
  console.log(`Portable zip:    ${zipPath}`);
  console.log(`.teams files:    ${packedCount} (source ${srcCount})`);
  if (packedCount !== srcCount) {
    console.warn("Warning: portable .teams file count differs from source.");
  }
}

main();
