import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iosDir = path.resolve(process.argv[2] ?? path.join(repoRoot, 'ios'));
const sourceSwift = path.join(repoRoot, 'appletv', 'AmericanaUITests', 'AmericanaRemoteUITests.swift');
const targetName = 'AmericanaUITests';

function xid(name) {
  return createHash('sha1').update(`americana-tv-ui-test:${name}`).digest('hex').slice(0, 24).toUpperCase();
}

function findProject() {
  const entries = fs.readdirSync(iosDir, { withFileTypes: true });
  const match = entries.find((entry) => entry.isDirectory() && entry.name.endsWith('.xcodeproj'));
  if (!match) throw new Error(`No xcodeproj under ${iosDir}`);
  return {
    name: match.name,
    dir: path.join(iosDir, match.name),
    pbx: path.join(iosDir, match.name, 'project.pbxproj'),
  };
}

function nativeTargets(pbx) {
  const results = [];
  const re = /([A-F0-9]{24}) \/\* ([^*]+) \*\/ = \{\s*isa = PBXNativeTarget;([\s\S]*?)\n[ \t]*\};/g;
  for (const match of pbx.matchAll(re)) {
    const body = match[3];
    const name = body.match(/\n[ \t]*name = ([^;]+);/)?.[1]?.trim().replace(/^"|"$/g, '') ?? match[2].trim();
    const productType = body.match(/productType = "([^"]+)";/)?.[1] ?? '';
    results.push({ id: match[1], name, productType, body });
  }
  return results;
}

function insertBeforeEnd(pbx, section, block) {
  const end = `/* End ${section} section */`;
  const begin = `/* Begin ${section} section */`;
  const text = block.trimEnd() + '\n';
  if (pbx.includes(end)) return pbx.replace(end, `${text}${end}`);
  if (!pbx.includes('/* Begin PBXProject section */')) {
    throw new Error(`project is missing ${section} and PBXProject`);
  }
  return pbx.replace(
    '/* Begin PBXProject section */',
    `${begin}\n${text}${end}\n\n/* Begin PBXProject section */`,
  );
}

function insertGroupChild(pbx, groupId, childLine) {
  const re = new RegExp(
    `(${groupId}(?: \\/\\*[^\\n*]*(?:\\*(?!\\/)[^\\n*]*)*\\*\\/)? = \\{\\s*isa = PBXGroup;\\s*children = \\(\\s*)`,
  );
  if (!re.test(pbx)) throw new Error(`Could not find PBXGroup ${groupId}`);
  return pbx.replace(re, `$1${childLine}\n`);
}

function quoteSetting(value) {
  return /[^A-Za-z0-9._$/]/.test(value) ? `"${value}"` : value;
}

function buildSettings(appName, deployment) {
  return `
				CODE_SIGNING_ALLOWED = NO;
				CODE_SIGNING_REQUIRED = NO;
				CODE_SIGN_IDENTITY = "";
				CURRENT_PROJECT_VERSION = 1;
				FRAMEWORK_SEARCH_PATHS = (
					"$(inherited)",
					"$(PLATFORM_DIR)/Developer/Library/Frameworks",
				);
				GENERATE_INFOPLIST_FILE = YES;
				LD_RUNPATH_SEARCH_PATHS = (
					"$(inherited)",
					"@executable_path/Frameworks",
					"@loader_path/Frameworks",
				);
				MARKETING_VERSION = 1.0;
				OTHER_LDFLAGS = (
					"$(inherited)",
					"-framework",
					XCTest,
				);
				PRODUCT_BUNDLE_IDENTIFIER = com.garrettscales.americana.uitests;
				PRODUCT_NAME = ${targetName};
				SDKROOT = appletvos;
				SUPPORTED_PLATFORMS = "appletvos appletvsimulator";
				SWIFT_VERSION = 5.0;
				TARGETED_DEVICE_FAMILY = 3;
				TEST_TARGET_NAME = ${quoteSetting(appName)};
				TVOS_DEPLOYMENT_TARGET = ${deployment};`.trim();
}

