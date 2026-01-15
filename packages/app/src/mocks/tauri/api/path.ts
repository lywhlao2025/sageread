const joinParts = (parts: string[]) =>
  parts
    .filter((part) => part != null && part !== "")
    .join("/")
    .replace(/\/{2,}/g, "/");

export async function appDataDir(): Promise<string> {
  return "/tmp/sageread";
}

export async function appConfigDir(): Promise<string> {
  return "/tmp/sageread/config";
}

export async function resourceDir(): Promise<string> {
  return "/tmp/sageread/resources";
}

export async function tempDir(): Promise<string> {
  return "/tmp";
}

export async function join(...parts: string[]): Promise<string> {
  return joinParts(parts);
}
