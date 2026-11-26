import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { addMenuCancelSource as wireMenuCancel } from '../scripts/wire-tvos-ui-test.mjs';

const require = createRequire(import.meta.url);
const plugin = require('./withTvMenuKey.js');
const xcode = require('xcode');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT_NAME = 'AnthemGymTimer';

function templateProject(projectName) {
  const raw = execFileSync(
    'tar',
    ['-xOf', join(ROOT, 'node_modules/expo/template.tgz'), 'package/ios/HelloWorld.xcodeproj/project.pbxproj'],
    { encoding: 'utf8' },
  );
  const dir = mkdtempSync(join(tmpdir(), 'menu-cancel-'));
  const pbxPath = join(dir, 'project.pbxproj');
  writeFileSync(pbxPath, raw.replaceAll('HelloWorld', projectName));
  const project = xcode.project(pbxPath);
  project.parseSync();
  return project;
}

function filePaths(project) {
  const files = project.pbxFileReferenceSection();
  return Object.keys(files)
    .filter((key) => !key.endsWith('_comment'))
    .map((key) => String(files[key].path || '').replace(/^"|"$/g, ''));
}

function appTargetSources(project, projectName) {
  const native = project.pbxNativeTargetSection();
  const app = Object.keys(native).find((key) => {
    if (key.endsWith('_comment')) return false;
    return String(native[key].name || '').replace(/^"|"$/g, '') === projectName;
  });
  const phaseId = native[app].buildPhases.find((phase) => String(phase.comment).includes('Sources')).value;
  const phase = project.hash.project.objects.PBXSourcesBuildPhase[phaseId];
  return phase.files.map((file) => file.comment);
}

describe('tv Menu source', () => {
  it('uses the prebuilt xcodeproj name, then expo.name', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ios-folder-'));
    expect(plugin.iosProjectFolderName(dir, join(ROOT, 'app.json'))).toBe(PROJECT_NAME);
    mkdirSync(join(dir, 'Pods.xcodeproj'));
    expect(plugin.iosProjectFolderName(dir, join(ROOT, 'app.json'))).toBe(PROJECT_NAME);
    mkdirSync(join(dir, `${PROJECT_NAME}.xcodeproj`));
    const appJson = join(dir, 'app.json');
    writeFileSync(appJson, JSON.stringify({ expo: { name: 'Something Else' } }));
    expect(plugin.iosProjectFolderName(dir, appJson)).toBe(PROJECT_NAME);
    mkdirSync(join(dir, 'Other.xcodeproj'));
    expect(() => plugin.iosProjectFolderName(dir, appJson)).toThrow(/Expected one Xcode project/);
    rmSync(dir, { recursive: true, force: true });
  });

  it('compiles the Menu swizzle into the tvOS app target', () => {
    const project = templateProject(PROJECT_NAME);
    expect(plugin.isTvBuild({})).toBe(false);
    expect(plugin.isTvBuild({ EXPO_TV: '1' })).toBe(true);
    plugin.linkMenuCancel(project, PROJECT_NAME, {});
    expect(filePaths(project).some((file) => file.endsWith(plugin.MENU_SOURCE_FILE))).toBe(false);

    plugin.linkMenuCancel(project, PROJECT_NAME, { EXPO_TV: '1' });
    plugin.linkMenuCancel(project, PROJECT_NAME, { EXPO_TV: 'true' });
    const written = project.writeSync();
    expect(written).toContain(`path = "${PROJECT_NAME}/${plugin.MENU_SOURCE_FILE}"`);
    expect(written).not.toContain('explicitFileType = undefined');
    expect(filePaths(project).filter((file) => file.endsWith(plugin.MENU_SOURCE_FILE))).toEqual([
      `${PROJECT_NAME}/${plugin.MENU_SOURCE_FILE}`,
    ]);
    expect(appTargetSources(project, PROJECT_NAME).filter((comment) => comment.includes(plugin.MENU_SOURCE_FILE))).toEqual([
      `${plugin.MENU_SOURCE_FILE} in Sources`,
    ]);

    const wired = wireMenuCancel(written, PROJECT_NAME);
    expect(wired).toBe(written);
  });

  it('points the UI-test fallback at the prebuilt project folder', () => {
    const pbx = `
/* Begin PBXFileReference section */
/* End PBXFileReference section */
/* Begin PBXBuildFile section */
/* End PBXBuildFile section */
		ABC /* AppDelegate.swift */,
		DEF /* AppDelegate.swift in Sources */,
`;
    const wired = wireMenuCancel(pbx, PROJECT_NAME);
    expect(wired).toContain(`path = ${PROJECT_NAME}/${plugin.MENU_SOURCE_FILE}`);
    expect(wired).not.toContain('path = Americana/');
    expect(wireMenuCancel(wired, PROJECT_NAME)).toBe(wired);
    expect(() => wireMenuCancel(pbx, 'Americana/nested')).toThrow(/project folder/);
  });

  it('keeps the old project folder out of scripts, plugins, and workflows', () => {
    const roots = ['scripts', 'plugins', '.github/workflows'].map((dir) => join(ROOT, dir));
    const hits = [];
    const visit = (dir) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
          visit(full);
          continue;
        }
        if (name.endsWith('.test.mjs') || name.endsWith('.test.py')) continue;
        const text = readFileSync(full, 'utf8');
        const oldIosFolder = ['ios', 'Americana'].join('/');
        const oldSourcePrefix = 'Americana' + '/';
        if (text.includes(oldIosFolder) || text.includes(oldSourcePrefix)) hits.push(relative(ROOT, full));
      }
    };
    for (const root of roots) visit(root);
    expect(hits).toEqual([]);
  });
});
