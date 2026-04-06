# **Decky Loader Plugin Development: Comprehensive Cursor Reference Notes**  
## **Architectural Ecosystem and Cursor Context**  
- **System Foundation:** Decky Loader operates as an advanced homebrew framework injected into the Steam Deck's operating system (SteamOS), which is structurally based on Arch Linux.1  
- **Dual-Stack Execution:** The platform bridges two entirely distinct runtime environments: the Chromium Embedded Framework (CEF) driving the Steam client's React-based GUI, and a native Linux background process executing a Python asynchronous daemon.1  
- **Cursor IDE Directive:** For artificial intelligence code generation and autocomplete contexts, the workspace must be treated as a bifurcated monolith. The src/ directory requires strict React/TypeScript linting against @decky/api and @decky/ui, while the root directory (specifically main.py) requires Python asyncio context targeting standard Linux system operations.1  
- **Sandbox Evasion:** The primary utility of the Decky framework is its ability to bypass standard web browser constraints, such as Cross-Origin Resource Sharing (CORS), allowing the sandboxed React frontend to trigger native Linux system commands, raw socket connections, and unrestricted HTTP requests via the Python backend.2  
## **Plugin Structure: Development vs. Distribution**  
Understanding the structural dichotomy between the developer environment and the compiled distribution artifact is critical for CI/CD pipelines and manual deployments.  
### **Development Environment Topology**  
The official decky-plugin-template dictates a rigid directory structure.1 Cursor must respect these boundaries when scaffolding new components.  
- **src/:** The definitive location for all frontend source code. Contains index.tsx, custom React hooks, and UI components. This entire directory is transpiled and bundled.1  
- **backend/ (Optional):** Reserved for custom compiled binaries. If a plugin requires high-performance C or Rust execution, source code resides in backend/src, and CI tools compile outputs to backend/out.1  
- **py_modules/:** A staging directory utilized for bundling third-party Python dependencies (e.g., requests, psutil). Decky Loader injects this path into the Python sys.path at runtime.1  
- **defaults/:** Contains static configuration JSON files or documentation that must be deployed alongside the plugin upon installation.7  
- **assets/:** Houses static imagery, SVG icons, and branding materials utilized by the frontend.1  
- **main.py:** The singular entry point for backend logic. Must contain the Plugin class.1  
- **decky.pyi:** A crucial Python interface stub file. Cursor should utilize this file to provide accurate intellisense and type hints for Decky's injected environment variables and logging mechanisms.1  
- **rollup.config.js:** The build orchestrator. Leverages @decky/rollup to bundle the TypeScript frontend into a CEF-compatible payload.1  
### **Compiled Distribution Layout**  
When a plugin is packaged for the Decky Store or manual installation (via a .zip file), it must be pruned to a specific schema. Extraneous development files will cause validation failures.1  
   
