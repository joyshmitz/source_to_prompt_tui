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
            // Validate that the next two lines are the expected require() calls
            // before skipping them. If upstream changes the file layout, we must
            // not silently skip unrelated lines.
            const nextLine1 = lines[i + 1] || "";
            const nextLine2 = lines[i + 2] || "";
            if (!nextLine1.includes("const mdnProperties = require('mdn-data/css/properties.json');")) {
              console.warn(
                `Warning: ${mdnDataPatch.file} line ${i + 2} does not match expected mdnProperties require().\n` +
                `  Expected: const mdnProperties = require('mdn-data/css/properties.json');\n` +
                `  Got:      ${nextLine1.trim()}`
              );
            }
            if (!nextLine2.includes("const mdnSyntaxes = require('mdn-data/css/syntaxes.json');")) {
              console.warn(
                `Warning: ${mdnDataPatch.file} line ${i + 3} does not match expected mdnSyntaxes require().\n` +
                `  Expected: const mdnSyntaxes = require('mdn-data/css/syntaxes.json');\n` +
                `  Got:      ${nextLine2.trim()}`
              );
            }
            newLines.push(jsonVars.join("\n"));
            // Only skip lines that actually match the expected require() pattern.
            // Check each line independently using the pre-captured values so that
            // a mismatch on one line doesn't affect the index check for the other.
            const skipLine1 = nextLine1.includes("const mdnProperties = require('mdn-data/css/properties.json');");
            const skipLine2 = nextLine2.includes("const mdnSyntaxes = require('mdn-data/css/syntaxes.json');");
            if (skipLine1 && skipLine2) {
              i += 2;
            } else if (skipLine1) {
              i += 1;
            }
            // If only line2 matches but not line1, don't skip either --
            // something is very wrong with the file layout.
            continue;
          }
          newLines.push(lines[i]);
        }

        const newContent = newLines.join("\n");
        if (!didPatch) {
          console.warn(`Warning: ${mdnDataPatch.file} did not match expected pattern`);
        } else {
          // Verify that the inlined JSON data is actually present in the output.
          // didPatch only confirms createRequire was found; we must also confirm
          // the JSON variable declarations were successfully spliced in.
          const missingVars = [];
          for (const varName of Object.keys(mdnDataPatch.jsonFiles)) {
            if (!newContent.includes(`const ${varName} = {`)) {
              missingVars.push(varName);
            }
          }
          if (missingVars.length > 0) {
            console.warn(
              `Warning: ${mdnDataPatch.file} patched output is missing inlined data for: ${missingVars.join(", ")}. ` +
              `The require() lines were removed but JSON was not inlined. Aborting write.`
            );
          } else if (newContent.includes("require(")) {
            console.warn(
              `Warning: ${mdnDataPatch.file} patched output still contains require() calls. ` +
              `Upstream file may have changed. Aborting write.`
            );
          } else {
            fs.writeFileSync(filePath, newContent);
            console.log(`Patched ${mdnDataPatch.file} (inlined mdn-data JSON)`);
          }
        }
      }
    }
  }
}
