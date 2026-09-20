#!/usr/bin/env node
// Follow Builders prepare-digest — fetch central feeds, emit JSON for the agent to remix.
// Default language: zh. No API keys required.

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const USER_DIR = join(homedir(), ".follow-builders");
const CONFIG_PATH = join(USER_DIR, "config.json");

const FEED_X_URL =
  "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-x.json";
const FEED_PODCASTS_URL =
  "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-podcasts.json";
const FEED_BLOGS_URL =
  "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-blogs.json";
const PROMPTS_BASE =
  "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/prompts";
const PROMPT_FILES = [
  "summarize-podcast.md",
  "summarize-tweets.md",
  "summarize-blogs.md",
  "digest-intro.md",
  "translate.md",
];

function mirrors(githubRaw) {
  try {
    const { hostname, pathname } = new URL(githubRaw);
    if (hostname !== "raw.githubusercontent.com") return [githubRaw];
    const parts = pathname.replace(/^\/+/, "").split("/");
    const [owner, repo, branch, ...rest] = parts;
    const path = rest.join("/");
    return [
      `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${path}`,
      `https://raw.gitmirror.com/${owner}/${repo}/${branch}/${path}`,
      githubRaw,
    ];
  } catch {
    return [githubRaw];
  }
}

async function fetchWithMirrors(url, asJson) {
  const errors = [];
  for (const candidate of mirrors(url)) {
    try {
      const res = await fetch(candidate);
      if (!res.ok) {
        errors.push(`${candidate} HTTP ${res.status}`);
        continue;
      }
      return asJson ? await res.json() : await res.text();
    } catch (err) {
      errors.push(`${candidate}: ${err.message}`);
    }
  }
  return null;
}

async function fetchJSON(url) {
  return fetchWithMirrors(url, true);
}

async function fetchText(url) {
  return fetchWithMirrors(url, false);
}

async function main() {
  const errors = [];
  let config = {
    language: "zh",
    frequency: "daily",
    delivery: { method: "stdout" },
  };
  if (existsSync(CONFIG_PATH)) {
    try {
      config = { ...config, ...JSON.parse(await readFile(CONFIG_PATH, "utf-8")) };
    } catch (err) {
      errors.push(`Could not read config: ${err.message}`);
    }
  }
  if (!config.language) config.language = "zh";

  const [feedX, feedPodcasts, feedBlogs] = await Promise.all([
    fetchJSON(FEED_X_URL),
    fetchJSON(FEED_PODCASTS_URL),
    fetchJSON(FEED_BLOGS_URL),
  ]);

  if (!feedX) errors.push("Could not fetch tweet feed");
  if (!feedPodcasts) errors.push("Could not fetch podcast feed");
  if (!feedBlogs) errors.push("Could not fetch blog feed");

  const prompts = {};
  const scriptDir = fileURLToPath(new URL(".", import.meta.url));
  const localPromptsDir = join(scriptDir, "..", "prompts");
  const userPromptsDir = join(USER_DIR, "prompts");

  for (const filename of PROMPT_FILES) {
    const key = filename.replace(".md", "").replace(/-/g, "_");
    const userPath = join(userPromptsDir, filename);
    const localPath = join(localPromptsDir, filename);
    if (existsSync(userPath)) {
      prompts[key] = await readFile(userPath, "utf-8");
      continue;
    }
    const remote = await fetchText(`${PROMPTS_BASE}/${filename}`);
    if (remote) {
      prompts[key] = remote;
      continue;
    }
    if (existsSync(localPath)) {
      prompts[key] = await readFile(localPath, "utf-8");
    } else {
      errors.push(`Could not load prompt: ${filename}`);
    }
  }

  const output = {
    status: "ok",
    generatedAt: new Date().toISOString(),
    config: {
      language: config.language || "zh",
      frequency: config.frequency || "daily",
      delivery: config.delivery || { method: "stdout" },
    },
    podcasts: feedPodcasts?.podcasts || [],
    x: feedX?.x || [],
    blogs: feedBlogs?.blogs || [],
    stats: {
      podcastEpisodes: feedPodcasts?.podcasts?.length || 0,
      xBuilders: feedX?.x?.length || 0,
      totalTweets: (feedX?.x || []).reduce((sum, a) => sum + (a.tweets?.length || 0), 0),
      blogPosts: feedBlogs?.blogs?.length || 0,
      feedGeneratedAt:
        feedX?.generatedAt || feedPodcasts?.generatedAt || feedBlogs?.generatedAt || null,
    },
    prompts,
    errors: errors.length > 0 ? errors : undefined,
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ status: "error", message: err.message }));
  process.exit(1);
});