| | | |  
|-|-|-|  
| **Artifact Path** | **Requirement** | **System Role and Lifecycle Execution** |   
| dist/index.js | **Required** | The bundled JavaScript payload injected into Steam's CEF.1 |   
| plugin.json | **Required** | The metadata manifest parsed by the Decky engine.1 |   
| package.json | **Required** | Preserved solely for version tracking and dependency resolution.1 |   
| main.py | **Conditional** | Required if utilizing the Python backend; ignored if purely frontend.1 |   
| LICENSE | **Required** | Mandatory for submission to the official Decky database.1 |   
| bin/ | Optional | Replaces backend/out/; houses compiled binaries for native execution.1 |   
## **Backend Implementation: Python Event Loop and Hooks**  
The backend acts as the authoritative execution engine, running outside the CEF sandbox. Decky Loader dynamically imports main.py and executes its routines within a shared asyncio event loop.10  
### **The Plugin Class and Lifecycle Methods**  
All backend logic must be encapsulated within a class explicitly named Plugin.8  
- **Class Instantiation:** Decky Loader instantiates the Plugin class via module.Plugin when the plugin is enabled.10  
- **async def _main(self):**  
- **Purpose:** The initialization and persistence engine.8  
- **Execution:** Triggered immediately after instantiation.  
- **Usage Constraints:** Designed for long-running daemon tasks. Cursor should wrap loops in this method with await asyncio.sleep() to yield control.  
- **Anti-Pattern:** Placing blocking operations (e.g., time.sleep(), synchronous network requests) here will freeze the entire Decky Loader ecosystem.8  
- **async def _unload(self):**  
- **Purpose:** The teardown and garbage collection phase.8  
- **Execution:** Called automatically when the user uninstalls, disables, or updates the plugin.8  
- **Usage Constraints:** Must be used to explicitly close open file handlers, terminate background threads spawned in _main, and close socket connections.8  
### **Decky Environment Variables**  
Decky Loader securely injects specific pathing variables into the Python runtime. Cursor must use these paths instead of hardcoding /home/deck/ to ensure forward compatibility.9  
- **DECKY_PLUGIN_DIR:** The absolute path to the plugin's root. Use this to construct paths to internal bin/ executables or py_modules/.9  
- **DECKY_PLUGIN_SETTINGS_DIR:** The mandated directory for user configurations. Decky creates this automatically.9  
- **DECKY_PLUGIN_RUNTIME_DIR:** The path for ephemeral data, cache, and UNIX sockets.9  
- **DECKY_PLUGIN_LOG_DIR:** The designated output folder for persistent backend logs.9  
- **DECKY_USER:** Identifies the Linux user (typically deck).9  
- **Implementation Note:** Access these via import decky_plugin or standard os.environ.get().9  
## **Frontend Implementation: React in SteamOS**  
The frontend is a modular React application that mounts directly into the SteamOS Quick Access Menu (QAM).  
### **Migration to the Split Architecture**  
- **Legacy Context:** Historically, frontend code utilized decky-frontend-lib for all operations. This is heavily deprecated.3  
- **Modern Context:** Decky Loader v3.0+ enforces a split architecture. Cursor must utilize @decky/ui for interface rendering and @decky/api for logic and backend communication.3  
- **Dependency Management:** Ensure package.json reflects @decky/ui and @decky/api as dependencies, and entirely removes decky-frontend-lib.3  
### **Core @decky/ui Components**  
Cursor should utilize these specific components to maintain the SteamOS design language:  
- **PanelSection:** The primary wrapper for content within the Decky menu. Accepts a title prop.3  
- **PanelSectionRow:** A structural divider that properly spaces UI elements vertically.3  
- **ButtonItem / Button:** Standard interactive buttons.3  
- **ToggleField:** A switch component for boolean settings.3  
- **SliderField:** For integer/float range inputs.3  
### **Build and Compilation**  
- **Toolchain:** Requires Node.js (v16.14+) and strictly pnpm (v9). npm or yarn will cause CI submission failures.1  
- **Command:** pnpm run build compiles src/index.tsx into dist/index.js.1 Every frontend alteration demands a rebuild.6  
- **Rollup Configuration:** The rollup.config.js file must import deckyPlugin from @decky/rollup to ensure CEF compatibility.3  
## **Backend/Frontend Communication (Deep Dive)**  
The most intricate architectural vector in Decky Loader is the Inter-Process Communication (IPC) pipeline. The platform serializes data between the Chromium v8 JavaScript engine and the Python backend over a dedicated protocol.2  
### **Exposing Backend Methods**  
- **Automatic Exposure:** Any standard asynchronous method defined within the Python Plugin class (excluding _main and _unload) is automatically exposed as an RPC endpoint to the frontend.8  
- **Method Signature Rules:**  
- Must be defined as async def.  
- Must accept self as the first argument.8  
- Can accept arbitrary positional arguments.5  
- **Parameter Constraints:**  
- **Supported:** Variable positional arguments (*args) are serialized correctly.5  
- **Unsupported:** Keyword arguments (**kwargs) are fundamentally unsupported by the IPC bridge. Declaring **kwargs will cause serialization crashes.5  
- **Typing:** Python type hints are optional but highly recommended for Cursor autocomplete contexts.5  
- **Return Data Rules:**  
- **Serialization:** The backend can return any data structure, provided it is strictly JSON serializable.5  
- **Permitted Types:** dict, list, int, float, str, bool, None.5  
- **Prohibited Types:** Custom Python objects, memory pointers, unparsed datetime objects, or raw bytes will trigger backend exceptions.  
### **Frontend API Execution Hooks**  
- **The @decky/api Implementation:** The legacy ServerAPI.callPluginMethod object is entirely removed. Cursor must implement the modern call function imported directly from @decky/api.3  
- **Direct Resolution:** The new call function returns its result directly. It no longer wraps responses in an intermediary { success: boolean, result: any } object.3  
- **Error Bubbling:** If the Python method raises an exception (e.g., ValueError), the IPC bridge intercepts it, and the call function rejects the Promise, surfacing as a native JavaScript Error. Try/catch blocks are mandatory.3  
### **Data Passing and TypeScript Generics**  
- **Syntax Structure:** call<, ReturnType>('python_method_name', arg1, arg2).5  
- **Positional Mapping:** Arguments passed to the call function map sequentially to the arguments in the Python method signature.5  
#### **Implementation Pattern: No Arguments**  
**Python:**  
   
