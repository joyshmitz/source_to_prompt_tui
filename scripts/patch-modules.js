#!/usr/bin/env bun
/**
 * Patches node_modules that use require for JSON files, which breaks bun compile.
 * Run this after bun install (it's the postinstall script).
 */

import fs from "node:fs";
import path from "node:path";

// Simple regex-based patches
const regexPatches = [
  {
    file: "node_modules/csso/lib/version.js",
    find: /import \{ createRequire \} from 'module';\s*const require = createRequire\(import\.meta\.url\);\s*export const \{ version \} = require\('\.\.\/package\.json'\);/,
    replace: 'export const version = "5.0.5";',
    check: 'export const version = "',
  },
  {
    file: "node_modules/css-tree/lib/version.js",
    find: /import \{ createRequire \} from 'module';\s*const require = createRequire\(import\.meta\.url\);\s*export const \{ version \} = require\('\.\.\/package\.json'\);/,
    replace: 'export const version = "2.2.1";',
    check: 'export const version = "',
  },
];

// JSON inlining patches - read JSON file and inline it
const jsonInlinePatches = [
  {
    file: "node_modules/css-tree/lib/data-patch.js",
    jsonFile: "node_modules/css-tree/data/patch.json",
  },
];

// Patch css-tree/lib/data.js to inline mdn-data JSON files instead of require()
// This fixes: "Cannot find module 'mdn-data/css/at-rules.json' from '/$bunfs/root/s2p'"
const mdnDataPatch = {
  file: "node_modules/css-tree/lib/data.js",
  jsonFiles: {
    mdnAtrules: "node_modules/mdn-data/css/at-rules.json",
    mdnProperties: "node_modules/mdn-data/css/properties.json",
    mdnSyntaxes: "node_modules/mdn-data/css/syntaxes.json",
  },
};

// Apply regex patches
for (const patch of regexPatches) {
  const filePath = path.resolve(patch.file);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${patch.file} (not found)`);
    continue;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  if (patch.find.test(content)) {
    fs.writeFileSync(filePath, patch.replace);
    console.log(`Patched ${patch.file}`);
  } else if (content.includes(patch.check)) {
    console.log(`Already patched ${patch.file}`);
  } else {
    console.warn(`Warning: ${patch.file} has unexpected content`);
  }
}

// Apply JSON inlining patches
for (const patch of jsonInlinePatches) {
  const filePath = path.resolve(patch.file);
  const jsonPath = path.resolve(patch.jsonFile);

  if (!fs.existsSync(filePath) || !fs.existsSync(jsonPath)) {
    console.log(`Skipping ${patch.file} (not found)`);
    continue;
  }

  const content = fs.readFileSync(filePath, "utf-8");

  // Check if already patched
  if (content.includes("const patch = {")) {
    console.log(`Already patched ${patch.file}`);
    continue;
  }

  // Read JSON and create inline export
  const jsonData = fs.readFileSync(jsonPath, "utf-8");
  const newContent = `const patch = ${jsonData};\nexport default patch;`;
  fs.writeFileSync(filePath, newContent);
  console.log(`Patched ${patch.file} (inlined JSON)`);
}

// Apply mdn-data inlining patch to css-tree/lib/data.js
{
  const filePath = path.resolve(mdnDataPatch.file);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${mdnDataPatch.file} (not found)`);
  } else {
    const content = fs.readFileSync(filePath, "utf-8");

    // Check if already patched (inlined JSON won't have createRequire)
    if (!content.includes("createRequire")) {
      console.log(`Already patched ${mdnDataPatch.file}`);
    } else {
      // Read all three mdn-data JSON files
      const jsonVars = [];
      let allFound = true;
      for (const [varName, jsonFile] of Object.entries(mdnDataPatch.jsonFiles)) {
        const jsonPath = path.resolve(jsonFile);
        if (!fs.existsSync(jsonPath)) {
          console.warn(`Warning: ${jsonFile} not found, skipping mdn-data patch`);
          allFound = false;
          break;
        }
        const jsonData = fs.readFileSync(jsonPath, "utf-8");
        jsonVars.push(`const ${varName} = ${jsonData.trim()};`);
      }

      if (allFound) {
        // Build new file content by splicing out the require() lines and
        // inserting inlined JSON. We avoid String.prototype.replace() because
        // the JSON data contains '$' characters which have special meaning
        // in replacement strings (e.g. $' means "text after match").
        const lines = content.split("\n");
        const newLines = [];
        let didPatch = false;

        for (let i = 0; i < lines.length; i++) {
          // Skip the createRequire import line
          if (lines[i].includes("import { createRequire } from 'module';")) {
            didPatch = true;
            continue;
          }
          // Skip the const require = createRequire(...) line
          if (lines[i].includes("const require = createRequire(import.meta.url);")) {
            continue;
          }
          // Replace the three require() lines with inlined JSON
          if (lines[i].includes("const mdnAtrules = require('mdn-data/css/at-rules.json');")) {
            newLines.push(jsonVars.join("\n"));
            // Skip the next two require lines as well
            i += 2;
            continue;
          }
          newLines.push(lines[i]);
        }

        const newContent = newLines.join("\n");
        if (!didPatch) {
          console.warn(`Warning: ${mdnDataPatch.file} did not match expected pattern`);
        } else {
          fs.writeFileSync(filePath, newContent);
          console.log(`Patched ${mdnDataPatch.file} (inlined mdn-data JSON)`);
        }
      }
    }
  }
}
