const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const asarmor = require('asarmor');
const JavaScriptObfuscator = require('javascript-obfuscator');

// ====== ESM 依赖修复函数 ======
function fixEsmDependencies(unpackedPath) {
  console.log('   修复 ESM 依赖问题...');
  
  let copiedCount = 0;
  
  // 修复 mailparser/parseley 依赖链
  // parseley 需要 leac 和 peberminta，但它们可能没有被正确解包
  const parseleyPath = path.join(unpackedPath, 'node_modules', 'parseley');
  if (fs.existsSync(parseleyPath)) {
    console.log('   修复 parseley 依赖...');
    
    const parseleyDeps = ['leac', 'peberminta'];
    const parseleyNodeModules = path.join(parseleyPath, 'node_modules');
    
    if (!fs.existsSync(parseleyNodeModules)) {
      fs.mkdirSync(parseleyNodeModules, { recursive: true });
    }
    
    for (const dep of parseleyDeps) {
      const sourcePath = path.join(unpackedPath, 'node_modules', dep);
      const targetPath = path.join(parseleyNodeModules, dep);
      
      if (fs.existsSync(sourcePath) && !fs.existsSync(targetPath)) {
        try {
          copyDirSync(sourcePath, targetPath);
          copiedCount++;
          console.log(`   ✓ 复制 ${dep} -> parseley/node_modules/`);
        } catch (error) {
          console.warn(`   ⚠️ 复制 ${dep} 失败: ${error.message}`);
        }
      }
    }
  }

  // 6. 修复 form-data 依赖链
  // form-data 需要 es-set-tostringtag 及其深层依赖
  const formDataPath = path.join(unpackedPath, 'node_modules', 'form-data');
  if (fs.existsSync(formDataPath)) {
    console.log('   修复 form-data 依赖...');
    
    const formDataDeps = [
      'es-set-tostringtag',
      'hasown',
      'es-errors',
      'get-intrinsic',
      'has-tostringtag',
      'function-bind',
      'call-bind-apply-helpers',
      'es-define-property',
      'es-object-atoms',
      'get-proto',
      'dunder-proto',
      'gopd',
      'has-symbols',
      'math-intrinsics'
    ];
    const formDataNodeModules = path.join(formDataPath, 'node_modules');
    
    if (!fs.existsSync(formDataNodeModules)) {
      fs.mkdirSync(formDataNodeModules, { recursive: true });
    }
    
    for (const dep of formDataDeps) {
      const sourcePath = path.join(unpackedPath, 'node_modules', dep);
      const targetPath = path.join(formDataNodeModules, dep);
      
      if (fs.existsSync(sourcePath) && !fs.existsSync(targetPath)) {
        try {
          copyDirSync(sourcePath, targetPath);
          copiedCount++;
          console.log(`   ✓ 复制 ${dep} -> form-data/node_modules/`);
        } catch (error) {
          console.warn(`   ⚠️ 复制 ${dep} 失败: ${error.message}`);
        }
      }
    }
  }

  console.log(`   ✅ ESM 依赖修复完成: 复制了 ${copiedCount} 个模块`);
}

// 递归复制目录
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 混淆配置（安全版本）
const obfuscateConfig = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.3,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: false,
  renameGlobals: false,
  selfDefending: false,
  simplify: true,
  splitStrings: false,
  stringArray: true,
  stringArrayCallsTransform: false,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayThreshold: 0.5,
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
  reservedNames: [
    'require', 'module', 'exports', '__dirname', '__filename',
    'window', 'document', 'console', 'process', 'global', 'Buffer',
    'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
    'Promise', 'async', 'await', 'Error', 'JSON', 'Object', 'Array',
    'String', 'Number', 'Boolean', 'Function', 'Symbol', 'Map', 'Set',
    'AccountManager', 'AccountQuery', 'switchToAccount', 'lucide',
    'AutoBindCard', 'ipcRenderer', 'showCenterMessage', 'electron',
    'app', 'BrowserWindow', 'ipcMain', 'shell', 'dialog', 'Menu',
    'log', 'warn', 'error', 'info', 'debug'
  ],
  reservedStrings: ['console', 'ipcRenderer', 'lucide', 'electron']
};

// 混淆单个文件
function obfuscateFile(filePath) {
  try {
    const code = fs.readFileSync(filePath, 'utf8');
    const result = JavaScriptObfuscator.obfuscate(code, obfuscateConfig);
    fs.writeFileSync(filePath, result.getObfuscatedCode(), 'utf8');
    return true;
  } catch (error) {
    console.warn(`   ⚠️ 混淆失败: ${path.basename(filePath)} - ${error.message}`);
    return false;
  }
}

// 不混淆的文件列表（需要调试的模块）
const excludeFiles = [
  'autoBindCard.js',
  'accountSwitcher.js'  // 切号功能，不混淆便于调试
];