Python  
   
   
async def get_status(self):  
     return {"status": "active"}  
   
**TypeScript:**  
   
TypeScript  
   
   
import { call } from '@decky/api';  
 // Generic definition: empty array for args, expected return type  
 const status = await call<, {status: string}>('get_status');  
   
#### **Implementation Pattern: Positional Arguments**  
**Python:**  
   
Python  
   
   
async def calculate_sum(self, a: int, b: int) -> int:  
     return a + b  
   
**TypeScript:**  
   
TypeScript  
   
   
import { call } from '@decky/api';  
 // Passing types for inputs and the expected string return  
 const result = await call<[a: number, b: number], number>('calculate_sum', 5, 10);  
   
## **plugin.json Manifest Configuration**  
The plugin.json file is the definitive structural manifest. It dictates installation behavior, permissions, and database indexing.7  
### **Schema Breakdown**  
   
| | | |  
|-|-|-|  
| **Key** | **Type** | **Description / Implementation Detail** |   
| name | String | The official display name in the Decky QAM.7 |   
| author | String | Developer identity.7 |   
| flags | Array | System-level configurations (see details below).7 |   
| api_version | Integer | **Critical:** Must be 1 to utilize the modern @decky/api architecture.3 |   
| publish.tags | Array | Indexing metadata for store search (e.g., ["utility", "root"]).7 |   
| publish.description | String | The store description.7 |   
| publish.image | String | URL to the store thumbnail image.7 |   
### **System Execution Flags (flags)**  
- **"root":**  
- **Implication:** By default, the Python backend executes in the unprivileged deck user space. The "root" flag elevates the service to root via systemd.8  
- **Use Cases:** Required for hardware manipulation (e.g., CPU/GPU clock modifications in PowerTools or SimpleDeckyTDP), kernel adjustments, or mounting filesystems.8  
- **Rule:** Cursor should only inject this flag if the plugin explicitly requires sudo-level operations. It introduces severe security risks.  
- **"debug":**  
- **Implication:** Instructs Decky Loader to output verbose logs and enables auto-reloading of the frontend injection when file modifications are detected.8  
- **Workflow:** Essential during local development to avoid manual loader restarts.  
## **Development Workflow and CLI Integration**  
Iterative development requires a seamless pipeline between the local IDE (Cursor) and the Steam Deck hardware.  
### **Environment Preparation**  
- **Enable SSH:** Switch Steam Deck to Desktop Mode, open Konsole, and execute sudo systemctl enable --now sshd.15  
- **Set Sudo Password:** Execute passwd to establish an authentication credential for deployments.16  
- **Remote VSCode/Cursor Setup:** Utilize the Remote-SSH extension to connect directly to deck@<STEAM_DECK_IP>.  
### **The CLI Toolchain**  
- **Frontend Building:** Run pnpm i followed by pnpm build.2  
- **Custom Binary Backends:** For Rust/C plugins, the Decky CLI tool wraps compilation in a Docker container matching the SteamOS Arch Linux environment. cargo +nightly build outputs debug binaries, which can be deployed via cp target/debug/decky../plugin-dir/bin/decky.17  
- **Symlink Deployment:** To avoid constantly copying files via SCP, developers symlink their dev folder to the live plugins folder: sudo ln -s ~/Desktop/dev-plugins/PluginName ~/homebrew/plugins.7  
### **Logging and Debugging**  
- **Backend Logs:** Python logs are physically written to ~/homebrew/logs/PluginName/. These timestamped files contain standard output, errors, and unhandled asyncio tracebacks.7  
- **Frontend Logs:** Output to the CEF console. Accessed by enabling CEF remote debugging in Decky settings and navigating to the Deck's IP on port 8081 via a local Chromium browser.7  
## **Constraints and System Rules**  
Decky Loader operates in a highly volatile environment. Cursor must generate code that is defensive and fault-tolerant.  
- **The Single Event Loop Vulnerability:** All installed plugins share the loader's primary asyncio event loop. If one plugin executes a blocking synchronous call (like requests.get() without an executor, or an intensive file I/O block), the entire Decky UI will freeze, and all other plugins will hang.18  
- *Rule:* Always use aiohttp for networking, and wrap file I/O in asyncio.to_thread().  
- **Update Breakages:** SteamOS updates frequently rewrite the React DOM tree. Plugins relying on deep DOM traversal or fragile CSS selectors will break.19  
- *Rule:* Stick strictly to @decky/ui components, which are actively maintained by the community to bridge Valve's UI changes.3  
- **Persistence Restrictions:** Uninstallation removes the plugin directory but leaves configuration and data folders intact to preserve user settings.  
- *Rule:* Do not write gigabytes of cache data to DECKY_PLUGIN_RUNTIME_DIR without implementing a cleanup protocol in _unload.9  
- **Kwargs Prohibition:** Reiteration: Never use **kwargs in Python methods exposed to the frontend.5  
## **Minimal Working Example: Button -> Backend -> UI Flow**  
The following is a comprehensive, production-ready implementation flow for Cursor. It demonstrates a frontend button that triggers a backend asynchronous task to read a system file, simulates a delay, and renders the result.  
### **1. The Configuration (plugin.json)**  
   
