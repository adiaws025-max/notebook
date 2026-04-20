/* Lazy Pyodide loader — only fetches what is needed */

declare global {
  interface Window {
    loadPyodide?: (config: { indexURL: string }) => Promise<PyodideInstance>;
    pyodideInstance?: PyodideInstance;
  }
}

export interface PyodideInstance {
  runPythonAsync: (code: string) => Promise<unknown>;
  loadPackage: (pkg: string | string[]) => Promise<void>;
  globals: { get: (key: string) => unknown };
}

let loading = false;
let loadPromise: Promise<PyodideInstance> | null = null;

export async function getPyodide(): Promise<PyodideInstance> {
  if (typeof window === "undefined") throw new Error("Pyodide requires a browser.");

  if (window.pyodideInstance) return window.pyodideInstance;
  if (loadPromise) return loadPromise;

  if (loading) {
    // wait for the existing load
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (window.pyodideInstance) {
          clearInterval(interval);
          resolve(window.pyodideInstance!);
        }
      }, 200);
    });
  }

  loading = true;
  loadPromise = (async () => {
    // Inject Pyodide script tag lazily
    if (!document.getElementById("pyodide-script")) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.id = "pyodide-script";
        script.src = "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Pyodide script."));
        document.head.appendChild(script);
      });
    }

    const pyodide = await window.loadPyodide!({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/",
    });

    // Preload minimal core
    await pyodide.loadPackage(["pandas", "numpy"]);

    window.pyodideInstance = pyodide;
    return pyodide;
  })();

  return loadPromise;
}

export async function ensurePackages(pyodide: PyodideInstance, packages: string[]): Promise<void> {
  if (packages.length > 0) {
    await pyodide.loadPackage(packages);
  }
}

const IMPORT_PACKAGE_MAP: Record<string, string> = {
  matplotlib: "matplotlib",
  scipy: "scipy",
  sklearn: "scikit-learn",
  seaborn: "seaborn",
};

export function detectRequiredPackages(code: string): string[] {
  const pkgs: string[] = [];
  for (const [importName, pkgName] of Object.entries(IMPORT_PACKAGE_MAP)) {
    if (code.includes(`import ${importName}`) || code.includes(`from ${importName}`)) {
      pkgs.push(pkgName);
    }
  }
  return pkgs;
}
