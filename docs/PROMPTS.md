# Hand-off prompts for the other machines

Repo: https://github.com/gremstard/swingby (private). The iOS prompt assumes Claude Code is running on that Mac. Windows is not a target.

---

## Other Mac — build the iOS app and ship to TestFlight

```
You are building and releasing the iOS version of SWINGBY, a one-button arcade game (three.js web app wrapped with Capacitor 8). It uses one tap: hold to orbit, release to fly.

Repo: https://github.com/gremstard/swingby (private, owner gremstard).
Run `gh auth status` first. If you are signed in as gremstard, clone it directly. If you are signed in as a different account, run `gh repo fork gremstard/swingby --clone` and work in the fork (ask me to invite you if the fork fails). Do all work on a branch named `ios-release`.

Setup (ask me before installing anything):
1. Full Xcode 26 or newer from the App Store, then `sudo xcode-select -s /Applications/Xcode.app` and open Xcode once to accept the license and install the iOS platform. Command Line Tools alone are not enough.
2. Node 22 LTS and GitHub CLI.
3. In the repo: `npm ci && npm run build && npx cap sync ios`. The iOS project uses Swift Package Manager, no CocoaPods.

Verify in the Simulator first:
4. `npx cap open ios`, pick an iPhone simulator, run. Confirm: the title screen appears, a tap starts a run, hold tethers and release flies, the status bar is hidden, and nothing scrolls or zooms when you tap and drag.
5. Prove a device build compiles without signing: `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build`.

Signing and TestFlight (I will handle anything that needs my Apple ID or password; tell me when you reach it):
6. In Xcode, select the App target, Signing & Capabilities, set the Team to my Apple Developer account and enable automatic signing. Bundle identifier is `com.swingby.game`; keep it. If App Store Connect says the ID is taken, stop and ask me.
7. Set Version 0.6.0 and Build 1 on the target.
8. Product > Archive, then Distribute App > App Store Connect > Upload. I will approve the upload prompts myself.
9. Report the archive result and the build number that appeared in App Store Connect.

If you had to change anything in ios/ or capacitor.config.json, commit it to `ios-release`, push, and open a pull request to gremstard/swingby (from the fork if you used one). Do not change gameplay code under src/.
```