JSON  
   
   
{  
     "name": "Cursor Reference Example",  
     "author": "Cursor IDE",  
     "flags": ["debug"],  
     "api_version": 1,  
     "publish": {  
         "tags": ["example", "reference"],  
         "description": "Minimal working flow for Decky architecture.",  
         "image": ""  
     }  
 }  
   
### **2. The Python Backend (main.py)**  
This script demonstrates proper initialization, non-blocking sleeps, and correct RPC exposure.  
   
Python  
   
   
import asyncio  
 import decky_plugin  
 import os  
   
 class Plugin:  
     # ---------------------------------------------------------  
     # Lifecycle Hooks  
     # ---------------------------------------------------------  
     async def _main(self):  
         """  
         Executed on plugin initialization.  
         Safe for spawning background daemon tasks.  
         """  
         decky_plugin.logger.info("Cursor Reference Plugin Initialized.")  
           
         # Example of a background task  
         self.background_task = asyncio.create_task(self._daemon_process())  
   
     async def _daemon_process(self):  
         """A persistent non-blocking loop."""  
         try:  
             while True:  
                 # Do lightweight background monitoring here  
                 await asyncio.sleep(60) # MUST yield to the event loop  
         except asyncio.CancelledError:  
             decky_plugin.logger.info("Daemon process terminated safely.")  
   
     async def _unload(self):  
         """  
         Executed on plugin teardown.  
         Critical for preventing memory leaks.  
         """  
         decky_plugin.logger.info("Cursor Reference Plugin Unloading.")  
         # Cancel the background task  
         if hasattr(self, 'background_task'):  
             self.background_task.cancel()  
         pass  
   
     # ---------------------------------------------------------  
     # Exposed RPC Methods (Backend -> Frontend)  
     # ---------------------------------------------------------  
     async def fetch_system_metrics(self, component: str, detailed_view: bool) -> dict:  
         """  
         Exposed method called by @decky/api.  
         Positional arguments only. No **kwargs.  
         Must return JSON serializable data.  
         """  
         decky_plugin.logger.info(f"Frontend requested metrics for: {component}")  
           
         # Simulate an asynchronous, non-blocking I/O operation  
         await asyncio.sleep(0.5)  
           
         # Validate inputs  
         if component not in ["cpu", "ram"]:  
             # Returning an error structure is safer than raising exceptions  
             return {"success": False, "error": "Invalid component requested."}  
               
         # Construct JSON serializable payload  
         payload = {  
             "success": True,  
             "component": component,  
             "utilization": 45.2, # Simulated float  
             "is_detailed": detailed_view,  
             "config_dir": os.environ.get("DECKY_PLUGIN_SETTINGS_DIR", "Unknown")  
         }  
           
         return payload  
   
