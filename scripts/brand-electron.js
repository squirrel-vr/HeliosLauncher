const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

if (process.platform !== 'darwin') process.exit(0)

const root = path.join(__dirname, '..')
const name = require(path.join(root, 'package.json')).productName
const appDir = path.join(root, 'node_modules', 'electron', 'dist', 'Electron.app')
const plist = path.join(appDir, 'Contents', 'Info.plist')
const iconSrc = path.join(root, 'build', 'icon.icns')
const iconDst = path.join(appDir, 'Contents', 'Resources', 'electron.icns')

if (!fs.existsSync(plist)) process.exit(0)

const read = key => execFileSync('/usr/libexec/PlistBuddy', ['-c', `Print ${key}`, plist]).toString().trim()
const sameIcon = fs.existsSync(iconDst) && fs.readFileSync(iconSrc).equals(fs.readFileSync(iconDst))

if (read('CFBundleName') === name && read('CFBundleDisplayName') === name && sameIcon) process.exit(0)

execFileSync('plutil', ['-replace', 'CFBundleName', '-string', name, plist])
execFileSync('plutil', ['-replace', 'CFBundleDisplayName', '-string', name, plist])
fs.copyFileSync(iconSrc, iconDst)
execFileSync('codesign', ['--force', '--deep', '--sign', '-', appDir], { stdio: 'ignore' })
fs.utimesSync(appDir, new Date(), new Date())
try {
    execFileSync('/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister', ['-f', appDir])
} catch {
    process.exitCode = 0
}
console.log(`Dev Electron.app branded as "${name}"`)