function configBlock(id, name, settings) {
  return `\t\t${id} /* ${name} */ = {\n\t\t\tisa = XCBuildConfiguration;\n\t\t\tbuildSettings = {\n${settings}\n\t\t\t};\n\t\t\tname = ${name};\n\t\t};`;
}

function wireScheme(schemePath, projectName, targetId) {
  if (!fs.existsSync(schemePath)) throw new Error(`Missing scheme ${schemePath}`);
  let scheme = fs.readFileSync(schemePath, 'utf8');
  scheme = scheme.replace(/(<TestAction\b[\s\S]*?\bbuildConfiguration = ")Debug(")/, '$1Release$2');
  if (scheme.includes(`${targetName}.xctest`)) {
    fs.writeFileSync(schemePath, scheme);
    return;
  }
  const ref = [
    '         <TestableReference',
    '            skipped = "NO"',
    '            parallelizable = "NO">',
    '            <BuildableReference',
    '               BuildableIdentifier = "primary"',
    `               BlueprintIdentifier = "${targetId}"`,
    `               BuildableName = "${targetName}.xctest"`,
    `               BlueprintName = "${targetName}"`,
    `               ReferencedContainer = "container:${projectName}">`,
    '            </BuildableReference>',
    '         </TestableReference>',
  ].join('\n');
  if (scheme.includes('<Testables>')) {
    scheme = scheme.replace('<Testables>', `<Testables>\n${ref}`);
  } else if (/<Testables\s*\/>/.test(scheme)) {
    scheme = scheme.replace(/<Testables\s*\/>/, `<Testables>\n${ref}\n         </Testables>`);
  } else {
    throw new Error(`Scheme has no Testables block: ${schemePath}`);
  }
  fs.writeFileSync(schemePath, scheme);
}

function addMenuCancelSource(pbx) {
  if (pbx.includes('AmericanaMenuCancel.m')) return pbx;
  const fileId = xid('menu-cancel-file');
  const buildId = xid('menu-cancel-build');
  if (!pbx.includes('/* AppDelegate.swift */')) {
    throw new Error('AppDelegate.swift is missing from the Xcode project');
  }
  let next = insertBeforeEnd(
    pbx,
    'PBXFileReference',
    `\t\t${fileId} /* AmericanaMenuCancel.m */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.objc; path = AmericanaMenuCancel.m; sourceTree = "<group>"; };`,
  );
  next = insertBeforeEnd(
    next,
    'PBXBuildFile',
    `\t\t${buildId} /* AmericanaMenuCancel.m in Sources */ = {isa = PBXBuildFile; fileRef = ${fileId} /* AmericanaMenuCancel.m */; };`,
  );
  next = next.replace(
    '/* AppDelegate.swift */,',
    `/* AppDelegate.swift */,\n\t\t\t\t${fileId} /* AmericanaMenuCancel.m */,`,
  );
  next = next.replace(
    '/* AppDelegate.swift in Sources */,',
    `/* AppDelegate.swift in Sources */,\n\t\t\t\t${buildId} /* AmericanaMenuCancel.m in Sources */,`,
  );
  return next;
}