### **3. The React Frontend (src/index.tsx)**  
This script demonstrates proper @decky/ui implementation, state management during IPC resolution, and error boundary handling.  
   
TypeScript  
   
   
import {   
     definePlugin,   
     PanelSection,   
     PanelSectionRow,   
     Button,   
     Field   
 } from "@decky/ui";  
 import { call } from "@decky/api";  
 import { useState, VFC } from "react";  
 import { FaTerminal } from "react-icons/fa";  
   
 // 1. Define the exact structural interface expected from the Python return dictionary  
 interface MetricsResponse {  
     success: boolean;  
     error?: string;  
     component?: string;  
     utilization?: number;  
     is_detailed?: boolean;  
     config_dir?: string;  
 }  
   
 // 2. Define the UI Component  
 const Content: VFC = () => {  
     // React hooks to manage UI state and IPC loading phases  
     const [metrics, setMetrics] = useState<MetricsResponse | null>(null);  
     const [loading, setLoading] = useState<boolean>(false);  
     const [ipcError, setIpcError] = useState<string | null>(null);  
   
     // 3. The function executed upon button interaction  
     const requestMetrics = async () => {  
         setLoading(true);  
         setIpcError(null);  
           
         try {  
             // IPC RPC Call via @decky/api  
             // Generic constraints map the Python arguments:   
             // python: (component: str, detailed_view: bool) -> dict  
             // typescript: <[string, boolean], MetricsResponse>  
             const response = await call<[string, boolean], MetricsResponse>(  
                 "fetch_system_metrics", // Exact name of Python method  
                 "cpu",                  // arg1: component  
                 true                    // arg2: detailed_view  
             );  
               
             // Re-render UI with new state  
             setMetrics(response);  
               
         } catch (error: any) {  
             // If the Python method raises a hard exception, it bubbles up here  
             console.error("IPC Communication Failed:", error);  
             setIpcError(error.message |  
   
 | "Unknown IPC Error occurred.");  
         } finally {  
             setLoading(false);  
         }  
     };  
   
     // 4. Render the UI  
     return (  
         <PanelSection title="Cursor Reference Metrics">  
               
             {/* Interaction Row */}  
             <PanelSectionRow>  
                 <Button onClick={requestMetrics} disabled={loading}>  
                     {loading? "Awaiting Backend..." : "Fetch CPU Metrics"}  
                 </Button>  
             </PanelSectionRow>  
               
             {/* Hard Exception Error Boundary */}  
             {ipcError && (  
                 <PanelSectionRow>  
                     <Field label="IPC Exception" style={{ color: "red" }}>  
                         {ipcError}  
                     </Field>  
                 </PanelSectionRow>  
             )}  
   
             {/* Conditionally render data once the IPC call returns successfully */}  
             {metrics && metrics.success && (  
                 <>  
                     <PanelSectionRow>  
                         <Field label="Target Component">{metrics.component}</Field>  
                     </PanelSectionRow>  
                     <PanelSectionRow>  
                         <Field label="Utilization">{metrics.utilization}%</Field>  
                     </PanelSectionRow>  
                     <PanelSectionRow>  
                         <Field label="Detailed Mode">  
                             {metrics.is_detailed? "Active" : "Inactive"}  
                         </Field>  
                     </PanelSectionRow>  
                     <PanelSectionRow>  
                         <Field label="Config Path">  
                             <span style={{ fontSize: "10px", wordBreak: "break-all" }}>  
                                 {metrics.config_dir}  
                             </span>  
                         </Field>  
                     </PanelSectionRow>  
                 </>  
             )}  
               
             {/* Graceful Backend Error Boundary */}  
             {metrics &&!metrics.success && (  
                 <PanelSectionRow>  
                     <Field label="Backend Error">{metrics.error}</Field>  
                 </PanelSectionRow>  
             )}  
               
         </PanelSection>  
     );  
 };  
   
 // 5. Export the module for CEF injection  
 export default definePlugin((serverApi: any) => {  
     return {  
         title: <div className="title-class">Cursor Example</div>,  
         content: <Content />,  
         icon: <FaTerminal />,  
         onDismount() {  
             // Optional frontend cleanup logic  
         },  
     };  
 });  
   