// 递归混淆目录
function obfuscateDirectory(dir, excludeDirs = ['node_modules']) {
  if (!fs.existsSync(dir)) return 0;

  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!excludeDirs.includes(entry.name)) {
        count += obfuscateDirectory(fullPath, excludeDirs);
      }
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      // 跳过排除列表中的文件
      if (excludeFiles.includes(entry.name)) {
        console.log(`   ⏭️ 跳过混淆: ${entry.name} (用于调试)`);
        continue;
      }
      if (obfuscateFile(fullPath)) count++;
    }
  }
  return count;
}

exports.default = async function(context) {
  const { appOutDir, packager } = context;
  const platformName = packager.platform.name;
  const electronPlatformName = context.electronPlatformName;
  
  console.log(`\n🔒 afterPack: ${platformName} (${electronPlatformName}) 平台打包完成`);
  console.log(`   输出目录: ${appOutDir}`);
  
  // 获取资源路径
  let resourcesPath;
  if (platformName === 'mac' || electronPlatformName === 'darwin') {
    const appFilename = packager.appInfo.productFilename + '.app';
    resourcesPath = path.join(appOutDir, appFilename, 'Contents', 'Resources');
  } else {
    resourcesPath = path.join(appOutDir, 'resources');
  }

  const asarPath = path.join(resourcesPath, 'app.asar');
  const appPath = path.join(resourcesPath, 'app');

  console.log(`   资源路径: ${resourcesPath}`);

  // 修复 app.asar.unpacked 中的 ESM 依赖
  const unpackedPath = path.join(resourcesPath, 'app.asar.unpacked');
  if (fs.existsSync(unpackedPath)) {
    console.log('\n🔧 修复解压目录中的 ESM 依赖...');
    fixEsmDependencies(unpackedPath);
  }

  // 检查是否使用 ASAR
  if (fs.existsSync(asarPath)) {
    // ASAR 模式：解压 -> 混淆 -> 重新打包 -> 加密
    console.log('\n📦 检测到 ASAR 模式');
    
    try {
      // 1. 解压 ASAR
      console.log('   解压 ASAR...');
      execSync(`npx asar extract "${asarPath}" "${appPath}"`, { stdio: 'pipe' });
      
      // 2. 混淆主进程
      console.log('   混淆主进程...');
      const mainPath = path.join(appPath, 'main.js');
      if (fs.existsSync(mainPath)) {
        obfuscateFile(mainPath);
      }
      
      // 3. 混淆前端 JS
      console.log('   混淆前端 JS...');
      let totalCount = 0;
      
      const rendererPath = path.join(appPath, 'renderer.js');
      if (fs.existsSync(rendererPath) && obfuscateFile(rendererPath)) {
        totalCount++;
      }
      
      const jsDir = path.join(appPath, 'js');
      if (fs.existsSync(jsDir)) {
        totalCount += obfuscateDirectory(jsDir);
      }
      
      const srcDir = path.join(appPath, 'src');
      if (fs.existsSync(srcDir)) {
        totalCount += obfuscateDirectory(srcDir);
      }
      
      console.log(`   ✅ 混淆完成: ${totalCount} 个文件`);
      
      // 4. 重新打包 ASAR
      console.log('   重新打包 ASAR...');
      fs.unlinkSync(asarPath);
      execSync(`npx asar pack "${appPath}" "${asarPath}"`, { stdio: 'pipe' });
      
      // 5. 删除解压的目录
      fs.rmSync(appPath, { recursive: true, force: true });
      
      // 6. 应用 asarmor 保护
      console.log('   应用 asarmor 保护...');
      const archive = await asarmor.open(asarPath);
      archive.patch();
      await archive.write(asarPath);
      
      console.log('\n🔒 代码保护完成：');
      console.log('   - 主进程: 强力混淆保护');
      console.log('   - 前端 JS: 强力混淆保护');
      console.log('   - ASAR: 防解压保护');
      
    } catch (error) {
      console.error('❌ 保护失败:', error.message);
    }
  } else if (fs.existsSync(appPath)) {
    // 非 ASAR 模式：直接混淆
    console.log('\n📁 检测到非 ASAR 模式');
    
    try {
      // 混淆主进程
      console.log('   混淆主进程...');
      const mainFilePath = path.join(appPath, 'main.js');
      if (fs.existsSync(mainFilePath)) {
        obfuscateFile(mainFilePath);
      }
      
      // 混淆前端 JS
      console.log('   混淆前端 JS...');
      let totalCount = 0;
      
      const rendererPath = path.join(appPath, 'renderer.js');
      if (fs.existsSync(rendererPath) && obfuscateFile(rendererPath)) {
        totalCount++;
      }
      
      const jsDir = path.join(appPath, 'js');
      if (fs.existsSync(jsDir)) {
        totalCount += obfuscateDirectory(jsDir);
      }
      
      const srcDir = path.join(appPath, 'src');
      if (fs.existsSync(srcDir)) {
        totalCount += obfuscateDirectory(srcDir);
      }
      
      console.log('\n🔒 代码保护完成：');
      console.log('   - 主进程: 强力混淆保护');
      console.log(`   - 前端 JS: 强力混淆保护 (${totalCount} 个文件)`);
      
    } catch (error) {
      console.error('❌ 保护失败:', error.message);
    }
  } else {
    console.warn('⚠️ 未找到应用目录');
  }
};