function main() {
  if (!fs.existsSync(sourceSwift)) throw new Error(`Missing ${sourceSwift}`);
  const project = findProject();
  let pbx = addMenuCancelSource(fs.readFileSync(project.pbx, 'utf8'));
  fs.writeFileSync(project.pbx, pbx);
  if (!/appletvos|appletvsimulator|TVOS_DEPLOYMENT_TARGET/.test(pbx)) {
    throw new Error('Xcode project is not a tvOS project. Prebuild must run with EXPO_TV=1.');
  }
  const targets = nativeTargets(pbx);
  const app = targets.find((target) => target.productType === 'com.apple.product-type.application');
  if (!app) throw new Error(`No application target in ${project.pbx}`);
  const existing = targets.find((target) => target.name === targetName);
  if (existing) {
    const schemeDir = path.join(project.dir, 'xcshareddata', 'xcschemes');
    const schemes = fs.readdirSync(schemeDir).filter((name) => name.endsWith('.xcscheme'));
    const preferred = schemes.find((name) => name === `${app.name}.xcscheme`) ?? schemes[0];
    wireScheme(path.join(schemeDir, preferred), project.name, existing.id);
    console.log(`${targetName} is already in ${project.name}; refreshed ${preferred}`);
    return;
  }
  const projectId = pbx.match(/rootObject = ([A-F0-9]{24})/)?.[1];
  const mainGroup = pbx.match(/mainGroup = ([A-F0-9]{24})/)?.[1];
  const productGroup = pbx.match(/productRefGroup = ([A-F0-9]{24})/)?.[1];
  if (!projectId || !mainGroup || !productGroup) throw new Error('Could not read PBXProject ids');
  const deployment = (
    pbx.match(/TVOS_DEPLOYMENT_TARGET = ([^;]+);/)?.[1] ??
    pbx.match(/IPHONEOS_DEPLOYMENT_TARGET = ([0-9.]+);/)?.[1] ??
    '16.4'
  ).replace(/"/g, '').trim();

  const ids = {
    file: xid('file'),
    product: xid('product'),
    buildFile: xid('build-file'),
    group: xid('group'),
    sources: xid('sources'),
    frameworks: xid('frameworks'),
    proxy: xid('proxy'),
    dependency: xid('dependency'),
    target: xid('target'),
    debug: xid('debug'),
    release: xid('release'),
    configList: xid('config-list'),
  };
  for (const id of Object.values(ids)) {
    if (pbx.includes(id)) throw new Error(`Generated id ${id} already exists`);
  }

  const destDir = path.join(iosDir, targetName);
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(sourceSwift, path.join(destDir, 'AmericanaRemoteUITests.swift'));

  pbx = insertBeforeEnd(
    pbx,
    'PBXBuildFile',
    `\t\t${ids.buildFile} /* AmericanaRemoteUITests.swift in Sources */ = {isa = PBXBuildFile; fileRef = ${ids.file} /* AmericanaRemoteUITests.swift */; };`,
  );
  pbx = insertBeforeEnd(
    pbx,
    'PBXFileReference',
    [
      `\t\t${ids.file} /* AmericanaRemoteUITests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AmericanaRemoteUITests.swift; sourceTree = "<group>"; };`,
      `\t\t${ids.product} /* ${targetName}.xctest */ = {isa = PBXFileReference; explicitFileType = wrapper.cfbundle; includeInIndex = 0; path = ${targetName}.xctest; sourceTree = BUILT_PRODUCTS_DIR; };`,
    ].join('\n'),
  );
  pbx = insertBeforeEnd(
    pbx,
    'PBXFrameworksBuildPhase',
    `\t\t${ids.frameworks} /* Frameworks */ = {\n\t\t\tisa = PBXFrameworksBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};`,
  );
  pbx = insertBeforeEnd(
    pbx,
    'PBXGroup',
    `\t\t${ids.group} /* ${targetName} */ = {\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (\n\t\t\t\t${ids.file} /* AmericanaRemoteUITests.swift */,\n\t\t\t);\n\t\t\tpath = ${targetName};\n\t\t\tsourceTree = "<group>";\n\t\t};`,
  );
  pbx = insertBeforeEnd(
    pbx,
    'PBXNativeTarget',
    `\t\t${ids.target} /* ${targetName} */ = {\n\t\t\tisa = PBXNativeTarget;\n\t\t\tbuildConfigurationList = ${ids.configList} /* Build configuration list for PBXNativeTarget "${targetName}" */;\n\t\t\tbuildPhases = (\n\t\t\t\t${ids.sources} /* Sources */,\n\t\t\t\t${ids.frameworks} /* Frameworks */,\n\t\t\t);\n\t\t\tbuildRules = (\n\t\t\t);\n\t\t\tdependencies = (\n\t\t\t\t${ids.dependency} /* PBXTargetDependency */,\n\t\t\t);\n\t\t\tname = ${targetName};\n\t\t\tproductName = ${targetName};\n\t\t\tproductReference = ${ids.product} /* ${targetName}.xctest */;\n\t\t\tproductType = "com.apple.product-type.bundle.ui-testing";\n\t\t};`,
  );
  pbx = insertBeforeEnd(
    pbx,
    'PBXSourcesBuildPhase',
    `\t\t${ids.sources} /* Sources */ = {\n\t\t\tisa = PBXSourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t\t${ids.buildFile} /* AmericanaRemoteUITests.swift in Sources */,\n\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};`,
  );
  pbx = insertBeforeEnd(
    pbx,
    'PBXContainerItemProxy',
    `\t\t${ids.proxy} /* PBXContainerItemProxy */ = {\n\t\t\tisa = PBXContainerItemProxy;\n\t\t\tcontainerPortal = ${projectId} /* Project object */;\n\t\t\tproxyType = 1;\n\t\t\tremoteGlobalIDString = ${app.id};\n\t\t\tremoteInfo = ${app.name};\n\t\t};`,
  );
  pbx = insertBeforeEnd(
    pbx,
    'PBXTargetDependency',
    `\t\t${ids.dependency} /* PBXTargetDependency */ = {\n\t\t\tisa = PBXTargetDependency;\n\t\t\ttarget = ${app.id} /* ${app.name} */;\n\t\t\ttargetProxy = ${ids.proxy} /* PBXContainerItemProxy */;\n\t\t};`,
  );
  const settings = buildSettings(app.name, deployment);
  pbx = insertBeforeEnd(
    pbx,
    'XCBuildConfiguration',
    [configBlock(ids.debug, 'Debug', settings), configBlock(ids.release, 'Release', settings)].join('\n'),
  );
  pbx = insertBeforeEnd(
    pbx,
    'XCConfigurationList',
    `\t\t${ids.configList} /* Build configuration list for PBXNativeTarget "${targetName}" */ = {\n\t\t\tisa = XCConfigurationList;\n\t\t\tbuildConfigurations = (\n\t\t\t\t${ids.debug} /* Debug */,\n\t\t\t\t${ids.release} /* Release */,\n\t\t\t);\n\t\t\tdefaultConfigurationIsVisible = 0;\n\t\t\tdefaultConfigurationName = Release;\n\t\t};`,
  );

  pbx = insertGroupChild(pbx, mainGroup, `\t\t\t${ids.group} /* ${targetName} */,`);
  pbx = insertGroupChild(pbx, productGroup, `\t\t\t${ids.product} /* ${targetName}.xctest */,`);
  if ((pbx.match(/targets = \(/g) ?? []).length !== 1) throw new Error('Expected one PBXProject targets list');
  pbx = pbx.replace(/targets = \(\s*/, `targets = (\n\t\t\t\t${ids.target} /* ${targetName} */,\n\t\t\t\t`);

  fs.writeFileSync(project.pbx, pbx);

  const schemeDir = path.join(project.dir, 'xcshareddata', 'xcschemes');
  const schemes = fs.existsSync(schemeDir) ? fs.readdirSync(schemeDir).filter((name) => name.endsWith('.xcscheme')) : [];
  if (schemes.length === 0) throw new Error(`No shared schemes in ${schemeDir}`);
  const preferred = schemes.find((name) => name === `${app.name}.xcscheme`) ?? schemes[0];
  wireScheme(path.join(schemeDir, preferred), project.name, ids.target);
  console.log(`Added ${targetName} to ${project.name}, depending on ${app.name}, scheme ${preferred}, tvOS ${deployment}`);
}

main();