### **Execution Flow Trace**  
1. **Trigger:** The user selects "Fetch CPU Metrics" in the Steam menu. The onClick handler fires requestMetrics in CEF.  
2. **Serialization:** The @decky/api module intercepts the call. It packages the function name (fetch_system_metrics) and arguments (["cpu", true]) into a JSON string and sends it over the WebSocket bridging Arch Linux.3  
3. **Backend Invocation:** The Python daemon receives the payload, unpacks the JSON, and dynamically maps it to the fetch_system_metrics method within the Plugin class instance.8  
4. **Asynchronous Execution:** The Python method runs, hits await asyncio.sleep(0.5), yields control back to the Decky event loop (allowing other plugins to function), resumes, and constructs the response dictionary.8  
5. **Return Bridging:** The dictionary is natively serialized to JSON by Python and returned across the WebSocket to the CEF process.5  
6. **Resolution:** The JavaScript Promise resolves with the data, matching the TypeScript MetricsResponse interface. React triggers a DOM update, injecting the Field rows into the Steam UI.3  
#### **Works cited**  
1. SteamDeckHomebrew/decky-plugin-template - GitHub, accessed April 5, 2026, [https://github.com/SteamDeckHomebrew/decky-plugin-template](https://github.com/SteamDeckHomebrew/decky-plugin-template "https://github.com/SteamDeckHomebrew/decky-plugin-template")  
2. SteamDeckHomebrew/decky-loader: A plugin loader for the Steam Deck. - GitHub, accessed April 5, 2026, [https://github.com/SteamDeckHomebrew/decky-loader](https://github.com/SteamDeckHomebrew/decky-loader "https://github.com/SteamDeckHomebrew/decky-loader")  
3. Migrating to the new decky API - Deckbrew, accessed April 5, 2026, [https://wiki.deckbrew.xyz/en/plugin-dev/new-api-migration](https://wiki.deckbrew.xyz/en/plugin-dev/new-api-migration "https://wiki.deckbrew.xyz/en/plugin-dev/new-api-migration")  
4. Decky Loader download | SourceForge.net, accessed April 5, 2026, [https://sourceforge.net/projects/decky-loader.mirror/](https://sourceforge.net/projects/decky-loader.mirror/ "https://sourceforge.net/projects/decky-loader.mirror/")  
5. Frontend/Backend Communication | Deckbrew, accessed April 5, 2026, [https://wiki.deckbrew.xyz/en/plugin-dev/backend-frontend-communication](https://wiki.deckbrew.xyz/en/plugin-dev/backend-frontend-communication "https://wiki.deckbrew.xyz/en/plugin-dev/backend-frontend-communication")  
6. decky-plugin-template - Codesandbox, accessed April 5, 2026, [https://codesandbox.io/p/github/SteamDeckHomebrew/decky-plugin-template/main](https://codesandbox.io/p/github/SteamDeckHomebrew/decky-plugin-template/main "https://codesandbox.io/p/github/SteamDeckHomebrew/decky-plugin-template/main")  
7. Tormak9970/Decky-QuickStart: A modified decky plugin template that makes getting up and running easier. - GitHub, accessed April 5, 2026, [https://github.com/Tormak9970/Decky-QuickStart](https://github.com/Tormak9970/Decky-QuickStart "https://github.com/Tormak9970/Decky-QuickStart")  
8. Getting Started - Deckbrew - Decky Loader, accessed April 5, 2026, [https://wiki.deckbrew.xyz/plugin-dev/getting-started](https://wiki.deckbrew.xyz/plugin-dev/getting-started "https://wiki.deckbrew.xyz/plugin-dev/getting-started")  
9. decky-plugin-template/decky.pyi at main - GitHub, accessed April 5, 2026, [https://github.com/SteamDeckHomebrew/decky-plugin-template/blob/main/decky.pyi](https://github.com/SteamDeckHomebrew/decky-plugin-template/blob/main/decky.pyi "https://github.com/SteamDeckHomebrew/decky-plugin-template/blob/main/decky.pyi")  
10. decky-syncthing/NOTES.md at main - GitHub, accessed April 5, 2026, [https://github.com/Azure-Agst/decky-syncthing/blob/main/NOTES.md](https://github.com/Azure-Agst/decky-syncthing/blob/main/NOTES.md "https://github.com/Azure-Agst/decky-syncthing/blob/main/NOTES.md")  
11. plugin.json - wheaney/decky-XRGaming - GitHub, accessed April 5, 2026, [https://github.com/wheaney/decky-XRGaming/blob/main/plugin.json](https://github.com/wheaney/decky-XRGaming/blob/main/plugin.json "https://github.com/wheaney/decky-XRGaming/blob/main/plugin.json")  
12. plugin.json - koda-git/DeckyBatteryHealth - GitHub, accessed April 5, 2026, [https://github.com/koda-git/DeckyBatteryHealth/blob/main/plugin.json](https://github.com/koda-git/DeckyBatteryHealth/blob/main/plugin.json "https://github.com/koda-git/DeckyBatteryHealth/blob/main/plugin.json")  
13. 7 reasons every Steam Deck owner needs SimpleDeckyTDP - XDA Developers, accessed April 5, 2026, [https://www.xda-developers.com/reasons-every-steam-deck-owner-needs-simpledeckytdp/](https://www.xda-developers.com/reasons-every-steam-deck-owner-needs-simpledeckytdp/ "https://www.xda-developers.com/reasons-every-steam-deck-owner-needs-simpledeckytdp/")  
14. plugin.json - Nezreka/Museck - GitHub, accessed April 5, 2026, [https://github.com/Nezreka/Museck/blob/main/plugin.json](https://github.com/Nezreka/Museck/blob/main/plugin.json "https://github.com/Nezreka/Museck/blob/main/plugin.json")  
15. File Management on SteamOS - EmuDeck Wiki, accessed April 5, 2026, [https://emudeck.github.io/file-management/steamos/file-management/](https://emudeck.github.io/file-management/steamos/file-management/ "https://emudeck.github.io/file-management/steamos/file-management/")  
16. Steam Deck - Optimizations - RetroDECK Wiki, accessed April 5, 2026, [https://retrodeck.readthedocs.io/en/latest/wiki_devices/steamdeck/steamdeck-optimize/](https://retrodeck.readthedocs.io/en/latest/wiki_devices/steamdeck/steamdeck-optimize/ "https://retrodeck.readthedocs.io/en/latest/wiki_devices/steamdeck/steamdeck-optimize/")  
17. SteamDeckHomebrew/cli - GitHub, accessed April 5, 2026, [https://github.com/SteamDeckHomebrew/cli](https://github.com/SteamDeckHomebrew/cli "https://github.com/SteamDeckHomebrew/cli")  
18. Some plugins that actually are breaking Decky/Steam, and some that *aren't* (Nov 18th SteamOS update) : r/SteamDeck - Reddit, accessed April 5, 2026, [https://www.reddit.com/r/SteamDeck/comments/1p2la2s/some_plugins_that_actually_are_breaking/](https://www.reddit.com/r/SteamDeck/comments/1p2la2s/some_plugins_that_actually_are_breaking/ "https://www.reddit.com/r/SteamDeck/comments/1p2la2s/some_plugins_that_actually_are_breaking/")  
19. A Reminder About Decky Loader... : r/SteamDeck - Reddit, accessed April 5, 2026, [https://www.reddit.com/r/SteamDeck/comments/1jpqobc/a_reminder_about_decky_loader/](https://www.reddit.com/r/SteamDeck/comments/1jpqobc/a_reminder_about_decky_loader/ "https://www.reddit.com/r/SteamDeck/comments/1jpqobc/a_reminder_about_decky_loader/")  
